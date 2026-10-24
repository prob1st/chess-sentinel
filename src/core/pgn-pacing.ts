import { ChessComGame, PacingGameMetrics, PacingSummary } from '../types';

const CLK_REGEX = /\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g;
const TC_HEADER_REGEX = /\[TimeControl\s+"(\d+)(?:\+(\d+))?"\]/;

/**
 * Parses `[%clk H:MM:SS.d]` annotations from a Chess.com PGN and extracts
 * move-by-move elapsed durations for the target player (`isWhite`).
 */
export function extractPlayerMoveTimes(pgn: string, isWhite: boolean): {
  incrementSec: number;
  baseSec: number;
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

  if (allClocks.length < 24) {
    // Require at least 12 plies per side for meaningful middlegame telemetry
    return null;
  }

  // Standard games start with White on ply 0, Black on ply 1
  const playerClocks = allClocks.filter((_, idx) => (isWhite ? idx % 2 === 0 : idx % 2 === 1));
  if (playerClocks.length < 12) return null;

  const moveDurationsSec: number[] = [];
  for (let i = 1; i < playerClocks.length; i++) {
    const rawElapsed = playerClocks[i - 1] - playerClocks[i] + incrementSec;
    // Clamp network jitter / premove 0.1s floor and 240s cap
    const cleanElapsed = Math.min(240, Math.max(0.1, Number(rawElapsed.toFixed(2))));
    moveDurationsSec.push(cleanElapsed);
  }

  return { incrementSec, baseSec, clocksSec: playerClocks, moveDurationsSec };
}

