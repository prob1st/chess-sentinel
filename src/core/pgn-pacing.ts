import { ChessComGame, PacingGameMetrics, PacingSummary } from '../types';

const CLK_REGEX = /\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g;
const TC_HEADER_REGEX = /\[TimeControl\s+"(\d+)(?:\+(\d+))?"\]/;

// 7 logarithmic human move-time buckets (max theoretical entropy = log2(7) ≈ 2.807 bits)
const LOG_TIME_BINS = [0.9, 1.8, 3.2, 5.5, 9.5, 18.0];

function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function computeLogTimeBuckets(durations: number[]): { counts: number[]; entropyBits: number } {
  const counts = new Array<number>(LOG_TIME_BINS.length + 1).fill(0);
  if (durations.length === 0) return { counts, entropyBits: 0 };

  for (const d of durations) {
    let placed = false;
    for (let i = 0; i < LOG_TIME_BINS.length; i++) {
      if (d < LOG_TIME_BINS[i]) {
        counts[i]++;
        placed = true;
        break;
      }
    }
    if (!placed) counts[LOG_TIME_BINS.length]++;
  }

  let entropy = 0;
  const n = durations.length;
  for (const c of counts) {
    if (c > 0) {
      const p = c / n;
      entropy -= p * Math.log2(p);
    }
  }
  return { counts, entropyBits: entropy };
}

/**
 * Parses `[%clk H:MM:SS.d]` annotations from a Chess.com PGN and extracts
 * move-by-move elapsed durations for the target player (`isWhite`).
 */
export function extractPlayerMoveTimes(pgn: string, isWhite: boolean): {
  incrementSec: number;
  baseSec: number;
  totalPlies: number;
  clocksSec: number[];
  moveDurationsSec: number[];
} | null {
  if (!pgn || !pgn.includes('%clk')) return null;

  const tcMatch = pgn.match(TC_HEADER_REGEX);
  const baseSec = tcMatch ? Number(tcMatch[1]) : 180;
  const incrementSec = tcMatch && tcMatch[2] ? Number(tcMatch[2]) : 0;

  const allClocks: number[] = [];
  let match: RegExpExecArray | null;
  CLK_REGEX.lastIndex = 0;
  while ((match = CLK_REGEX.exec(pgn)) !== null) {
    const hours = Number(match[1]);
    const mins = Number(match[2]);
    const secs = Number(match[3]);
    allClocks.push(hours * 3600 + mins * 60 + secs);
  }

  if (allClocks.length < 26) {
    // Require >= 13 moves per side for reliable middlegame chronometrics
    return null;
  }

  const playerClocks = allClocks.filter((_, idx) => (isWhite ? idx % 2 === 0 : idx % 2 === 1));
  if (playerClocks.length < 13) return null;

  const moveDurationsSec: number[] = [];
  for (let i = 1; i < playerClocks.length; i++) {
    const rawElapsed = playerClocks[i - 1] - playerClocks[i] + incrementSec;
    const cleanElapsed = Math.min(240, Math.max(0.1, Number(rawElapsed.toFixed(2))));
    moveDurationsSec.push(cleanElapsed);
  }

  return {
    incrementSec,
    baseSec,
    totalPlies: allClocks.length,
    clocksSec: playerClocks,
    moveDurationsSec,
  };
}

/**
 * Analyzes a single game's chronometric profile using:
 * - Coefficient of Variation (CV = std / mean)
 * - Quartile Coefficient of Dispersion (QCD = (Q3 - Q1) / (Q3 + Q1)) — outlier-immune!
 * - 7-Bin Logarithmic Shannon Entropy (bits)
 * - Instinctive fast-recapture ratio vs mechanical Stockfish relay window
 * - High-specificity Mid-Game Engine Launch Toggle detector
 */
