import {
  CheatAnalysisResult,
  ChessComGame,
  ChessComStats,
  ConfidenceLevel,
  FormatTelemetry,
  InsightFlag,
  PlayerRawBundle,
  SensitivityPreset,
  SignalBreakdown,
  TimeClass,
} from '../types';
import {
  getAccuracyBand,
  getTitleDampener,
  LIVE_FORMATS,
  probabilityToTier,
  SENSITIVITY_MULTIPLIERS,
} from './calibration';
import { computeAggregatePacing } from './pgn-pacing';

const ALL_FORMATS: TimeClass[] = ['rapid', 'blitz', 'bullet', 'daily'];
const CLK_COUNT_REGEX = /\[%clk\s+/g;

function logistic(logit: number): number {
  return 1 / (1 + Math.exp(-logit));
}

function estimateGamePlies(pgn?: string): number {
  if (!pgn) return 40;
  const clkMatches = pgn.match(CLK_COUNT_REGEX);
  if (clkMatches && clkMatches.length > 0) return clkMatches.length;
  // Fallback: find highest move number `34.`
  const moveNums = [...pgn.matchAll(/\b(\d+)\.\s+[a-zA-Z]/g)];
  if (moveNums.length > 0) {
    return Number(moveNums[moveNums.length - 1][1]) * 2;
  }
  return 40;
}

/**
 * Signal 1: Elo-Adjusted Binomial Performance Z-Score (`Z_Elo`).
 * Accounts for exact opponent ratings on every game so beating weaker opponents in open arenas
 * or small-sample lucky streaks (`Z < 1.75σ`) do not cause false positives.
 */
export function computeEloZScoreSignal(eloZScore: number, gamesCount: number, rd: number | null): number {
  if (gamesCount < 5 || eloZScore <= 1.35) return 0;

  // Provisional/high-RD accounts naturally swing faster while converging to true skill
  const rdDamper = rd !== null && rd > 110 ? 0.68 : rd !== null && rd > 80 ? 0.85 : 1.0;
  const adjZ = eloZScore * rdDamper;
  if (adjZ <= 1.35) return 0;

  let raw = 0;
  if (adjZ <= 2.2) {
    // 1.35σ -> 2.2σ: mild hot streak (0 -> 28)
    raw = ((adjZ - 1.35) / 0.85) * 28;
  } else if (adjZ <= 3.2) {
    // 2.2σ -> 3.2σ: significant anomaly (28 -> 68)
    raw = 28 + ((adjZ - 2.2) / 1.0) * 40;
  } else if (adjZ <= 4.3) {
    // 3.2σ -> 4.3σ: extreme outlier (68 -> 94)
    raw = 68 + ((adjZ - 3.2) / 1.1) * 26;
  } else {
    raw = 94 + Math.min(6, (adjZ - 4.3) * 4);
  }

  const sampleConfidence = gamesCount / (gamesCount + 8);
  return Math.min(100, Math.round(raw * sampleConfidence));
}

/**
 * Signal 2: Lifetime Glicko-2 Equilibrium Deviation.
 * Active honest players in arenas or gradual improvers routinely hold 52%–56% lifetime WR.
 * Only meaningful excess above 56% over substantial sample sizes contributes suspicion.
 */
export function computeLifetimeGlickoSignal(wins: number, losses: number, draws: number): number {
  const total = wins + losses + draws;
  if (total < 15) return 0;

  const scoreRatio = (wins + 0.5 * draws) / total;
  // Normal honest upper band is ~0.565
  if (scoreRatio <= 0.565) return 0;

  // Binomial Z-score above 0.555 honest climber baseline
  const z = (scoreRatio - 0.555) / Math.sqrt(0.247 / total);
  if (z <= 1.5) return 0;

  let raw = 0;
  if (scoreRatio <= 0.63) {
    raw = ((scoreRatio - 0.565) / 0.065) * 38;
  } else if (scoreRatio <= 0.71) {
    raw = 38 + ((scoreRatio - 0.63) / 0.08) * 42;
  } else {
    raw = 80 + Math.min(20, ((scoreRatio - 0.71) / 0.10) * 20);
  }

  const zCap = Math.min(1.0, (z - 1.2) / 3.2);
  const weight = total / (total + 38);
  return Math.min(100, Math.round(raw * zCap * weight));
}

/**
 * Signal 3: Bias-Corrected Long-Game CAPS2 Accuracy Excess.
 * - Filters out miniature/trap games (< 32 plies / 16 moves) where book moves yield 95%+ naturally.
 * - Discounts "Free Daily Review Selection Bias" when <40% of games are reviewed and reviewed games
 *   are heavily skewed toward wins.
 */
export function computeBiasAdjustedAccuracySignal(
  avgLongAccuracy: number | null,
  expected: number,
  highAccRate: number,
  reviewedLongGames: number,
  totalLongGames: number,
  reviewedWinRate: number,
  overallRecentWinRate: number
): number {
  if (avgLongAccuracy === null || reviewedLongGames < 3) return 0;

  // Detect Free Game-Review Survivorship Bias (honest users reviewing only their best daily win)
  const coverage = totalLongGames > 0 ? reviewedLongGames / totalLongGames : 1;
  const winSkew = Math.max(0, reviewedWinRate - overallRecentWinRate);
  let survivorshipBiasOffset = 0;
  if (coverage < 0.45 && winSkew > 0.18) {
    survivorshipBiasOffset = Math.min(4.2, 1.8 + winSkew * 4.5);
  } else if (coverage < 0.25) {
    survivorshipBiasOffset = 2.0;
  }

  const adjustedExpected = expected + survivorshipBiasOffset;
  const excess = avgLongAccuracy - adjustedExpected;

  let excessScore = 0;
  if (excess > 1.2) {
    if (excess <= 4.5) {
      excessScore = ((excess - 1.2) / 3.3) * 32;
    } else if (excess <= 8.0) {
      excessScore = 32 + ((excess - 4.5) / 3.5) * 44;
    } else {
      excessScore = Math.min(100, 76 + ((excess - 8.0) / 4.5) * 24);
    }
  }

  // Discount ceiling spikes if survivorship bias is detected
  const effectiveHighRate =
    survivorshipBiasOffset > 1.5 ? Math.max(0, highAccRate - 0.15) : highAccRate;
  let spikeScore = 0;
  if (effectiveHighRate > 0.18) {
    if (effectiveHighRate <= 0.35) {
      spikeScore = ((effectiveHighRate - 0.18) / 0.17) * 45;
    } else if (effectiveHighRate <= 0.55) {
      spikeScore = 45 + ((effectiveHighRate - 0.35) / 0.20) * 40;
    } else {
      spikeScore = Math.min(100, 85 + ((effectiveHighRate - 0.55) / 0.25) * 15);
    }
  }

  const conf = reviewedLongGames / (reviewedLongGames + 7);
  return Math.min(100, Math.round((0.65 * excessScore + 0.35 * spikeScore) * conf));
}

/**
 * Signal 5: RD-Damped Elo Surge Velocity & Extreme Streak Momentum.
 */
export function computeEloVelocitySignal(
  eloDelta7d: number | null,
  eloDelta30d: number | null,
  winStreak: number,
  rd: number | null
): number {
  // High RD (>100) means provisional rating placement — large jumps are normal Glicko math!
  const rdDamper = rd !== null && rd > 125 ? 0.35 : rd !== null && rd > 85 ? 0.65 : 1.0;

  let surge7 = 0;
  if (eloDelta7d !== null && eloDelta7d > 85) {
    surge7 = Math.min(100, ((eloDelta7d - 85) / 210) * 92) * rdDamper;
  }

  let surge30 = 0;
  if (eloDelta30d !== null && eloDelta30d > 140) {
    surge30 = Math.min(100, ((eloDelta30d - 140) / 290) * 88) * rdDamper;
  }

  let streakScore = 0;
  if (winStreak >= 8) {
    streakScore = Math.min(95, ((winStreak - 7) / 11) * 85);
  }

  return Math.min(100, Math.round(Math.max(surge7, surge30 * 0.9) * 0.68 + streakScore * 0.42));
}

/**
 * Signal 6: Account Provenance, Burner Detection & Active Puzzle Skill Discrepancy.
 * Note: Never penalizes untouched default Chess.com puzzle ratings (`400`)!
 */
export function computeAccountTrustSignal(
  accountAgeDays: number | null,
  bestLiveRating: number,
  lifetimeGames: number,
  stats: ChessComStats
): { trustRiskScore: number; tacticsGapRating: number | null } {
  let ageRisk = 0;

  if (accountAgeDays !== null) {
    if (accountAgeDays <= 5) ageRisk = 78;
    else if (accountAgeDays <= 14) ageRisk = 62;
    else if (accountAgeDays <= 30) ageRisk = 45;
    else if (accountAgeDays <= 60) ageRisk = 28;
    else if (accountAgeDays <= 120) ageRisk = 14;
    else ageRisk = 0;
  }

  // Fresh account already competing at high Elo (>= 1800 within 45 days)
  if (accountAgeDays !== null && accountAgeDays <= 45 && bestLiveRating >= 1800) {
    const ratingExcess = Math.min(28, ((bestLiveRating - 1750) / 550) * 28);
    ageRisk = Math.min(100, ageRisk + ratingExcess);
  }

  // Only evaluate Live-vs-Tactics discrepancy if the user has ACTUALLY played puzzles
  // (Chess.com initializes unplayed accounts at `highest: 400, lowest: 400`!)
  const tacticsHighest = stats.tactics?.highest?.rating ?? null;
  const tacticsLowest = stats.tactics?.lowest?.rating ?? null;
  const puzzleRushAttempts = stats.puzzle_rush?.best?.total_attempts ?? 0;
  const hasRealPuzzleActivity =
    tacticsHighest !== null &&
    tacticsHighest > 520 &&
    (puzzleRushAttempts >= 5 || (tacticsLowest !== null && tacticsHighest !== tacticsLowest));

  let tacticsGapRating: number | null = null;
  if (
    hasRealPuzzleActivity &&
    bestLiveRating >= 2000 &&
    tacticsHighest !== null &&
    bestLiveRating - tacticsHighest >= 1000
  ) {
    tacticsGapRating = tacticsHighest;
    ageRisk = Math.min(100, ageRisk + 22);
  }

  // Veteran high-volume accounts receive zero provenance risk
  if (accountAgeDays !== null && accountAgeDays >= 730 && lifetimeGames >= 500) {
    ageRisk = 0;
  }

  return {
    trustRiskScore: Math.round(ageRisk),
    tacticsGapRating,
  };
}

function extractCountryCode(countryUrl?: string): string | null {
  if (!countryUrl) return null;
  const parts = countryUrl.split('/').filter(Boolean);
  const code = parts[parts.length - 1];
  return code && code.length === 2 ? code.toUpperCase() : null;
}

interface ExtendedFormatBuild {
  telemetry: FormatTelemetry;
  totalLongGames: number;
  reviewedWinRate: number;
}

function buildFormatTelemetry(
  format: TimeClass,
  stats: ChessComStats,
  games: ChessComGame[],
  usernameLower: string,
  ratedOnly: boolean,
  nowSec: number
): ExtendedFormatBuild {
  const recObj = stats[`chess_${format}`] as ChessComStats['chess_blitz'];
  const currentRating = recObj?.last?.rating ?? null;
  const peakRating = recObj?.best?.rating ?? currentRating;
  const rd = recObj?.last?.rd ?? null;

  const overallWins = recObj?.record?.win ?? 0;
  const overallLosses = recObj?.record?.loss ?? 0;
  const overallDraws = recObj?.record?.draw ?? 0;
  const overallTotal = overallWins + overallLosses + overallDraws;
  const overallWinPct = overallTotal > 0 ? Math.round((overallWins / overallTotal) * 100) : 0;

  const effectiveRating = currentRating || peakRating || 1200;
  const band = getAccuracyBand(format, effectiveRating);

  let recentWins = 0;
  let recentLosses = 0;
  let recentDraws = 0;

  // Long-game (>=32 plies / 16 moves) accuracy accumulators to prevent miniature/trap inflation
  let accSum = 0;
  let reviewedGames = 0;
  let reviewedWins = 0;
  let highAccCount = 0;
  let totalLongGames = 0;

  // Elo-adjusted binomial Z-score accumulators
  let actualMinusExpectedSum = 0;
  let varianceSum = 0;
  let oppRatingSum = 0;
  let ratedPairCount = 0;

  const sevenDaysCutoff = nowSec - 7 * 86400;
  const thirtyDaysCutoff = nowSec - 30 * 86400;

  let oldest7Ts = Infinity;
  let newest7Ts = -Infinity;
  let oldest7Rating: number | null = null;
  let newest7Rating: number | null = null;

  let oldest30Ts = Infinity;
  let newest30Ts = -Infinity;
  let oldest30Rating: number | null = null;
  let newest30Rating: number | null = null;

  for (const g of games) {
    if (g.time_class !== format) continue;
    if (ratedOnly && g.rated === false) continue;

    const isWhite = g.white?.username?.toLowerCase() === usernameLower;
    const isBlack = g.black?.username?.toLowerCase() === usernameLower;
    if (!isWhite && !isBlack) continue;

    const player = isWhite ? g.white : g.black;
    const opponent = isWhite ? g.black : g.white;
    if (!player) continue;

    let numericScore = 0.5;
    if (player.result === 'win') {
      recentWins++;
      numericScore = 1.0;
    } else if (['checkmated', 'resigned', 'timeout', 'abandoned', 'lose'].includes(player.result)) {
      recentLosses++;
      numericScore = 0.0;
    } else {
      recentDraws++;
      numericScore = 0.5;
    }

    // Elo-adjusted expectation per game
    if (typeof player.rating === 'number' && typeof opponent?.rating === 'number') {
      const clampedDiff = Math.max(-600, Math.min(600, opponent.rating - player.rating));
      const expectedScore = 1 / (1 + Math.pow(10, clampedDiff / 400));
      actualMinusExpectedSum += numericScore - expectedScore;
      varianceSum += Math.max(0.11, expectedScore * (1 - expectedScore) * 0.86);
      oppRatingSum += opponent.rating;
      ratedPairCount++;
    }

    const plies = estimateGamePlies(g.pgn);
    const isFullLengthGame = plies >= 32;
    if (isFullLengthGame) {
      totalLongGames++;
      const acc = g.accuracies ? (isWhite ? g.accuracies.white : g.accuracies.black) : null;
      if (typeof acc === 'number' && !Number.isNaN(acc)) {
        reviewedGames++;
        accSum += acc;
        if (numericScore === 1.0) reviewedWins++;
        if (acc >= band.ceiling) highAccCount++;
      }
    }

    const ts = g.end_time || 0;
    const r = player.rating;
    if (ts > 0 && typeof r === 'number') {
      if (ts >= sevenDaysCutoff) {
        if (ts < oldest7Ts) {
          oldest7Ts = ts;
          oldest7Rating = r;
        }
        if (ts > newest7Ts) {
          newest7Ts = ts;
          newest7Rating = r;
        }
      }
      if (ts >= thirtyDaysCutoff) {
        if (ts < oldest30Ts) {
          oldest30Ts = ts;
          oldest30Rating = r;
        }
        if (ts > newest30Ts) {
          newest30Ts = ts;
          newest30Rating = r;
        }
      }
    }
  }

  const recentTotal = recentWins + recentLosses + recentDraws;
  const recentWinPct = recentTotal > 0 ? Math.round((recentWins / recentTotal) * 100) : 0;
  const avgAccuracy = reviewedGames > 0 ? Number((accSum / reviewedGames).toFixed(1)) : null;
  const highAccRate = reviewedGames > 0 ? Number((highAccCount / reviewedGames).toFixed(3)) : 0;
  const reviewedWinRate = reviewedGames > 0 ? reviewedWins / reviewedGames : 0;

  // Laplace-shrunk Elo Z-Score (+1.25 continuity & small-sample stabilizer)
  const eloZScore =
    ratedPairCount >= 5
      ? Number((actualMinusExpectedSum / Math.sqrt(varianceSum + 1.25)).toFixed(2))
      : 0;

  let performanceRating: number | null = null;
  if (ratedPairCount >= 5) {
    const avgOpp = oppRatingSum / ratedPairCount;
    const scorePct = Math.min(0.96, Math.max(0.04, (recentWins + 0.5 * recentDraws) / recentTotal));
    performanceRating = Math.round(avgOpp - 400 * Math.log10(1 / scorePct - 1));
  }

  const eloDelta7d =
    oldest7Rating !== null && newest7Rating !== null && newest7Ts > oldest7Ts
      ? newest7Rating - oldest7Rating
      : null;
  const eloDelta30d =
    oldest30Rating !== null && newest30Rating !== null && newest30Ts > oldest30Ts
      ? newest30Rating - oldest30Rating
      : null;

  return {
    telemetry: {
      format,
      currentRating,
      peakRating,
      rd,
      overallWins,
      overallLosses,
      overallDraws,
      overallTotal,
      overallWinPct,
      recentWins,
      recentLosses,
      recentDraws,
      recentTotal,
      recentWinPct,
      avgAccuracy,
      expectedAccuracy: band.expected,
      highAccCeiling: band.ceiling,
      highAccRate,
      reviewedGames,
      eloZScore,
      performanceRating,
      eloDelta7d,
      eloDelta30d,
      formatProbability: 0,
    },
    totalLongGames,
    reviewedWinRate,
  };
}

export interface AnalyzeOptions {
  preferredFormat?: TimeClass;
  ratedOnly?: boolean;
  sensitivity?: SensitivityPreset;
  nowMs?: number;
}

/**
 * Multi-Pillar Bayesian Log-Odds Cheat Probability Engine v2.0.
 * Engineered for near-zero false positives on honest humans via:
 * - Elo-adjusted binomial Z-scores (`Z_Elo`)
 * - Long-game (>=32 ply) & survivorship-bias corrected CAPS2 accuracy
 * - Chronometric Shannon Entropy & Quartile Coefficient of Dispersion (QCD)
 * - Orthogonal Pillar De-Duplication + Exculpatory Human Veto Gates
 */
export function analyzePlayerBundle(
  bundle: PlayerRawBundle,
  options: AnalyzeOptions = {}
): CheatAnalysisResult {
  const ratedOnly = options.ratedOnly ?? true;
  const sensitivity = options.sensitivity ?? 'balanced';
  const nowMs = options.nowMs ?? Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  const { profile, stats, recentGames } = bundle;
  const usernameLower = (profile.username || bundle.username).toLowerCase();
  const urlMemberMatch = profile.url?.match(/\/member\/([^/?#]+)/i);
  const displayName = urlMemberMatch?.[1] || profile.username || bundle.username;
  const accountStatus = profile.status || 'basic';
  const isBannedFairPlay = accountStatus.toLowerCase().includes('fair_play_violations');

  const accountAgeDays = profile.joined
    ? Math.max(0, Math.round((nowSec - profile.joined) / 86400))
    : null;

  const validGames = [...recentGames]
    .filter((g) => {
      if (ratedOnly && g.rated === false) return false;
      return (
        g.white?.username?.toLowerCase() === usernameLower ||
        g.black?.username?.toLowerCase() === usernameLower
      );
    })
    .sort((a, b) => (b.end_time || 0) - (a.end_time || 0));

  let winStreak = 0;
  for (const g of validGames) {
    const p = g.white?.username?.toLowerCase() === usernameLower ? g.white : g.black;
    if (p?.result === 'win') winStreak++;
    else break;
  }

  const recentForm: Array<'W' | 'L' | 'D'> = validGames.slice(0, 8).map((g) => {
    const p = g.white?.username?.toLowerCase() === usernameLower ? g.white : g.black;
    if (p?.result === 'win') return 'W';
    if (['checkmated', 'resigned', 'timeout', 'abandoned', 'lose'].includes(p?.result || '')) {
      return 'L';
    }
    return 'D';
  });

  const pacing = computeAggregatePacing(validGames, usernameLower, ratedOnly);

  const formats = {} as Record<TimeClass, FormatTelemetry>;
  const extMeta = {} as Record<TimeClass, { totalLongGames: number; reviewedWinRate: number }>;
  let bestLiveRating = 0;
  let lifetimeGames = 0;

  for (const fmt of ALL_FORMATS) {
    const built = buildFormatTelemetry(fmt, stats, validGames, usernameLower, ratedOnly, nowSec);
    formats[fmt] = built.telemetry;
    extMeta[fmt] = {
      totalLongGames: built.totalLongGames,
      reviewedWinRate: built.reviewedWinRate,
    };
    lifetimeGames += built.telemetry.overallTotal;
    if (fmt !== 'daily' && (built.telemetry.currentRating || 0) > bestLiveRating) {
      bestLiveRating = built.telemetry.currentRating || 0;
    }
  }

  const { trustRiskScore, tacticsGapRating } = computeAccountTrustSignal(
    accountAgeDays,
    bestLiveRating,
    lifetimeGames,
    stats
  );

  const titleDampener = getTitleDampener(profile.title);
  const sensitivityOffsetLogit =
    sensitivity === 'conservative' ? -0.42 : sensitivity === 'strict' ? 0.36 : 0;
  const _unusedMult = SENSITIVITY_MULTIPLIERS[sensitivity];
  void _unusedMult;

  const formatBreakdowns: Record<TimeClass, SignalBreakdown> = {} as Record<
    TimeClass,
    SignalBreakdown
  >;

  for (const fmt of ALL_FORMATS) {
    const ft = formats[fmt];
    const meta = extMeta[fmt];

    const rwr = computeEloZScoreSignal(ft.eloZScore, ft.recentTotal, ft.rd);
    const owr = computeLifetimeGlickoSignal(ft.overallWins, ft.overallLosses, ft.overallDraws);
    const overallRecentWinRate =
      ft.recentTotal > 0 ? ft.recentWins / ft.recentTotal : ft.overallWinPct / 100;
    const acc = computeBiasAdjustedAccuracySignal(
      ft.avgAccuracy,
      ft.expectedAccuracy,
      ft.highAccRate,
      ft.reviewedGames,
      meta.totalLongGames,
      meta.reviewedWinRate,
      overallRecentWinRate
    );
    const pace = fmt === 'daily' ? 0 : pacing.pacingScore;
    const vel = computeEloVelocitySignal(ft.eloDelta7d, ft.eloDelta30d, winStreak, ft.rd);

    formatBreakdowns[fmt] = {
      recentWinrate: rwr,
      overallWinrate: owr,
      accuracyAnomaly: acc,
      movePacing: pace,
      eloVelocity: vel,
      accountTrust: trustRiskScore,
    };

    const floor = profile.title ? 1 : 2;
    if (ft.overallTotal < 5 && ft.recentTotal < 5) {
      ft.formatProbability = floor;
      continue;
    }

    // ── ORTHOGONAL PILLAR FUSION (Eliminates Double-Counting!) ──
    // Pillar A: Unified Performance Excess (de-duplicates RWR, OWR, and Velocity on young accounts)
    const independentHistoryRatio =
      ft.overallTotal > ft.recentTotal
        ? Math.min(1, (ft.overallTotal - ft.recentTotal) / 80)
        : 0;
    const perfPillar = Math.min(
      100,
      Math.max(rwr, owr * (0.45 + 0.55 * independentHistoryRatio)) +
        Math.min(18, vel * 0.22)
    );

    // Pillar B: Move-Quality Excess (CAPS2)
    const accPillar = acc;

    // Pillar C: Chronometric Forensics (damped if player isn't outperforming or playing accurately!)
    const hasResultsOrQuality = perfPillar >= 22 || accPillar >= 25 || ft.recentWinPct >= 56;
    const pacePillar = hasResultsOrQuality ? pace : Math.round(pace * 0.32);

    // Pillar D: Account Provenance Prior
    const trustPillar = trustRiskScore;

    // ── BAYESIAN LOG-ODDS POSTERIOR CALCULATION ──
    // Base prior p0 ≈ 4.1% -> logit = -3.15
    let logit = -3.15 + sensitivityOffsetLogit;

    // Positive Log-Likelihood Ratios (LLRs) per orthogonal pillar
    logit += (perfPillar / 100) * 2.55;
    logit += (accPillar / 100) * 2.85;
    logit += (pacePillar / 100) * 2.65;
    logit += (trustPillar / 100) * 0.95;

    // Corroboration Synergy: fires ONLY when >=2 independent pillars strongly confirm engine usage
    const hasEngineSignal = accPillar >= 52 || pacePillar >= 55;
    if (hasEngineSignal && perfPillar >= 48) {
      logit += 0.95;
    }
    if (accPillar >= 55 && pacePillar >= 55) {
      logit += 1.05;
    }
    if (hasEngineSignal && perfPillar >= 55 && trustPillar >= 55) {
      logit += 0.55;
    }

    // ── EXCULPATORY HUMAN COUNTER-EVIDENCE (Negative LLRs) ──
    if (pacing.isConfirmedHumanPacing && accPillar < 45) {
      // Strong biomechanical proof of organic human mouse/clock variance
      logit -= 0.85;
    }
    if (
      ft.reviewedGames >= 5 &&
      ft.avgAccuracy !== null &&
      ft.avgAccuracy <= ft.expectedAccuracy + 1.2
    ) {
      // Proven normal human move accuracy across >=5 full-length games
      logit -= 0.75;
    }
    if (accountAgeDays !== null && accountAgeDays >= 730 && lifetimeGames >= 600 && !hasEngineSignal) {
      // Established multi-year veteran without engine quality/pacing flags
      logit -= 0.50;
    }

    let posteriorPct = logistic(logit) * 100 * titleDampener;

    // ── HARD FALSE-POSITIVE PROTECTION GATES ──
    // Gate 1: Fresh account alone with normal play can never exceed Low Risk (18%)
    if (perfPillar < 20 && accPillar < 20 && pacePillar < 25) {
      posteriorPct = Math.min(posteriorPct, 18);
    }

    // Gate 2: Pure hot-streak / smurf with CONFIRMED human pacing and no CAPS2 excess
    // is capped at 42% (Guarded / Smurf-Watch) instead of false "High/Critical Engine" alarm!
    if (pacing.isConfirmedHumanPacing && accPillar < 35) {
      posteriorPct = Math.min(posteriorPct, 42);
    }

    // Gate 3: Uncorroborated single-pillar ceiling (if neither Accuracy nor Pacing flags engine play,
    // even when pacing sample is small, cap pure winrate streaks below Critical unless massive Z>4σ)
    if (!hasEngineSignal && accPillar < 30 && pacePillar < 35 && perfPillar < 88) {
      posteriorPct = Math.min(posteriorPct, 48);
    }

    ft.formatProbability = Math.min(99, Math.max(floor, Math.round(posteriorPct)));
  }

  // Choose primary format: prioritize preferred format when it has meaningful recent activity
  let primaryFormat: TimeClass = 'blitz';
  let maxFormatProb = -1;
  let maxFormat: TimeClass = 'blitz';

  for (const fmt of LIVE_FORMATS) {
    if (formats[fmt].formatProbability > maxFormatProb) {
      maxFormatProb = formats[fmt].formatProbability;
      maxFormat = fmt;
    }
  }

  if (
    options.preferredFormat &&
    (formats[options.preferredFormat].recentTotal >= 4 ||
      formats[options.preferredFormat].overallTotal >= 10)
  ) {
    primaryFormat = options.preferredFormat;
  } else {
    // Pick active format with recent games first; only fall back to dormant format if extreme
    const activeFormats = LIVE_FORMATS.filter((f) => formats[f].recentTotal >= 4);
    if (activeFormats.length > 0) {
      primaryFormat = activeFormats.sort(
        (a, b) => formats[b].formatProbability - formats[a].formatProbability
      )[0];
    } else if (maxFormatProb > 0) {
      primaryFormat = maxFormat;
    }
  }

  let probability = formats[primaryFormat].formatProbability;
  // Cross-format bleed only if another active speed shows high corroborated engine probability (>=65%)
  if (primaryFormat !== maxFormat && maxFormatProb >= 65 && maxFormatProb > probability + 20) {
    probability = Math.round(probability * 0.4 + maxFormatProb * 0.6);
    primaryFormat = maxFormat;
  }

  if (isBannedFairPlay) {
    probability = 100;
  }

  const signals = formatBreakdowns[primaryFormat];
  const pf = formats[primaryFormat];

  const totalSample = pf.recentTotal + Math.min(35, pf.overallTotal);
  let confidence: ConfidenceLevel = 'low';
  if (
    isBannedFairPlay ||
    (totalSample >= 25 && (pacing.gamesAnalyzed >= 6 || pf.reviewedGames >= 5))
  ) {
    confidence = 'high';
  } else if (totalSample >= 12) {
    confidence = 'medium';
  }

  // Build Forensic Insight Flags
  const flags: InsightFlag[] = [];

  if (isBannedFairPlay) {
    flags.push({ id: 'banned_fair_play', severity: 'danger', icon: '🚨' });
  }

  if (profile.title) {
    flags.push({
      id: 'verified_title',
      severity: 'info',
      icon: '👑',
      params: { title: profile.title.toUpperCase() },
    });
  }

  if (accountAgeDays !== null && accountAgeDays <= 35 && (pf.currentRating || 0) >= 1800) {
    flags.push({
      id: 'fresh_high_elo',
      severity: probability >= 55 ? 'danger' : 'warning',
      icon: '🆕',
      params: { days: Math.max(1, accountAgeDays), rating: pf.currentRating || 0 },
    });
  } else if (accountAgeDays !== null && accountAgeDays <= 21 && probability >= 30) {
    flags.push({
      id: 'fresh_account',
      severity: 'warning',
      icon: '🆕',
      params: { days: Math.max(1, accountAgeDays) },
    });
  }

  if (pf.recentTotal >= 8 && pf.eloZScore >= 3.0) {
    flags.push({
      id: 'extreme_recent_wr',
      severity: 'danger',
      icon: '🚩',
      params: { games: pf.recentTotal, wr: pf.recentWinPct, z: pf.eloZScore },
    });
  } else if (pf.recentTotal >= 8 && pf.eloZScore >= 2.0) {
    flags.push({
      id: 'elevated_recent_wr',
      severity: 'warning',
      icon: '📈',
      params: { games: pf.recentTotal, wr: pf.recentWinPct, z: pf.eloZScore },
    });
  }

  if (
    signals.recentWinrate >= 40 &&
    pacing.isConfirmedHumanPacing &&
    signals.accuracyAnomaly < 35 &&
    !isBannedFairPlay
  ) {
    flags.push({
      id: 'smurf_human_pacing',
      severity: 'info',
      icon: '🧭',
    });
  }

  if (signals.accuracyAnomaly >= 42 && pf.avgAccuracy !== null) {
    const excess = Number((pf.avgAccuracy - pf.expectedAccuracy).toFixed(1));
    flags.push({
      id: 'accuracy_excess',
      severity: signals.accuracyAnomaly >= 70 ? 'danger' : 'warning',
      icon: '🎯',
      params: { excess: Math.max(1.5, excess), avg: pf.avgAccuracy },
    });
  }

  if (signals.accuracyAnomaly >= 45 && pf.reviewedGames >= 4 && pf.highAccRate >= 0.30) {
    flags.push({
      id: 'accuracy_spikes',
      severity: pf.highAccRate >= 0.45 ? 'danger' : 'warning',
      icon: '⚡',
      params: {
        games: pf.reviewedGames,
        rate: Math.round(pf.highAccRate * 100),
        ceil: pf.highAccCeiling,
      },
    });
  }

  if (
    pacing.gamesAnalyzed >= 5 &&
    signals.movePacing >= 50 &&
    pacing.medianCV !== null &&
    pacing.medianQCD !== null &&
    pacing.meanEntropyBits !== null
  ) {
    flags.push({
      id: 'robotic_pacing',
      severity: signals.movePacing >= 72 ? 'danger' : 'warning',
      icon: '⏱️',
      params: {
        cv: pacing.medianCV,
        qcd: pacing.medianQCD,
        ent: pacing.meanEntropyBits,
      },
    });
  }

  if (pacing.toggleGames >= 2 && signals.movePacing >= 45) {
    flags.push({
      id: 'midgame_toggle',
      severity: pacing.toggleGames >= 3 ? 'danger' : 'warning',
      icon: '🤖',
      params: { count: pacing.toggleGames },
    });
  }

  if (pf.eloDelta7d !== null && pf.eloDelta7d >= 115 && (pf.rd ?? 50) <= 95) {
    flags.push({
      id: 'elo_surge',
      severity: pf.eloDelta7d >= 185 ? 'danger' : 'warning',
      icon: '🚀',
      params: { delta: pf.eloDelta7d },
    });
  }

  if (winStreak >= 8) {
    flags.push({
      id: 'hot_streak',
      severity: winStreak >= 12 ? 'danger' : 'warning',
      icon: '🔥',
      params: { streak: winStreak },
    });
  }

  if (tacticsGapRating !== null) {
    flags.push({
      id: 'tactics_gap',
      severity: 'warning',
      icon: '🧩',
      params: { rating: pf.currentRating || bestLiveRating, tactics: tacticsGapRating },
    });
  }

  if (!isBannedFairPlay && probability < 25) {
    if (pacing.medianCV !== null && pacing.medianCV >= 0.75) {
      flags.push({
        id: 'natural_human',
        severity: 'positive',
        icon: '✅',
        params: { cv: pacing.medianCV },
      });
    }
    if (accountAgeDays !== null && accountAgeDays >= 730 && lifetimeGames >= 500) {
      flags.push({
        id: 'established_veteran',
        severity: 'positive',
        icon: '🛡️',
        params: { years: Math.floor(accountAgeDays / 365), total: lifetimeGames },
      });
    }
  }

  const tier = probabilityToTier(probability, isBannedFairPlay);

  return {
    username: usernameLower,
    displayName,
    avatarUrl: profile.avatar || null,
    countryCode: extractCountryCode(profile.country),
    title: profile.title || null,
    accountStatus,
    isBannedFairPlay,
    accountAgeDays,
    joinedTimestamp: profile.joined || null,
    primaryFormat,
    probability,
    tier,
    confidence,
    winStreak,
    recentForm,
    signals,
    pacing,
    formats,
    flags: flags.slice(0, 5),
    analyzedGamesCount: validGames.length,
    timestamp: nowMs,
  };
}
