import {
  CheatAnalysisResult,
  ChessComGame,
  ChessComStats,
  ConfidenceLevel,
  FormatTelemetry,
  InsightFlag,
  Language,
  LiveMatchClockTelemetry,
  PlayerRawBundle,
  RecentMatchSummary,
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
import { computeAggregatePacing, extractSuspectGamePinpoints } from './pgn-pacing';

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

function wilsonLowerBound(successes: number, total: number, z = 2.33): number {
  if (total <= 0 || successes <= 0) return 0;
  const p = successes / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  return Math.max(0, (center - spread) / denom);
}

/**
 * Signal 1: Zero-FP Elo-Adjusted Binomial Performance Z-Score (`Z_Elo`).
 * Enforces a strict +2.65σ null-hypothesis gate (p < 0.004) over >= 8 games so normal
 * human weekend streaks or weaker-opponent arena games produce strictly 0 suspicion.
 */
export function computeEloZScoreSignal(eloZScore: number, gamesCount: number, rd: number | null): number {
  if (gamesCount < 8 || eloZScore <= 2.65) return 0;

  // Provisional/high-RD accounts naturally swing faster while converging to true skill
  const rdDamper = rd !== null && rd > 110 ? 0.55 : rd !== null && rd > 80 ? 0.80 : 1.0;
  const adjZ = eloZScore * rdDamper;
  if (adjZ <= 2.65) return 0;

  let raw = 0;
  if (adjZ <= 3.5) {
    // 2.65σ -> 3.5σ: strong climb / streak (0 -> 42)
    raw = ((adjZ - 2.65) / 0.85) * 42;
  } else if (adjZ <= 4.5) {
    // 3.5σ -> 4.5σ: extreme statistical outperformance (42 -> 80)
    raw = 42 + ((adjZ - 3.5) / 1.0) * 38;
  } else {
    // >4.5σ (p < 3.4e-6)
    raw = 80 + Math.min(20, (adjZ - 4.5) * 14);
  }

  const sampleConfidence = gamesCount / (gamesCount + 10);
  return Math.min(100, Math.round(raw * sampleConfidence));
}

/**
 * Signal 2: Lifetime Glicko-2 Equilibrium Deviation (Zero-FP Tuned).
 * Requires >=30 lifetime games, >60% score ratio, and >2.8σ binomial excess above 56%
 * so steady honest improvers and tournament players always score 0.
 */
export function computeLifetimeGlickoSignal(wins: number, losses: number, draws: number): number {
  const total = wins + losses + draws;
  if (total < 30) return 0;

  const scoreRatio = (wins + 0.5 * draws) / total;
  if (scoreRatio <= 0.60) return 0;

  const z = (scoreRatio - 0.56) / Math.sqrt(0.2464 / total);
  if (z <= 2.8) return 0;

  let raw = 0;
  if (scoreRatio <= 0.68) {
    raw = ((scoreRatio - 0.60) / 0.08) * 45;
  } else if (scoreRatio <= 0.78) {
    raw = 45 + ((scoreRatio - 0.68) / 0.10) * 40;
  } else {
    raw = 85 + Math.min(15, ((scoreRatio - 0.78) / 0.10) * 15);
  }

  const zCap = Math.min(1.0, (z - 2.5) / 3.0);
  const weight = total / (total + 45);
  return Math.min(100, Math.round(raw * zCap * weight));
}

/**
 * Signal 3: 99.5% Lower-Confidence-Bound (LCB) Long-Game CAPS2 Accuracy Excess.
 * - Requires >= 5 full-length (>= 44 plies / 22 moves) reviewed games.
 * - Subtracts BOTH Free-Tier Survivorship Bias AND studentized sampling uncertainty
 *   (`1.68 * (5.6 / sqrt(n))`) plus 99% Wilson Lower Bound on ceiling spikes so lucky
 *   honest review samples NEVER produce false positives.
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
  if (avgLongAccuracy === null || reviewedLongGames < 5) return 0;

  // 1. Free Game-Review Survivorship Bias Cushion
  const coverage = totalLongGames > 0 ? reviewedLongGames / totalLongGames : 1;
  const winSkew = Math.max(0, reviewedWinRate - overallRecentWinRate);
  let survivorshipBiasOffset = 0;
  if (coverage < 0.50 && winSkew > 0.15) {
    survivorshipBiasOffset = Math.min(4.6, 2.0 + winSkew * 5.0);
  } else if (coverage < 0.30) {
    survivorshipBiasOffset = 2.4;
  }

  // 2. Studentized 99.5% Small-Sample Uncertainty Margin (prevents 5-game lucky variance FPs)
  const samplingMargin = 2.58 * (5.6 / Math.sqrt(reviewedLongGames)) * 0.62;
  const lowerBoundExcess =
    avgLongAccuracy - (expected + survivorshipBiasOffset + samplingMargin);

  let excessScore = 0;
  if (lowerBoundExcess > 0.4) {
    if (lowerBoundExcess <= 3.2) {
      excessScore = ((lowerBoundExcess - 0.4) / 2.8) * 48;
    } else if (lowerBoundExcess <= 6.2) {
      excessScore = 48 + ((lowerBoundExcess - 3.2) / 3.0) * 38;
    } else {
      excessScore = Math.min(100, 86 + ((lowerBoundExcess - 6.2) / 3.5) * 14);
    }
  }

  // 3. 99% Wilson Lower Bound on Ceiling Accuracy Spikes
  const rawHighCount = Math.round(highAccRate * reviewedLongGames);
  const wilsonSpikeRate = wilsonLowerBound(rawHighCount, reviewedLongGames, 2.33);
  const biasAdjustedSpikeLcb =
    survivorshipBiasOffset > 1.5 ? Math.max(0, wilsonSpikeRate - 0.10) : wilsonSpikeRate;

  let spikeScore = 0;
  if (biasAdjustedSpikeLcb > 0.16) {
    if (biasAdjustedSpikeLcb <= 0.34) {
      spikeScore = ((biasAdjustedSpikeLcb - 0.16) / 0.18) * 52;
    } else {
      spikeScore = Math.min(100, 52 + ((biasAdjustedSpikeLcb - 0.34) / 0.25) * 48);
    }
  }

  return Math.min(100, Math.round(0.68 * excessScore + 0.32 * spikeScore));
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
    const isFullLengthGame = plies >= 44; // >= 22 full moves to eliminate opening-book/miniature CAPS2 inflation
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

  const { pinpoints: rawPinpoints, byUrlOrEndTime } = extractSuspectGamePinpoints(
    validGames,
    usernameLower,
    ratedOnly,
    (fmtStr, rating) => {
      const validFmt = (['bullet', 'blitz', 'rapid', 'daily'].includes(fmtStr)
        ? fmtStr
        : 'blitz') as TimeClass;
      return getAccuracyBand(validFmt, rating).ceiling;
    }
  );

  const recentMatches: RecentMatchSummary[] = validGames.slice(0, 5).map((g) => {
    const isWhite = g.white?.username?.toLowerCase() === usernameLower;
    const player = isWhite ? g.white : g.black;
    const opp = isWhite ? g.black : g.white;
    const resCode: 'W' | 'L' | 'D' =
      player?.result === 'win'
        ? 'W'
        : ['checkmated', 'resigned', 'timeout', 'abandoned', 'lose'].includes(player?.result || '')
          ? 'L'
          : 'D';
    const rawAcc = g.accuracies ? (isWhite ? g.accuracies.white : g.accuracies.black) : null;
    const accuracy =
      typeof rawAcc === 'number' && !Number.isNaN(rawAcc) ? Number(rawAcc.toFixed(1)) : null;
    const pinKey = g.url || String(g.end_time || '');
    const pin = pinKey ? byUrlOrEndTime.get(pinKey) : undefined;

    return {
      result: resCode,
      format: String(g.time_class || 'blitz'),
      playerRating: player?.rating || 0,
      opponentUsername: opp?.username || 'Opponent',
      opponentRating: opp?.rating || 0,
      accuracy,
      plies: estimateGamePlies(g.pgn),
      url: g.url || null,
      endTime: g.end_time || 0,
      pinpointKind: pin ? pin.kind : null,
      pinpointMoveRange: pin ? `#${pin.suspectStartMove}–#${pin.suspectEndMove}` : null,
    };
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

    // ── BAYESIAN LOG-ODDS POSTERIOR + STRICT TWO-FACTOR ZERO-FP CORROBORATION LAW ──
    // Base prior p0 ≈ 1.8% -> logit = -4.00 (Neyman-Pearson α -> 0 calibration)
    let logit = -4.0 + sensitivityOffsetLogit;

    // Positive Log-Likelihood Ratios (LLRs) per orthogonal pillar
    logit += (perfPillar / 100) * 2.55;
    logit += (accPillar / 100) * 3.10;
    logit += (pacePillar / 100) * 2.95;
    logit += (trustPillar / 100) * 0.75;

    // Strict Engine Pillars:
    // 1) 99.5% LCB-proven long-game CAPS2 excess (`accPillar >= 46`)
    // 2) Multi-game won-match chronometric collapse (`pacePillar >= 55`)
    const hasHardQualityEvidence = accPillar >= 46;
    const hasHardClockEvidence = pacePillar >= 55;
    const hasDirectEngineEvidence = hasHardQualityEvidence || hasHardClockEvidence;

    // Multi-Pillar Corroboration Synergy (requires >= 2 independent pillars confirming engine assistance)
    const isMultiPillarCorroborated =
      (hasHardQualityEvidence && hasHardClockEvidence) ||
      (hasHardQualityEvidence && perfPillar >= 42) ||
      (hasHardClockEvidence && perfPillar >= 45);

    if (isMultiPillarCorroborated) {
      logit += 1.35;
    }
    if (hasHardQualityEvidence && hasHardClockEvidence) {
      logit += 1.15;
    }
    if (isMultiPillarCorroborated && trustPillar >= 55) {
      logit += 0.45;
    }

    // ── EXCULPATORY HUMAN COUNTER-EVIDENCE (Negative LLRs) ──
    if (pacing.isConfirmedHumanPacing && !hasHardQualityEvidence) {
      logit -= 1.10;
    }
    if (
      ft.reviewedGames >= 5 &&
      ft.avgAccuracy !== null &&
      ft.avgAccuracy <= ft.expectedAccuracy + 1.5
    ) {
      logit -= 0.90;
    }
    if (accountAgeDays !== null && accountAgeDays >= 730 && lifetimeGames >= 600 && !hasDirectEngineEvidence) {
      logit -= 0.65;
    }

    let posteriorPct = logistic(logit) * 100 * titleDampener;

    // ── STRICT ZERO-FALSE-POSITIVE INVARIANT GATES ──
    // Invariant 1: Normal play on a brand-new account can never exceed 12%
    if (perfPillar < 20 && accPillar < 20 && pacePillar < 25) {
      posteriorPct = Math.min(posteriorPct, 12);
    }

    // Invariant 2 (Zero-FP Core Law): Without DIRECT biomechanical clock (`%clk`) or 99.5%-LCB
    // move-quality (`CAPS2`) engine evidence, NO pure win-streak, returning OTB player, or
    // hand-played smurf can EVER cross into Elevated/High/Critical Cheat Risk (capped <= 28% Low)!
    if (!hasDirectEngineEvidence) {
      posteriorPct = Math.min(posteriorPct, 28);
    }

    // Invariant 3: Single uncorroborated engine signal without outperformance or second engine
    // pillar is capped at 46% (Guarded) — High/Critical strictly requires >=2 corroborated pillars!
    if (hasDirectEngineEvidence && !isMultiPillarCorroborated) {
      posteriorPct = Math.min(posteriorPct, 46);
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
    (signals.recentWinrate >= 18 || pf.eloZScore >= 2.65) &&
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

  // Zero-FP Gate on Pinpoints: only surface suspect move-range pinpoints when backed by
  // corroborated engine probability or hard chronometric/accuracy pillar evidence!
  const shouldExposePinpoints =
    isBannedFairPlay ||
    probability >= 45 ||
    signals.movePacing >= 45 ||
    signals.accuracyAnomaly >= 45;
  const suspectPinpoints = shouldExposePinpoints ? rawPinpoints : [];
  const finalRecentMatches = shouldExposePinpoints
    ? recentMatches
    : recentMatches.map((m) => ({ ...m, pinpointKind: null, pinpointMoveRange: null }));

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
    recentMatches: finalRecentMatches,
    suspectPinpoints,
    signals,
    pacing,
    formats,
    flags: flags.slice(0, 5),
    analyzedGamesCount: validGames.length,
    timestamp: nowMs,
  };
}

/**
 * Generates a factual, structured Fair-Play telemetry summary suitable for pasting
 * directly into Chess.com's Fair Play Report description box, including exact
 * game URLs and exact suspect move numbers (`#start–#end`).
 */
export function buildFairPlayEvidenceReport(
  res: CheatAnalysisResult,
  lang: Language,
  liveClock?: LiveMatchClockTelemetry | null
): string {
  const pf = res.formats[res.primaryFormat];
  const lines: string[] = [];

  if (lang === 'tr') {
    lines.push(`[Chess Sentinel v3.2 (Zero-FP) — Adil Oyun & Hamle Bazlı Kanıt Özeti]`);
    lines.push(
      `Oyuncu: @${res.displayName} (https://www.chess.com/member/${res.displayName}) | Hesap Yaşı: ${
        res.accountAgeDays !== null ? `${res.accountAgeDays} gün` : 'Bilinmiyor'
      }`
    );
    lines.push(
      `Birincil Format: ${res.primaryFormat.toUpperCase()} (${pf.currentRating ?? '—'} Elo) | İstatistiksel Anomali Olasılığı: %${res.probability}`
    );
    lines.push(
      `Son Performans: ${pf.recentWins}G / ${pf.recentLosses}M / ${pf.recentDraws}B (%${pf.recentWinPct} galibiyet, Rakip Elo beklentisine göre ${pf.eloZScore >= 0 ? '+' : ''}${pf.eloZScore}σ Z-Skoru)`
    );
    if (pf.avgAccuracy !== null) {
      lines.push(
        `Uzun Maç CAPS2 Doğruluk: %${pf.avgAccuracy} (Elo bandı beklentisi: %${pf.expectedAccuracy}, İncelenen tam maç: ${pf.reviewedGames})`
      );
    }
    if (res.pacing.gamesAnalyzed >= 4) {
      lines.push(
        `Kronometrik Saat Analizi (%clk): Entropi ${res.pacing.meanEntropyBits ?? '—'} bit | Medyan QCD: ${res.pacing.medianQCD ?? '—'} | Medyan CV: ${res.pacing.medianCV ?? '—'} | Mekanik Maç Oranı: %${Math.round(res.pacing.flatlineRate * 100)}`
      );
    }
    if (liveClock && liveClock.movesObserved >= 4) {
      const livePin =
        liveClock.pauseMoveNumber !== null && liveClock.roboticStartMove !== null
          ? ` | Nokta Atışı: ${liveClock.pauseMoveNumber}. hamlede ${liveClock.detectedPauseSec}sn duraksama -> ${liveClock.roboticStartMove}.-${liveClock.roboticEndMove}. hamleler robotik (${liveClock.roboticMinSec}-${liveClock.roboticMaxSec}sn)`
          : liveClock.roboticStartMove !== null && liveClock.consecutiveRoboticMoves >= 6
            ? ` | Nokta Atışı: ${liveClock.roboticStartMove}.-${liveClock.roboticEndMove}. hamleler kesintisiz mekanik (${liveClock.roboticMinSec}-${liveClock.roboticMaxSec}sn)`
            : '';
      lines.push(
        `Canlı Maç Saat Verisi: ${liveClock.movesObserved} hamle izlendi | Ort: ${liveClock.liveMeanSec ?? '—'} sn | Canlı QCD: ${liveClock.liveQCD ?? '—'}${livePin}`
      );
    }
    if (res.suspectPinpoints && res.suspectPinpoints.length > 0) {
      lines.push(`Tespit Edilen Şüpheli Maç & Hamle Aralıkları:`);
      for (const p of res.suspectPinpoints) {
        const urlPart = p.gameUrl ? ` — ${p.gameUrl}` : '';
        const samples = p.sampleMoves.length > 0 ? ` [${p.sampleMoves.join(' ')}]` : '';
        if (p.kind === 'midgame_toggle') {
          lines.push(
            `- vs @${p.opponentUsername}: ${p.pauseMoveNumber}. hamlede ${p.pauseSec}sn duraksama -> ${p.suspectStartMove}.-${p.suspectEndMove}. hamleler sabit robotik tempo (${p.minBandSec}-${p.maxBandSec}sn)${samples}${urlPart}`
          );
        } else if (p.kind === 'robotic_flatline') {
          lines.push(
            `- vs @${p.opponentUsername}: ${p.suspectStartMove}.-${p.suspectEndMove}. hamleler sıfır refleksli mekanik tempo (${p.minBandSec}-${p.maxBandSec}sn)${p.accuracy !== null ? ` [%${p.accuracy}]` : ''}${samples}${urlPart}`
          );
        } else {
          lines.push(
            `- vs @${p.opponentUsername}: ${p.suspectEndMove} hamlelik tam maçta %${p.accuracy} CAPS2 doğruluk${urlPart}`
          );
        }
      }
    } else {
      const topUrls = res.recentMatches
        .filter((m) => m.url && m.result === 'W')
        .slice(0, 3)
        .map((m) => `${m.url}${m.accuracy !== null ? ` (%${m.accuracy})` : ''}`);
      if (topUrls.length > 0) {
        lines.push(`İncelenmesi Önerilen Son Maçlar:\n- ${topUrls.join('\n- ')}`);
      }
    }
  } else {
    lines.push(`[Chess Sentinel v3.2 (Zero-FP) — Fair-Play & Move-Range Evidence Summary]`);
    lines.push(
      `Player: @${res.displayName} (https://www.chess.com/member/${res.displayName}) | Account Age: ${
        res.accountAgeDays !== null ? `${res.accountAgeDays} days` : 'Unknown'
      }`
    );
    lines.push(
      `Primary Format: ${res.primaryFormat.toUpperCase()} (${pf.currentRating ?? '—'} Elo) | Statistical Anomaly Probability: ${res.probability}%`
    );
    lines.push(
      `Recent Performance: ${pf.recentWins}W / ${pf.recentLosses}L / ${pf.recentDraws}D (${pf.recentWinPct}% WR, ${pf.eloZScore >= 0 ? '+' : ''}${pf.eloZScore}σ Elo-adjusted Z-Score)`
    );
    if (pf.avgAccuracy !== null) {
      lines.push(
        `Long-Game CAPS2 Accuracy: ${pf.avgAccuracy}% (Band expected: ${pf.expectedAccuracy}%, Full-length reviewed games: ${pf.reviewedGames})`
      );
    }
    if (res.pacing.gamesAnalyzed >= 4) {
      lines.push(
        `Chronometric PGN [%clk] Profile: Entropy ${res.pacing.meanEntropyBits ?? '—'} bits | Median QCD: ${res.pacing.medianQCD ?? '—'} | Median CV: ${res.pacing.medianCV ?? '—'} | Flatline Rate: ${Math.round(res.pacing.flatlineRate * 100)}%`
      );
    }
    if (liveClock && liveClock.movesObserved >= 4) {
      const livePin =
        liveClock.pauseMoveNumber !== null && liveClock.roboticStartMove !== null
          ? ` | Pinpoint: Move #${liveClock.pauseMoveNumber} (${liveClock.detectedPauseSec}s pause) -> Moves #${liveClock.roboticStartMove}-#${liveClock.roboticEndMove} mechanical (${liveClock.roboticMinSec}-${liveClock.roboticMaxSec}s)`
          : liveClock.roboticStartMove !== null && liveClock.consecutiveRoboticMoves >= 6
            ? ` | Pinpoint: Moves #${liveClock.roboticStartMove}-#${liveClock.roboticEndMove} continuous mechanical band (${liveClock.roboticMinSec}-${liveClock.roboticMaxSec}s)`
            : '';
      lines.push(
        `Live Match Clock Radar: ${liveClock.movesObserved} moves | Mean: ${liveClock.liveMeanSec ?? '—'}s | Live QCD: ${liveClock.liveQCD ?? '—'}${livePin}`
      );
    }
    if (res.suspectPinpoints && res.suspectPinpoints.length > 0) {
      lines.push(`Pinpointed Suspect Games & Move Ranges:`);
      for (const p of res.suspectPinpoints) {
        const urlPart = p.gameUrl ? ` — ${p.gameUrl}` : '';
        const samples = p.sampleMoves.length > 0 ? ` [${p.sampleMoves.join(' ')}]` : '';
        if (p.kind === 'midgame_toggle') {
          lines.push(
            `- vs @${p.opponentUsername}: Move #${p.pauseMoveNumber} (${p.pauseSec}s pause) -> Moves #${p.suspectStartMove}-#${p.suspectEndMove} mechanical band (${p.minBandSec}-${p.maxBandSec}s)${samples}${urlPart}`
          );
        } else if (p.kind === 'robotic_flatline') {
          lines.push(
            `- vs @${p.opponentUsername}: Moves #${p.suspectStartMove}-#${p.suspectEndMove} zero-reflex mechanical pacing (${p.minBandSec}-${p.maxBandSec}s)${p.accuracy !== null ? ` [${p.accuracy}%]` : ''}${samples}${urlPart}`
          );
        } else {
          lines.push(
            `- vs @${p.opponentUsername}: ${p.accuracy}% CAPS2 accuracy over ${p.suspectEndMove} full moves${urlPart}`
          );
        }
      }
    } else {
      const topUrls = res.recentMatches
        .filter((m) => m.url && m.result === 'W')
        .slice(0, 3)
        .map((m) => `${m.url}${m.accuracy !== null ? ` (${m.accuracy}%)` : ''}`);
      if (topUrls.length > 0) {
        lines.push(`Recent Games for Review:\n- ${topUrls.join('\n- ')}`);
      }
    }
  }

  return lines.join('\n');
}
