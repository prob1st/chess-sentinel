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

function sampleWeight(n: number, k = 16): number {
  if (n <= 0) return 0;
  return n / (n + k);
}

/**
 * Evaluates win-rate deviation above the 50% Glicko equilibrium,
 * smoothed by Bayesian sample weight `n / (n + k)`.
 */
export function computeWinrateSignal(wins: number, total: number, k = 16): number {
  if (total < 3) return 0;
  const wr = wins / total;
  if (wr <= 0.51) return 0;

  let raw = 0;
  if (wr <= 0.58) {
    raw = ((wr - 0.51) / 0.07) * 32;
  } else if (wr <= 0.66) {
    raw = 32 + ((wr - 0.58) / 0.08) * 38;
  } else if (wr <= 0.75) {
    raw = 70 + ((wr - 0.66) / 0.09) * 30;
  } else {
    raw = 100 + ((wr - 0.75) / 0.10) * 35;
  }

  return Math.min(100, Math.round(raw * sampleWeight(total, k)));
}

/**
 * Evaluates CAPS2 accuracy anomaly against empirically calibrated Elo-band expectations.
 */
export function computeAccuracySignal(
  avgAccuracy: number | null,
  expected: number,
  highAccRate: number,
  reviewedGames: number
): number {
  if (avgAccuracy === null || reviewedGames < 2) return 0;

  const excess = avgAccuracy - expected;
  let excessScore = 0;
  if (excess > 0.5) {
    if (excess <= 4) excessScore = ((excess - 0.5) / 3.5) * 35;
    else if (excess <= 8) excessScore = 35 + ((excess - 4) / 4) * 40;
    else excessScore = Math.min(105, 75 + ((excess - 8) / 5) * 30);
  }

  let spikeScore = 0;
  if (highAccRate > 0.12) {
    if (highAccRate <= 0.28) spikeScore = ((highAccRate - 0.12) / 0.16) * 50;
    else if (highAccRate <= 0.45) spikeScore = 50 + ((highAccRate - 0.28) / 0.17) * 40;
    else spikeScore = Math.min(105, 90 + ((highAccRate - 0.45) / 0.25) * 20);
  }

  const conf = sampleWeight(reviewedGames, 8);
  return Math.min(100, Math.round((0.6 * excessScore + 0.4 * spikeScore) * conf));
}

/**
 * Evaluates vertical Elo surge (7d and 30d rating jumps) and consecutive win streaks.
 */
export function computeEloVelocitySignal(
  eloDelta7d: number | null,
  eloDelta30d: number | null,
  winStreak: number,
  rd: number | null
): number {
  // High RD (>130) indicates provisional rating swings are somewhat expected
  const rdDamper = rd !== null && rd > 130 ? 0.65 : 1.0;

  let surge7 = 0;
  if (eloDelta7d !== null && eloDelta7d > 55) {
    surge7 = Math.min(100, ((eloDelta7d - 55) / 185) * 95) * rdDamper;
  }

  let surge30 = 0;
  if (eloDelta30d !== null && eloDelta30d > 95) {
    surge30 = Math.min(100, ((eloDelta30d - 95) / 260) * 90) * rdDamper;
  }

  let streakScore = 0;
  if (winStreak >= 6) {
    streakScore = Math.min(95, ((winStreak - 5) / 10) * 85);
  }

  return Math.min(100, Math.round(Math.max(surge7, surge30 * 0.9) * 0.72 + streakScore * 0.45));
}

/**
 * Evaluates account age, Elo-to-age ratio, and live-vs-tactics skill gap.
 */
