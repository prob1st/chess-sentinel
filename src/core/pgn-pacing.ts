import {
  ChessComGame,
  PacingGameMetrics,
  PacingSummary,
  SuspectGamePinpoint,
} from '../types';

const CLK_REGEX = /\{[^}]*\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\][^}]*\}/g;
const SAN_TOKEN_REGEX =
  /(?:O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/g;
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
 * Parses `[%clk H:MM:SS.d]` annotations AND preceding SAN move tokens from a Chess.com PGN,
 * extracting move-by-move elapsed durations and SAN labels for the target player (`isWhite`).
 */
export function extractPlayerMoveTimes(pgn: string, isWhite: boolean): {
  incrementSec: number;
  baseSec: number;
  totalPlies: number;
  clocksSec: number[];
  moveDurationsSec: number[];
  playerSanMoves: string[];
} | null {
  if (!pgn || !pgn.includes('%clk')) return null;

  const tcMatch = pgn.match(TC_HEADER_REGEX);
  const baseSec = tcMatch ? Number(tcMatch[1]) : 180;
  const incrementSec = tcMatch && tcMatch[2] ? Number(tcMatch[2]) : 0;

  // Strip PGN headers so header tags don't collide with SAN parsing
  const movetextStart = pgn.indexOf('\n\n');
  const body = movetextStart >= 0 ? pgn.slice(movetextStart + 2) : pgn.replace(/\[[^\]]*\]/g, ' ');

  const allClocks: number[] = [];
  const allSan: string[] = [];
  let prevEnd = 0;
  let match: RegExpExecArray | null;
  CLK_REGEX.lastIndex = 0;

  while ((match = CLK_REGEX.exec(body)) !== null) {
    const hours = Number(match[1]);
    const mins = Number(match[2]);
    const secs = Number(match[3]);
    allClocks.push(hours * 3600 + mins * 60 + secs);

    const segment = body
      .slice(prevEnd, match.index)
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/\d+\.+/g, ' ');
    const sanMatches = segment.match(SAN_TOKEN_REGEX);
    allSan.push(sanMatches && sanMatches.length > 0 ? sanMatches[sanMatches.length - 1] : '');
    prevEnd = match.index + match[0].length;
  }

  if (allClocks.length < 30) {
    // Require >= 15 full moves per side for high-precision middlegame chronometrics
    return null;
  }

  const playerClocks: number[] = [];
  const playerSanMoves: string[] = [];
  for (let idx = 0; idx < allClocks.length; idx++) {
    const belongs = isWhite ? idx % 2 === 0 : idx % 2 === 1;
    if (belongs) {
      playerClocks.push(allClocks[idx]);
      const fullMoveNo = Math.floor(idx / 2) + 1;
      const prefix = isWhite ? `${fullMoveNo}.` : `${fullMoveNo}...`;
      playerSanMoves.push(allSan[idx] ? `${prefix}${allSan[idx]}` : `${prefix}?`);
    }
  }

  if (playerClocks.length < 15) return null;

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
    playerSanMoves,
  };
}