export function analyzeSingleGamePacing(
  pgn: string,
  isWhite: boolean,
  timeClass: string,
  won: boolean
): PacingGameMetrics | null {
  if (timeClass === 'daily') return null;

  const parsed = extractPlayerMoveTimes(pgn, isWhite);
  if (!parsed) return null;

  const { baseSec, clocksSec, moveDurationsSec } = parsed;
  const isUltraFastBullet = timeClass === 'bullet' && baseSec <= 120;
  const scrambleThreshold = timeClass === 'bullet' ? 9 : timeClass === 'blitz' ? 20 : 30;

  // Isolate non-scramble middlegame moves (move 9 through move 40)
  const midMoves: number[] = [];
  const startIdx = Math.min(8, Math.floor(moveDurationsSec.length * 0.25));
  const endIdx = Math.min(40, moveDurationsSec.length);

  for (let i = startIdx; i < endIdx; i++) {
    const clockRemaining = clocksSec[i + 1] ?? 0;
    if (clockRemaining < scrambleThreshold) break;
    midMoves.push(moveDurationsSec[i]);
  }

  if (midMoves.length < 9) return null;

  const mean = midMoves.reduce((sum, v) => sum + v, 0) / midMoves.length;
  const variance = midMoves.reduce((sum, v) => sum + (v - mean) ** 2, 0) / midMoves.length;
  const std = Math.sqrt(variance);
  const cv = mean > 0 ? std / mean : 1;

  const sortedMid = [...midMoves].sort((a, b) => a - b);
  const q1 = quantileSorted(sortedMid, 0.25);
  const q3 = quantileSorted(sortedMid, 0.75);
  const qcd = q3 + q1 > 0 ? (q3 - q1) / (q3 + q1) : 0;

  const { counts: bucketCounts, entropyBits } = computeLogTimeBuckets(midMoves);

  const fastThreshold = timeClass === 'bullet' ? 1.0 : timeClass === 'blitz' ? 1.75 : 2.25;
  const fastCount = midMoves.filter((t) => t <= fastThreshold).length;
  const fastMoveRatio = fastCount / midMoves.length;

  // Second-device / window-relay mechanical band: [2.5s, 8.8s]
  const roboticLo = timeClass === 'bullet' ? 1.8 : 2.5;
  const roboticHi = timeClass === 'bullet' ? 4.8 : 8.8;
  const roboticCount = midMoves.filter((t) => t >= roboticLo && t <= roboticHi).length;
  const roboticBandRatio = roboticCount / midMoves.length;

  // In 1+0 / 2+0 bullet, clock physics compress move times naturally — never flag ultra-bullet as relay flatline
  const isFlatline =
    !isUltraFastBullet &&
    ((cv <= 0.40 && qcd <= 0.26) || (qcd <= 0.20 && entropyBits <= 1.38)) &&
    mean >= 2.7 &&
    mean <= 11.2 &&
    fastMoveRatio <= 0.06 &&
    roboticBandRatio >= 0.64;

  // High-specificity Mid-Game Engine Toggle Signature:
  // Normal opening with fast moves -> single 24s-115s pause -> >=9 consecutive low-QCD robotic moves -> win
  let hasMidgameToggle = false;
  if (won && !isUltraFastBullet && timeClass !== 'bullet' && moveDurationsSec.length >= 19) {
    const pauseMin = timeClass === 'blitz' ? 22 : 30;
    const pauseMax = timeClass === 'blitz' ? 95 : 130;
    const latestToggleIdx = Math.min(20, moveDurationsSec.length - 10);

    for (let i = 5; i <= latestToggleIdx; i++) {
      if (moveDurationsSec[i] >= pauseMin && moveDurationsSec[i] <= pauseMax) {
        const preSlice = moveDurationsSec.slice(0, i);
        const preHasFast = preSlice.some((t) => t <= 2.2);
        const postSlice = moveDurationsSec.slice(i + 1, Math.min(i + 14, moveDurationsSec.length));

        if (preHasFast && postSlice.length >= 9) {
          const pMean = postSlice.reduce((a, b) => a + b, 0) / postSlice.length;
          const pStd = Math.sqrt(
            postSlice.reduce((a, b) => a + (b - pMean) ** 2, 0) / postSlice.length
          );
          const pCv = pMean > 0 ? pStd / pMean : 1;
          const pSorted = [...postSlice].sort((a, b) => a - b);
          const pQ1 = quantileSorted(pSorted, 0.25);
          const pQ3 = quantileSorted(pSorted, 0.75);
          const pQcd = pQ3 + pQ1 > 0 ? (pQ3 - pQ1) / (pQ3 + pQ1) : 1;

          const pFastCount = postSlice.filter((t) => t <= 1.9).length;
          const bandHits = postSlice.filter((t) => t >= 2.3 && t <= 8.6).length / postSlice.length;

          if (
            pCv <= 0.36 &&
            pQcd <= 0.23 &&
            pFastCount === 0 &&
            bandHits >= 0.80 &&
            pMean >= 2.7
          ) {
            hasMidgameToggle = true;
            break;
          }
        }
      }
    }
  }

  return {
    timeClass,
    movesAnalyzed: midMoves.length,
    meanMoveSec: Number(mean.toFixed(2)),
    stdMoveSec: Number(std.toFixed(2)),
    cv: Number(cv.toFixed(3)),
    qcd: Number(qcd.toFixed(3)),
    entropyBits: Number(entropyBits.toFixed(2)),
    bucketCounts,
    fastMoveRatio: Number(fastMoveRatio.toFixed(3)),
    roboticBandRatio: Number(roboticBandRatio.toFixed(3)),
    isFlatline,
    hasMidgameToggle,
    won,
  };
}