export function computeAccountTrustSignal(
  accountAgeDays: number | null,
  bestLiveRating: number,
  lifetimeGames: number,
  stats: ChessComStats
): { trustRiskScore: number; ageMultiplier: number; tacticsGapRating: number | null } {
  let ageRisk = 0;
  let ageMultiplier = 1.0;

  if (accountAgeDays !== null) {
    if (accountAgeDays <= 7) {
      ageRisk = 92;
      ageMultiplier = 1.52;
    } else if (accountAgeDays <= 14) {
      ageRisk = 78;
      ageMultiplier = 1.40;
    } else if (accountAgeDays <= 30) {
      ageRisk = 64;
      ageMultiplier = 1.30;
    } else if (accountAgeDays <= 90) {
      ageRisk = 46;
      ageMultiplier = 1.18;
    } else if (accountAgeDays <= 180) {
      ageRisk = 28;
      ageMultiplier = 1.09;
    } else if (accountAgeDays <= 365) {
      ageRisk = 14;
      ageMultiplier = 1.03;
    } else if (accountAgeDays >= 1095 && lifetimeGames >= 800) {
      ageRisk = 0;
      ageMultiplier = 0.90; // Veteran honest baseline dampener
    }
  }

  // Fresh account already at high Elo (>= 1650 within 60 days)
  if (accountAgeDays !== null && accountAgeDays <= 75 && bestLiveRating >= 1650) {
    const ratingExcess = Math.min(25, ((bestLiveRating - 1600) / 600) * 25);
    ageRisk = Math.min(100, ageRisk + ratingExcess);
    ageMultiplier = Math.min(1.68, ageMultiplier + 0.14);
  }

  // Check Live Rating vs Tactics Rating huge discrepancy (common in burner cheat accounts)
  const tacticsHighest = stats.tactics?.highest?.rating ?? null;
  let tacticsGapRating: number | null = null;
  if (
    bestLiveRating >= 1850 &&
    tacticsHighest !== null &&
    tacticsHighest > 0 &&
    bestLiveRating - tacticsHighest >= 900
  ) {
    tacticsGapRating = tacticsHighest;
    ageRisk = Math.min(100, ageRisk + 26);
  }

  return {
    trustRiskScore: Math.round(ageRisk),
    ageMultiplier,
    tacticsGapRating,
  };
}

function extractCountryCode(countryUrl?: string): string | null {
  if (!countryUrl) return null;
  const parts = countryUrl.split('/').filter(Boolean);
  const code = parts[parts.length - 1];
  return code && code.length === 2 ? code.toUpperCase() : null;
}