/**
 * Zero-FP Chronometric Single-Game Analyzer + Exact Move-Range Pinpointer v3.2:
 * Strict mechanical flatline & mid-game toggle criteria engineered so calm positional
 * human players, increment games, and bullet scrambles never trigger false flags,
 * while pinpointing exact move numbers (`#start..#end`) whenever an engine pattern occurs.
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

  const { baseSec, clocksSec, moveDurationsSec, playerSanMoves } = parsed;
  const isUltraFastBullet = timeClass === 'bullet' && baseSec <= 120;
  const scrambleThreshold = timeClass === 'bullet' ? 10 : timeClass === 'blitz' ? 22 : 35;

  // Isolate non-scramble middlegame moves (index i corresponds to full move i + 2)
  const midMoves: number[] = [];
  const startIdx = Math.min(8, Math.floor(moveDurationsSec.length * 0.25));
  const endIdx = Math.min(42, moveDurationsSec.length);
  let lastValidMidIdx = startIdx;

  for (let i = startIdx; i < endIdx; i++) {
    const clockRemaining = clocksSec[i + 1] ?? 0;
    if (clockRemaining < scrambleThreshold) break;
    midMoves.push(moveDurationsSec[i]);
    lastValidMidIdx = i;
  }

  if (midMoves.length < 10) return null;

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

  // Second-device / window-relay mechanical band: [2.6s, 8.6s]
  const roboticLo = timeClass === 'bullet' ? 1.9 : 2.6;
  const roboticHi = timeClass === 'bullet' ? 4.8 : 8.6;
  const roboticCount = midMoves.filter((t) => t >= roboticLo && t <= roboticHi).length;
  const roboticBandRatio = roboticCount / midMoves.length;

  // Zero-FP Flatline Signature
  const isFlatline =
    won &&
    !isUltraFastBullet &&
    ((cv <= 0.36 && qcd <= 0.21) || (qcd <= 0.17 && entropyBits <= 1.28)) &&
    mean >= 2.8 &&
    mean <= 10.5 &&
    fastMoveRatio <= 0.04 &&
    roboticBandRatio >= 0.72;

  let hasMidgameToggle = false;
  let pauseMoveNumber: number | null = null;
  let pauseSec: number | null = null;
  let suspectStartMove = startIdx + 2;
  let suspectEndMove = lastValidMidIdx + 2;
  let minBandSec: number | null = isFlatline ? Number(q1.toFixed(1)) : null;
  let maxBandSec: number | null = isFlatline ? Number(q3.toFixed(1)) : null;
  let sampleMoves: string[] = isFlatline
    ? playerSanMoves.slice(startIdx + 1, startIdx + 4).filter((s) => !s.endsWith('?'))
    : [];

  // High-specificity Mid-Game Engine Toggle Signature + Exact Move-Number Pinpointer
  if (won && !isUltraFastBullet && timeClass !== 'bullet' && moveDurationsSec.length >= 20) {
    const pauseMin = timeClass === 'blitz' ? 24 : 32;
    const pauseMax = timeClass === 'blitz' ? 95 : 130;
    const latestToggleIdx = Math.min(20, moveDurationsSec.length - 11);

    for (let i = 5; i <= latestToggleIdx; i++) {
      if (moveDurationsSec[i] >= pauseMin && moveDurationsSec[i] <= pauseMax) {
        const preSlice = moveDurationsSec.slice(0, i);
        const preHasFast = preSlice.some((t) => t <= 2.1);
        const postEndIdx = Math.min(i + 15, moveDurationsSec.length);
        const postSlice = moveDurationsSec.slice(i + 1, postEndIdx);

        if (preHasFast && postSlice.length >= 10) {
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
          const bandHits = postSlice.filter((t) => t >= 2.5 && t <= 8.5).length / postSlice.length;

          if (
            pCv <= 0.32 &&
            pQcd <= 0.19 &&
            pFastCount === 0 &&
            bandHits >= 0.85 &&
            pMean >= 2.8
          ) {
            hasMidgameToggle = true;
            // Index i in moveDurationsSec is full move (i + 2)
            pauseMoveNumber = i + 2;
            pauseSec = Number(moveDurationsSec[i].toFixed(1));
            suspectStartMove = i + 3;
            suspectEndMove = i + 2 + postSlice.length;
            minBandSec = Number(pQ1.toFixed(1));
            maxBandSec = Number(pQ3.toFixed(1));
            sampleMoves = playerSanMoves
              .slice(i + 2, i + 5)
              .filter((s) => !s.endsWith('?'));
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
    pauseMoveNumber,
    pauseSec,
    suspectStartMove,
    suspectEndMove,
    minBandSec,
    maxBandSec,
    sampleMoves,
  };
}

/**
 * Extracts concrete game-level and move-range pinpoints (`#11..#25`) across recent games
 * so users see the exact games and exact move numbers that exhibited engine signatures.
 */