/**
 * Analyzes a single game's move-time vector for:
 * 1) Middlegame Metronome Flatline (abnormally low CV + near-zero instinctive recaptures)
 * 2) Mid-Game Engine Toggle Signature (human opening -> long launch pause -> robotic streak -> win)
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

  const { clocksSec, moveDurationsSec } = parsed;
  const scrambleThreshold = timeClass === 'bullet' ? 7 : 18;

  // Isolate non-scramble middlegame moves (move 9 through move 38)
  const midMoves: number[] = [];
  const startIdx = Math.min(8, Math.floor(moveDurationsSec.length * 0.25));
  const endIdx = Math.min(38, moveDurationsSec.length);

  for (let i = startIdx; i < endIdx; i++) {
    const clockRemaining = clocksSec[i + 1] ?? 0;
    if (clockRemaining < scrambleThreshold) break;
    midMoves.push(moveDurationsSec[i]);
  }

  if (midMoves.length < 8) return null;

  const mean = midMoves.reduce((sum, v) => sum + v, 0) / midMoves.length;
  const variance = midMoves.reduce((sum, v) => sum + (v - mean) ** 2, 0) / midMoves.length;
  const std = Math.sqrt(variance);
  const cv = mean > 0 ? std / mean : 1;

  // Instinctive / recapture threshold scales slightly with time control
  const fastThreshold = timeClass === 'bullet' ? 1.1 : timeClass === 'blitz' ? 1.8 : 2.3;
  const fastCount = midMoves.filter((t) => t <= fastThreshold).length;
  const fastMoveRatio = fastCount / midMoves.length;

  // Mechanical engine relay window: typically 2.3s - 8.8s (alt-tab or second-device lookup)
  const roboticLo = timeClass === 'bullet' ? 1.4 : 2.3;
  const roboticHi = timeClass === 'bullet' ? 4.5 : 8.8;
  const roboticCount = midMoves.filter((t) => t >= roboticLo && t <= roboticHi).length;
  const roboticBandRatio = roboticCount / midMoves.length;

  // Flatline game: unnatural consistency + lack of human instant recaptures + non-trivial mean delay
  const minMechanicalMean = timeClass === 'bullet' ? 1.3 : 2.5;
  const isFlatline =
    cv <= 0.44 &&
    mean >= minMechanicalMean &&
    mean <= 11.5 &&
    fastMoveRatio <= 0.09 &&
    roboticBandRatio >= 0.58;

  // Mid-game Toggle Signature:
  // A long pause (18s - 95s in Blitz/Rapid) between move 5 and 22, followed by >= 8 consecutive
  // non-scramble moves where >= 75% fall in [2.0s, 8.5s] with CV <= 0.45 and player wins!
  let hasMidgameToggle = false;
  if (won && timeClass !== 'bullet' && moveDurationsSec.length >= 16) {
    const pauseThreshold = timeClass === 'blitz' ? 18 : 26;
    const latestToggleIdx = Math.min(22, moveDurationsSec.length - 8);
    for (let i = 4; i <= latestToggleIdx; i++) {
      if (moveDurationsSec[i] >= pauseThreshold && moveDurationsSec[i] <= 110) {
        const postSlice = moveDurationsSec.slice(i + 1, Math.min(i + 13, moveDurationsSec.length));
        if (postSlice.length >= 8) {
          const pMean = postSlice.reduce((a, b) => a + b, 0) / postSlice.length;
          const pStd = Math.sqrt(
            postSlice.reduce((a, b) => a + (b - pMean) ** 2, 0) / postSlice.length
          );
          const pCv = pMean > 0 ? pStd / pMean : 1;
          const bandHits = postSlice.filter((t) => t >= 2.0 && t <= 9.0).length / postSlice.length;
          if (pCv <= 0.44 && bandHits >= 0.75 && pMean >= 2.4) {
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
    fastMoveRatio: Number(fastMoveRatio.toFixed(3)),
    roboticBandRatio: Number(roboticBandRatio.toFixed(3)),
    isFlatline,
    hasMidgameToggle,
    won,
  };
}

/**
 * Aggregates PGN `[%clk]` pacing metrics across up to the player's last 35 live games.
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
    .slice(0, 35);

  const metrics: PacingGameMetrics[] = [];
  for (const g of sorted) {
    const isWhite = g.white?.username?.toLowerCase() === userLower;
    const playerObj = isWhite ? g.white : g.black;
    const won = playerObj?.result === 'win';
    const m = analyzeSingleGamePacing(g.pgn || '', isWhite, String(g.time_class || 'blitz'), won);
    if (m) metrics.push(m);
  }

  if (metrics.length < 3) {
    return {
      gamesAnalyzed: metrics.length,
      medianCV: null,
      minCV: null,
      meanFastMoveRatio: null,
      meanRoboticBandRatio: null,
      flatlineGames: 0,
      flatlineRate: 0,
      toggleGames: 0,
      pacingScore: 0,
    };
  }

  const cvs = metrics.map((m) => m.cv).sort((a, b) => a - b);
  const mid = Math.floor(cvs.length / 2);
  const medianCV =
    cvs.length % 2 === 0 ? Number(((cvs[mid - 1] + cvs[mid]) / 2).toFixed(2)) : Number(cvs[mid].toFixed(2));
  const minCV = Number(cvs[0].toFixed(2));

  const meanFastMoveRatio = Number(
    (metrics.reduce((s, m) => s + m.fastMoveRatio, 0) / metrics.length).toFixed(3)
  );
  const meanRoboticBandRatio = Number(
    (metrics.reduce((s, m) => s + m.roboticBandRatio, 0) / metrics.length).toFixed(3)
  );

  const flatlineGames = metrics.filter((m) => m.isFlatline).length;
  const flatlineRate = Number((flatlineGames / metrics.length).toFixed(3));
  const toggleGames = metrics.filter((m) => m.hasMidgameToggle).length;

  // Component 1: Low median CV score (Human median CV is typically 0.78 - 1.25; <0.58 becomes suspicious)
  let cvRisk = 0;
  if (medianCV < 0.62) {
    cvRisk = Math.min(100, ((0.62 - medianCV) / 0.30) * 85);
  }

  // Component 2: Repeated flatline games rate (1 accidental game can happen; >=20% of games is highly robotic)
  let flatlineRisk = 0;
  if (flatlineRate >= 0.12) {
    flatlineRisk = Math.min(100, ((flatlineRate - 0.10) / 0.35) * 95);
  }

  // Component 3: Absence of instinctive fast recaptures alongside high mechanical band concentration
  let instinctDeficitRisk = 0;
  if (meanFastMoveRatio < 0.08 && meanRoboticBandRatio > 0.52) {
    instinctDeficitRisk = Math.min(
      85,
      ((0.08 - meanFastMoveRatio) / 0.08) * 50 + ((meanRoboticBandRatio - 0.52) / 0.35) * 40
    );
  }

  // Component 4: Mid-game toggle signature bonus
  const toggleBonus = toggleGames >= 2 ? Math.min(35, toggleGames * 14) : toggleGames === 1 ? 10 : 0;

  // Sample confidence damper (smoothly reaches ~0.80 at 10 games, ~0.90 at 22 games)
  const sampleWeight = metrics.length / (metrics.length + 2.5);

  const rawPacing =
    Math.max(cvRisk * 0.5 + flatlineRisk * 0.5, flatlineRisk * 0.85, cvRisk * 0.7 + instinctDeficitRisk * 0.35) +
    toggleBonus;

  const pacingScore = Math.min(100, Math.max(0, Math.round(rawPacing * sampleWeight)));

  return {
    gamesAnalyzed: metrics.length,
    medianCV,
    minCV,
    meanFastMoveRatio,
    meanRoboticBandRatio,
    flatlineGames,
    flatlineRate,
    toggleGames,
    pacingScore,
  };
}