function buildFormatTelemetry(
  format: TimeClass,
  stats: ChessComStats,
  games: ChessComGame[],
  usernameLower: string,
  ratedOnly: boolean,
  nowSec: number
): FormatTelemetry {
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
  let accSum = 0;
  let reviewedGames = 0;
  let highAccCount = 0;

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
    if (!player) continue;

    if (player.result === 'win') recentWins++;
    else if (['checkmated', 'resigned', 'timeout', 'abandoned', 'lose'].includes(player.result)) {
      recentLosses++;
    } else {
      recentDraws++;
    }

    const acc = g.accuracies ? (isWhite ? g.accuracies.white : g.accuracies.black) : null;
    if (typeof acc === 'number' && !Number.isNaN(acc)) {
      reviewedGames++;
      accSum += acc;
      if (acc >= band.ceiling) highAccCount++;
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

  const eloDelta7d =
    oldest7Rating !== null && newest7Rating !== null && newest7Ts > oldest7Ts
      ? newest7Rating - oldest7Rating
      : null;
  const eloDelta30d =
    oldest30Rating !== null && newest30Rating !== null && newest30Ts > oldest30Ts
      ? newest30Rating - oldest30Rating
      : null;

  return {
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
    eloDelta7d,
    eloDelta30d,
    formatProbability: 0,
  };
}

export interface AnalyzeOptions {
  preferredFormat?: TimeClass;
  ratedOnly?: boolean;
  sensitivity?: SensitivityPreset;
  nowMs?: number;
}

/**
 * Primary 6-Signal Forensic Cheat Probability Engine (`0% - 100%`).
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
  const displayName = profile.username || bundle.username;
  const accountStatus = profile.status || 'basic';
  const isBannedFairPlay = accountStatus.toLowerCase().includes('fair_play_violations');

  const accountAgeDays = profile.joined
    ? Math.max(0, Math.round((nowSec - profile.joined) / 86400))
    : null;

  // Sort games newest first for streak & form chips
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

  // Compute PGN [%clk] Pacing Telemetry across live games
  const pacing = computeAggregatePacing(validGames, usernameLower, ratedOnly);

  // Build telemetry per format
  const formats = {} as Record<TimeClass, FormatTelemetry>;
  let bestLiveRating = 0;
  let lifetimeGames = 0;

  for (const fmt of ALL_FORMATS) {
    const ft = buildFormatTelemetry(fmt, stats, validGames, usernameLower, ratedOnly, nowSec);
    formats[fmt] = ft;
    lifetimeGames += ft.overallTotal;
    if (fmt !== 'daily' && (ft.currentRating || 0) > bestLiveRating) {
      bestLiveRating = ft.currentRating || 0;
    }
  }

  const { trustRiskScore, ageMultiplier, tacticsGapRating } = computeAccountTrustSignal(
    accountAgeDays,
    bestLiveRating,
    lifetimeGames,
    stats
  );

  const titleDampener = getTitleDampener(profile.title);
  const sensitivityMult = SENSITIVITY_MULTIPLIERS[sensitivity] ?? 1.0;

  // Score each live format individually
  const formatBreakdowns: Record<TimeClass, SignalBreakdown> = {} as Record<
    TimeClass,
    SignalBreakdown
  >;

  for (const fmt of ALL_FORMATS) {
    const ft = formats[fmt];
    const rwr = computeWinrateSignal(ft.recentWins, ft.recentTotal, 14);
    const owr = computeWinrateSignal(ft.overallWins, ft.overallTotal, 22);
    const acc = computeAccuracySignal(
      ft.avgAccuracy,
      ft.expectedAccuracy,
      ft.highAccRate,
      ft.reviewedGames
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

    // Dynamic Bayesian weight allocation:
    // If Game Review CAPS2 data is absent (<2 reviewed games), redistribute its weight
    // proportionally to Recent Winrate, PGN Move Pacing, and Overall Winrate!
    const hasAcc = ft.reviewedGames >= 2;
    const hasPacing = fmt !== 'daily' && pacing.gamesAnalyzed >= 3;

    let wRwr = 0.25;
    let wOwr = 0.16;
    let wAcc = hasAcc ? 0.25 : 0;
    let wPace = hasPacing ? 0.18 : 0;
    let wVel = 0.08;
    let wTrust = 0.08;

    const activeWeightSum = wRwr + wOwr + wAcc + wPace + wVel + wTrust;
    wRwr /= activeWeightSum;
    wOwr /= activeWeightSum;
    wAcc /= activeWeightSum;
    wPace /= activeWeightSum;
    wVel /= activeWeightSum;
    wTrust /= activeWeightSum;

    const weightedCore =
      wRwr * rwr + wOwr * owr + wAcc * acc + wPace * pace + wVel * vel + wTrust * trustRiskScore;

    // Synergy boost when >= 2 independent strong signals align (e.g. high winrate + robotic pacing)
    const strongSignals = [rwr >= 60, owr >= 58, acc >= 60, pace >= 55, trustRiskScore >= 65].filter(
      Boolean
    ).length;
    const synergyMultiplier = strongSignals >= 3 ? 1.22 : strongSignals === 2 ? 1.10 : 1.0;

    const rawProb =
      weightedCore * ageMultiplier * synergyMultiplier * titleDampener * sensitivityMult;

    const floor = profile.title ? 1 : 3;
    ft.formatProbability =
      ft.overallTotal < 3 && ft.recentTotal < 3
        ? floor
        : Math.min(99, Math.max(floor, Math.round(rawProb)));
  }

  // Choose primary format: preferred format if active, otherwise highest-risk active live format
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
    (formats[options.preferredFormat].recentTotal >= 3 ||
      formats[options.preferredFormat].overallTotal >= 5)
  ) {
    primaryFormat = options.preferredFormat;
  } else if (maxFormatProb > 0) {
    primaryFormat = maxFormat;
  } else {
    // Pick whichever format has most games
    primaryFormat =
      LIVE_FORMATS.slice().sort((a, b) => formats[b].overallTotal - formats[a].overallTotal)[0] ||
      'blitz';
  }

  let probability = formats[primaryFormat].formatProbability;
  // Cross-format bleed: if preferred format is quiet (e.g. 5 blitz games) while rapid is 90% cheater
  if (primaryFormat !== maxFormat && maxFormatProb > probability + 18) {
    probability = Math.round(probability * 0.45 + maxFormatProb * 0.55);
    primaryFormat = maxFormat;
  }

  if (isBannedFairPlay) {
    probability = 100;
  }

  const signals = formatBreakdowns[primaryFormat];
  const pf = formats[primaryFormat];

  // Determine telemetry confidence
  const totalSample = pf.recentTotal + Math.min(30, pf.overallTotal);
  let confidence: ConfidenceLevel = 'low';
  if (isBannedFairPlay || (totalSample >= 25 && (pacing.gamesAnalyzed >= 5 || pf.reviewedGames >= 4))) {
    confidence = 'high';
  } else if (totalSample >= 10) {
    confidence = 'medium';
  }

  // Build human-readable Forensic Insight Flags (sorted by importance)
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

  if (accountAgeDays !== null && accountAgeDays <= 45 && (pf.currentRating || 0) >= 1650) {
    flags.push({
      id: 'fresh_high_elo',
      severity: 'danger',
      icon: '🆕',
      params: { days: Math.max(1, accountAgeDays), rating: pf.currentRating || 0 },
    });
  } else if (accountAgeDays !== null && accountAgeDays <= 30) {
    flags.push({
      id: 'fresh_account',
      severity: 'warning',
      icon: '🆕',
      params: { days: Math.max(1, accountAgeDays) },
    });
  }

  if (pf.recentTotal >= 8 && pf.recentWinPct >= 68) {
    flags.push({
      id: 'extreme_recent_wr',
      severity: 'danger',
      icon: '🚩',
      params: { games: pf.recentTotal, wr: pf.recentWinPct },
    });
  } else if (pf.recentTotal >= 8 && pf.recentWinPct >= 58) {
    flags.push({
      id: 'elevated_recent_wr',
      severity: 'warning',
      icon: '📈',
      params: { games: pf.recentTotal, wr: pf.recentWinPct },
    });
  }

  if (pf.reviewedGames >= 3 && pf.avgAccuracy !== null && pf.avgAccuracy - pf.expectedAccuracy >= 3.5) {
    const excess = Number((pf.avgAccuracy - pf.expectedAccuracy).toFixed(1));
    flags.push({
      id: 'accuracy_excess',
      severity: excess >= 6.5 ? 'danger' : 'warning',
      icon: '🎯',
      params: { excess, avg: pf.avgAccuracy },
    });
  }

  if (pf.reviewedGames >= 4 && pf.highAccRate >= 0.25) {
    flags.push({
      id: 'accuracy_spikes',
      severity: pf.highAccRate >= 0.4 ? 'danger' : 'warning',
      icon: '⚡',
      params: { games: pf.reviewedGames, rate: Math.round(pf.highAccRate * 100), ceil: pf.highAccCeiling },
    });
  }

  if (pacing.gamesAnalyzed >= 4 && pacing.pacingScore >= 48 && pacing.medianCV !== null) {
    flags.push({
      id: 'robotic_pacing',
      severity: pacing.pacingScore >= 70 ? 'danger' : 'warning',
      icon: '⏱️',
      params: { cv: pacing.medianCV },
    });
  }

  if (pacing.toggleGames >= 1) {
    flags.push({
      id: 'midgame_toggle',
      severity: pacing.toggleGames >= 2 ? 'danger' : 'warning',
      icon: '🤖',
      params: { count: pacing.toggleGames },
    });
  }

  if (pf.eloDelta7d !== null && pf.eloDelta7d >= 85) {
    flags.push({
      id: 'elo_surge',
      severity: pf.eloDelta7d >= 160 ? 'danger' : 'warning',
      icon: '🚀',
      params: { delta: pf.eloDelta7d },
    });
  }

  if (winStreak >= 6) {
    flags.push({
      id: 'hot_streak',
      severity: winStreak >= 10 ? 'danger' : 'warning',
      icon: '🔥',
      params: { streak: winStreak },
    });
  }

  if (tacticsGapRating !== null && (pf.currentRating || bestLiveRating) >= 1850) {
    flags.push({
      id: 'tactics_gap',
      severity: 'warning',
      icon: '🧩',
      params: { rating: pf.currentRating || bestLiveRating, tactics: tacticsGapRating },
    });
  }

  // Positive reassurance flags when risk is low
  if (!isBannedFairPlay && probability < 28) {
    if (pacing.medianCV !== null && pacing.medianCV >= 0.72) {
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