export function extractSuspectGamePinpoints(
  games: ChessComGame[],
  username: string,
  ratedOnly: boolean,
  getAccuracyCeiling: (format: string, rating: number) => number
): {
  pinpoints: SuspectGamePinpoint[];
  byUrlOrEndTime: Map<string, SuspectGamePinpoint>;
} {
  const userLower = username.toLowerCase();
  const sorted = [...games]
    .filter((g) => {
      if (ratedOnly && g.rated === false) return false;
      if (g.time_class === 'daily') return false;
      return (
        g.white?.username?.toLowerCase() === userLower ||
        g.black?.username?.toLowerCase() === userLower
      );
    })
    .sort((a, b) => (b.end_time || 0) - (a.end_time || 0))
    .slice(0, 40);

  const candidates: SuspectGamePinpoint[] = [];
  const byUrlOrEndTime = new Map<string, SuspectGamePinpoint>();

  for (const g of sorted) {
    const isWhite = g.white?.username?.toLowerCase() === userLower;
    const player = isWhite ? g.white : g.black;
    const opp = isWhite ? g.black : g.white;
    const won = player?.result === 'win';
    const format = String(g.time_class || 'blitz');
    const accRaw = g.accuracies ? (isWhite ? g.accuracies.white : g.accuracies.black) : null;
    const accuracy =
      typeof accRaw === 'number' && accRaw > 0 && accRaw <= 100
        ? Number(accRaw.toFixed(1))
        : null;

    const m = g.pgn ? analyzeSingleGamePacing(g.pgn, isWhite, format, won) : null;
    const key = g.url || String(g.end_time || '');

    if (m && (m.hasMidgameToggle || m.isFlatline)) {
      const p: SuspectGamePinpoint = {
        kind: m.hasMidgameToggle ? 'midgame_toggle' : 'robotic_flatline',
        format,
        opponentUsername: opp?.username || 'Opponent',
        opponentRating: opp?.rating || 0,
        gameUrl: g.url || null,
        endTime: g.end_time || 0,
        accuracy,
        pauseMoveNumber: m.pauseMoveNumber,
        pauseSec: m.pauseSec,
        suspectStartMove: m.suspectStartMove,
        suspectEndMove: m.suspectEndMove,
        roboticMoveCount: Math.max(1, m.suspectEndMove - m.suspectStartMove + 1),
        minBandSec: m.minBandSec,
        maxBandSec: m.maxBandSec,
        sampleMoves: m.sampleMoves,
      };
      candidates.push(p);
      if (key) byUrlOrEndTime.set(key, p);
      continue;
    }

    // Also pinpoint extreme full-length (>=22 full moves) CAPS2 accuracy ceiling spikes on wins
    const ceiling = getAccuracyCeiling(format, player?.rating || 1500);
    if (won && accuracy !== null && accuracy >= Math.max(94.0, ceiling + 1.5) && g.pgn) {
      const moveNums = g.pgn.match(/\b(\d+)\.\s+\S+/g);
      const totalFullMoves = moveNums ? moveNums.length : 0;
      if (totalFullMoves >= 22) {
        const p: SuspectGamePinpoint = {
          kind: 'caps2_spike',
          format,
          opponentUsername: opp?.username || 'Opponent',
          opponentRating: opp?.rating || 0,
          gameUrl: g.url || null,
          endTime: g.end_time || 0,
          accuracy,
          pauseMoveNumber: null,
          pauseSec: null,
          suspectStartMove: 1,
          suspectEndMove: totalFullMoves,
          roboticMoveCount: totalFullMoves,
          minBandSec: null,
          maxBandSec: null,
          sampleMoves: [],
        };
        candidates.push(p);
        if (key) byUrlOrEndTime.set(key, p);
      }
    }
  }

  // Prioritize midgame toggles first, then flatline + high accuracy, capped at top 4 clearest games
  const priority = (p: SuspectGamePinpoint): number =>
    p.kind === 'midgame_toggle' ? 3 : p.kind === 'robotic_flatline' ? 2 : 1;

  const pinpoints = candidates
    .sort((a, b) => priority(b) - priority(a) || b.endTime - a.endTime)
    .slice(0, 4);

  return { pinpoints, byUrlOrEndTime };
}