/**
 * Aggregates chronometric telemetry across up to 40 recent live games.
 * Designed for ultra-low false positive rate on organic human play while isolating
 * consistent second-screen / overlay engine pacing.
 */
export function computeAggregatePacing(
  games: ChessComGame[],
  username: string,
  ratedOnly = true
): PacingSummary {
  const userLower = username.toLowerCase();
  const sorted = [...games]
    .filter((g) => {
      if (ratedOnly && g.rated === false) return false;
      if (!g.pgn || g.time_class === 'daily') return false;
      return (
        g.white?.username?.toLowerCase() === userLower ||
        g.black?.username?.toLowerCase() === userLower
      );
    })
    .sort((a, b) => (b.end_time || 0) - (a.end_time || 0))
    .slice(0, 40);

  const metrics: PacingGameMetrics[] = [];
  for (const g of sorted) {
    const isWhite = g.white?.username?.toLowerCase() === userLower;
    const playerObj = isWhite ? g.white : g.black;
    const won = playerObj?.result === 'win';
    const m = analyzeSingleGamePacing(g.pgn || '', isWhite, String(g.time_class || 'blitz'), won);
    if (m) metrics.push(m);
  }

  const totalBuckets = new Array<number>(LOG_TIME_BINS.length + 1).fill(0);
  let totalMoves = 0;
  for (const m of metrics) {
    for (let i = 0; i < totalBuckets.length; i++) {
      const c = m.bucketCounts[i] || 0;
      totalBuckets[i] += c;
      totalMoves += c;
    }
  }
  const bucketDistribution =
    totalMoves > 0
      ? totalBuckets.map((c) => Number((c / totalMoves).toFixed(3)))
      : new Array<number>(LOG_TIME_BINS.length + 1).fill(0);

  if (metrics.length < 4) {
    return {
      gamesAnalyzed: metrics.length,
      medianCV: null,
      medianQCD: null,
      meanEntropyBits: null,
      minCV: null,
      meanFastMoveRatio: null,
      meanRoboticBandRatio: null,
      bucketDistribution,
      flatlineGames: 0,
      flatlineRate: 0,
      toggleGames: 0,
      isConfirmedHumanPacing: false,
      pacingScore: 0,
    };
  }

  const cvs = metrics.map((m) => m.cv).sort((a, b) => a - b);
  const qcds = metrics.map((m) => m.qcd).sort((a, b) => a - b);
  const medianCV = Number(quantileSorted(cvs, 0.5).toFixed(2));
  const medianQCD = Number(quantileSorted(qcds, 0.5).toFixed(2));
  const minCV = Number(cvs[0].toFixed(2));

  const meanEntropyBits = Number(
    (metrics.reduce((s, m) => s + m.entropyBits, 0) / metrics.length).toFixed(2)
  );
  const meanFastMoveRatio = Number(
    (metrics.reduce((s, m) => s + m.fastMoveRatio, 0) / metrics.length).toFixed(3)
  );
  const meanRoboticBandRatio = Number(
    (metrics.reduce((s, m) => s + m.roboticBandRatio, 0) / metrics.length).toFixed(3)
  );

  const flatlineGames = metrics.filter((m) => m.isFlatline).length;
  const flatlineRate = Number((flatlineGames / metrics.length).toFixed(3));
  const toggleGames = metrics.filter((m) => m.hasMidgameToggle).length;

  // Bullet-heavy samples naturally have compressed time buckets; damp chronometric suspicion
  const nonBulletRatio =
    metrics.filter((m) => m.timeClass !== 'bullet').length / metrics.length;
  const formatDamper = nonBulletRatio < 0.35 ? 0.25 : 1.0;

  // Positive proof of natural human clock dynamics
  const isConfirmedHumanPacing =
    metrics.length >= 6 &&
    medianCV >= 0.78 &&
    medianQCD >= 0.38 &&
    meanEntropyBits >= 1.82 &&
    flatlineRate <= 0.06 &&
    toggleGames <= 1;

  if (isConfirmedHumanPacing) {
    return {
      gamesAnalyzed: metrics.length,
      medianCV,
      medianQCD,
      meanEntropyBits,
      minCV,
      meanFastMoveRatio,
      meanRoboticBandRatio,
      bucketDistribution,
      flatlineGames,
      flatlineRate,
      toggleGames,
      isConfirmedHumanPacing: true,
      pacingScore: 0,
    };
  }

  // 1. Dispersion collapse (requires BOTH low median QCD and low median CV)
  let dispersionRisk = 0;
  if (medianQCD < 0.32 && medianCV < 0.58) {
    const qScore = ((0.32 - medianQCD) / 0.16) * 55;
    const cScore = ((0.58 - medianCV) / 0.28) * 45;
    dispersionRisk = Math.min(100, qScore + cScore);
  }

  // 2. Entropy collapse + zero-instinct recapture deficit
  let entropyRisk = 0;
  if (meanEntropyBits < 1.65 && meanFastMoveRatio < 0.07 && meanRoboticBandRatio > 0.56) {
    entropyRisk = Math.min(
      100,
      ((1.65 - meanEntropyBits) / 0.55) * 55 + ((0.07 - meanFastMoveRatio) / 0.07) * 45
    );
  }

  // 3. Repeated flatline game incidence (requires >= 2 flatline games AND >= 16% rate)
  let flatlineRisk = 0;
  if (flatlineGames >= 2 && flatlineRate >= 0.16) {
    flatlineRisk = Math.min(100, ((flatlineRate - 0.12) / 0.32) * 98);
  }

  // 4. Multi-game toggle bonus (strictly requires >= 2 toggle games to eliminate 1-off noise!)
  const toggleBonus =
    toggleGames >= 3 ? 28 : toggleGames === 2 && toggleGames / metrics.length >= 0.1 ? 16 : 0;

  const sampleWeight = metrics.length / (metrics.length + 3);
  const rawCombined =
    Math.max(
      flatlineRisk * 0.92,
      dispersionRisk * 0.55 + flatlineRisk * 0.45,
      dispersionRisk * 0.55 + entropyRisk * 0.45
    ) + toggleBonus;

  const pacingScore = Math.min(
    100,
    Math.max(0, Math.round(rawCombined * sampleWeight * formatDamper))
  );

  return {
    gamesAnalyzed: metrics.length,
    medianCV,
    medianQCD,
    meanEntropyBits,
    minCV,
    meanFastMoveRatio,
    meanRoboticBandRatio,
    bucketDistribution,
    flatlineGames,
    flatlineRate,
    toggleGames,
    isConfirmedHumanPacing: false,
    pacingScore,
  };
}