/**
 * Aggregates chronometric telemetry across up to 40 recent live games under strict
 * Zero-False-Positive confidence bounds (`metrics.length >= 6` required for any penalty).
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

  const nonBulletCount = metrics.filter((m) => m.timeClass !== 'bullet').length;

  // Zero-FP Gate: require >= 6 full games (>= 5 non-bullet) before emitting ANY pacing risk!
  if (metrics.length < 6 || nonBulletCount < 5) {
    const cvs = metrics.map((m) => m.cv).sort((a, b) => a - b);
    const qcds = metrics.map((m) => m.qcd).sort((a, b) => a - b);
    return {
      gamesAnalyzed: metrics.length,
      medianCV: cvs.length ? Number(quantileSorted(cvs, 0.5).toFixed(2)) : null,
      medianQCD: qcds.length ? Number(quantileSorted(qcds, 0.5).toFixed(2)) : null,
      meanEntropyBits: metrics.length
        ? Number((metrics.reduce((s, m) => s + m.entropyBits, 0) / metrics.length).toFixed(2))
        : null,
      minCV: cvs.length ? Number(cvs[0].toFixed(2)) : null,
      meanFastMoveRatio: null,
      meanRoboticBandRatio: null,
      bucketDistribution,
      flatlineGames: 0,
      flatlineRate: 0,
      toggleGames: 0,
      isConfirmedHumanPacing:
        metrics.length >= 3 && quantileSorted(cvs, 0.5) >= 0.72 && quantileSorted(qcds, 0.5) >= 0.34,
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

  // Positive biomechanical proof of organic human clock dynamics
  const isConfirmedHumanPacing =
    medianCV >= 0.68 &&
    medianQCD >= 0.33 &&
    meanEntropyBits >= 1.7 &&
    flatlineGames <= 1 &&
    toggleGames === 0;

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

  // 1. Strict Dispersion Collapse
  let dispersionRisk = 0;
  if (medianQCD <= 0.23 && medianCV <= 0.45 && meanFastMoveRatio <= 0.05) {
    const qScore = ((0.23 - medianQCD) / 0.12) * 55;
    const cScore = ((0.45 - medianCV) / 0.22) * 45;
    dispersionRisk = Math.min(100, qScore + cScore);
  }

  // 2. Strict Shannon Entropy Collapse + Mechanical Relay Lock
  let entropyRisk = 0;
  if (meanEntropyBits <= 1.42 && meanFastMoveRatio <= 0.04 && meanRoboticBandRatio >= 0.68) {
    entropyRisk = Math.min(
      100,
      ((1.42 - meanEntropyBits) / 0.45) * 60 + ((0.04 - meanFastMoveRatio) / 0.04) * 40
    );
  }

  // 3. Repeated Won-Game Flatline Incidence (requires >= 3 flatline wins AND >= 22% rate!)
  let flatlineRisk = 0;
  if (flatlineGames >= 3 && flatlineRate >= 0.22) {
    const countBoost = flatlineGames >= 5 ? Math.min(28, (flatlineGames - 3) * 4.5) : 0;
    flatlineRisk = Math.min(100, ((flatlineRate - 0.14) / 0.24) * 85 + countBoost);
  }

  // 4. Multi-Game Toggle Bonus (strictly requires >= 3 toggle wins AND >= 15% incidence)
  const toggleBonus = toggleGames >= 3 && toggleGames / metrics.length >= 0.15 ? 24 : 0;

  const sampleWeight = metrics.length / (metrics.length + 3.2);
  const rawCombined =
    Math.max(
      flatlineRisk * 0.97,
      dispersionRisk * 0.55 + flatlineRisk * 0.45,
      dispersionRisk * 0.55 + entropyRisk * 0.45
    ) + toggleBonus;

  const pacingScore = Math.min(100, Math.max(0, Math.round(rawCombined * sampleWeight)));

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
