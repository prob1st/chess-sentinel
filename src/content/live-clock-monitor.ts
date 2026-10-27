import { LiveMatchClockTelemetry } from '../types';

const TOP_SELECTORS = [
  '#board-layout-player-top',
  '#board-layout-top',
  '.board-layout-player-top',
  '.board-layout-top',
  '.player-component.player-top',
  '.player-top',
];

const BOTTOM_SELECTORS = [
  '#board-layout-player-bottom',
  '#board-layout-bottom',
  '.board-layout-player-bottom',
  '.board-layout-bottom',
  '.player-component.player-bottom',
  '.player-bottom',
];

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

export function parseClockTextSec(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const clean = raw.replace(/[^\d:.]/g, '').trim();
  if (!clean || !clean.includes(':')) return null;
  const parts = clean.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

export function summarizeLiveMoveTimes(
  opponent: string,
  allMoveTimesSec: number[],
  allMoveNumbers?: number[],
  allSanLabels?: string[]
): LiveMatchClockTelemetry {
  const n = allMoveTimesSec.length;
  const resolvedMoveNums =
    allMoveNumbers && allMoveNumbers.length === n
      ? allMoveNumbers
      : Array.from({ length: n }, (_, idx) => idx + 2);
  const resolvedSan =
    allSanLabels && allSanLabels.length === n
      ? allSanLabels
      : Array.from({ length: n }, () => '');

  const recentTimes = allMoveTimesSec.slice(-16);
  const recentNums = resolvedMoveNums.slice(-16);
  const recentSan = resolvedSan.slice(-16);

  if (n < 4) {
    return {
      opponent,
      movesObserved: n,
      moveTimesSec: recentTimes,
      moveNumbers: recentNums,
      moveSanLabels: recentSan,
      liveMeanSec: null,
      liveQCD: null,
      consecutiveRoboticMoves: 0,
      detectedPauseSec: null,
      pauseMoveNumber: null,
      roboticStartMove: null,
      roboticEndMove: null,
      roboticMinSec: null,
      roboticMaxSec: null,
      isLiveSuspectPacing: false,
    };
  }

  // Evaluate post-opening moves when >=6 moves exist, else all observed
  const evalMoves = n >= 6 ? allMoveTimesSec.slice(3) : allMoveTimesSec;
  const mean = evalMoves.reduce((s, v) => s + v, 0) / evalMoves.length;
  const sorted = [...evalMoves].sort((a, b) => a - b);
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const liveQCD = q3 + q1 > 0 ? Number(((q3 - q1) / (q3 + q1)).toFixed(2)) : 0;

  let consecutiveRoboticMoves = 0;
  const streakSlice: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = allMoveTimesSec[i];
    if (t >= 2.6 && t <= 8.2) {
      consecutiveRoboticMoves++;
      streakSlice.push(t);
    } else {
      break;
    }
  }

  const roboticStartIdx = consecutiveRoboticMoves > 0 ? n - consecutiveRoboticMoves : -1;
  const roboticStartMove =
    roboticStartIdx >= 0 ? resolvedMoveNums[roboticStartIdx] : null;
  const roboticEndMove =
    consecutiveRoboticMoves > 0 ? resolvedMoveNums[n - 1] : null;
  const roboticMinSec =
    streakSlice.length > 0 ? Number(Math.min(...streakSlice).toFixed(1)) : null;
  const roboticMaxSec =
    streakSlice.length > 0 ? Number(Math.max(...streakSlice).toFixed(1)) : null;

  let detectedPauseSec: number | null = null;
  let pauseMoveNumber: number | null = null;
  if (n >= 10) {
    for (let i = 1; i <= n - 8; i++) {
      const t = allMoveTimesSec[i];
      if (t >= 25 && t <= 115) {
        const after = allMoveTimesSec.slice(i + 1);
        const roboticAfter = after.filter((x) => x >= 2.6 && x <= 8.2).length / after.length;
        if (after.length >= 7 && roboticAfter >= 0.88) {
          detectedPauseSec = Number(t.toFixed(1));
          pauseMoveNumber = resolvedMoveNums[i];
          break;
        }
      }
    }
  }

  const hasFastInstinctMove = evalMoves.some((t) => t <= 1.85);
  const hasDeepHumanThink = evalMoves.some((t) => t >= 15.0);
  // Zero-FP Live Match Alert: requires >=10 observed moves, >=8 straight mechanical moves,
  // zero fast recaptures, and extreme quartile compression (QCD <= 0.17).
  const isLiveSuspectPacing =
    (n >= 10 &&
      liveQCD <= 0.17 &&
      consecutiveRoboticMoves >= 8 &&
      !hasFastInstinctMove &&
      !hasDeepHumanThink &&
      mean >= 2.8 &&
      mean <= 8.5) ||
    (detectedPauseSec !== null && consecutiveRoboticMoves >= 7 && liveQCD <= 0.18);

  return {
    opponent,
    movesObserved: n,
    moveTimesSec: recentTimes,
    moveNumbers: recentNums,
    moveSanLabels: recentSan,
    liveMeanSec: Number(mean.toFixed(1)),
    liveQCD,
    consecutiveRoboticMoves,
    detectedPauseSec,
    pauseMoveNumber,
    roboticStartMove,
    roboticEndMove,
    roboticMinSec,
    roboticMaxSec,
    isLiveSuspectPacing,
  };
}

/**
 * Passively observes the active Chess.com game clock DOM to measure real-time
 * opponent move durations (`Δt`) AND exact move numbers (`#2..#N`) during a live match.
 * Strictly read-only passive clock/ply telemetry — zero chess engine / zero board evaluation.
 */
export class LiveMatchClockMonitor {
  private onUpdate: (telemetry: LiveMatchClockTelemetry) => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private targetOpponent: string | null = null;
  private targetSide: 'top' | 'bottom' = 'top';
  private moveTimesSec: number[] = [];
  private moveNumbers: number[] = [];
  private moveSanLabels: string[] = [];
  private wasTargetTurn = false;
  private turnStartMs = 0;
  private lastKnownPlyCount = 0;

  constructor(onUpdate: (telemetry: LiveMatchClockTelemetry) => void) {
    this.onUpdate = onUpdate;
  }

  setTarget(opponent: string, side: 'top' | 'bottom'): void {
    const normalized = opponent.toLowerCase();
    if (this.targetOpponent?.toLowerCase() !== normalized || this.targetSide !== side) {
      this.targetOpponent = opponent;
      this.targetSide = side;
      this.moveTimesSec = [];
      this.moveNumbers = [];
      this.moveSanLabels = [];
      this.wasTargetTurn = false;
      this.turnStartMs = 0;
      this.lastKnownPlyCount = this.countDomPlies();
    }
    this.ensureRunning();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.targetOpponent = null;
    this.moveTimesSec = [];
    this.moveNumbers = [];
    this.moveSanLabels = [];
    this.wasTargetTurn = false;
  }

  getLatestTelemetry(): LiveMatchClockTelemetry | null {
    if (!this.targetOpponent || this.moveTimesSec.length === 0) return null;
    return summarizeLiveMoveTimes(
      this.targetOpponent,
      this.moveTimesSec,
      this.moveNumbers,
      this.moveSanLabels
    );
  }

  private ensureRunning(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.sampleClock(), 250);
  }

  private findZone(side: 'top' | 'bottom'): Element | null {
    const selectors = side === 'top' ? TOP_SELECTORS : BOTTOM_SELECTORS;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  private getMoveNodes(): NodeListOf<Element> {
    return document.querySelectorAll('[data-ply], .move .node, wc-simple-move-list .node');
  }

  private countDomPlies(): number {
    return this.getMoveNodes().length;
  }

  private readLatestPlayedSan(): string {
    const nodes = this.getMoveNodes();
    if (nodes.length === 0) return '';
    const last = nodes[nodes.length - 1];
    const txt = (last.textContent || '').replace(/\s+/g, '').trim();
    return txt.slice(0, 10);
  }

  private isZoneTurnActive(zone: Element): boolean {
    if (
      zone.querySelector(
        '.clock-player-turn, .clock-component.clock-player-turn, [class*="clock-player-turn"]'
      )
    ) {
      return true;
    }
    const clockComp = zone.querySelector('.clock-component, [data-cy="clock-time"]');
    if (clockComp && clockComp.className && String(clockComp.className).includes('player-turn')) {
      return true;
    }
    return false;
  }

  private sampleClock(): void {
    if (!this.targetOpponent) return;

    if (
      document.querySelector(
        '.game-over-modal-content, [data-cy="game-over-modal"], .board-modal-container-container'
      )
    ) {
      this.wasTargetTurn = false;
      return;
    }

    const targetZone = this.findZone(this.targetSide);
    const otherZone = this.findZone(this.targetSide === 'top' ? 'bottom' : 'top');
    if (!targetZone || !otherZone) return;

    const isTargetTurn = this.isZoneTurnActive(targetZone);
    const isOtherTurn = this.isZoneTurnActive(otherZone);
    const currentPlies = this.countDomPlies();

    // Detect rematch / brand new game reset on same opponent
    if (currentPlies <= 2 && this.lastKnownPlyCount >= 8) {
      this.moveTimesSec = [];
      this.moveNumbers = [];
      this.moveSanLabels = [];
      this.wasTargetTurn = false;
      this.turnStartMs = 0;
    }
    this.lastKnownPlyCount = currentPlies;

    const nowMs = performance.now();

    if (isTargetTurn && !this.wasTargetTurn) {
      this.wasTargetTurn = true;
      this.turnStartMs = nowMs;
    } else if (!isTargetTurn && this.wasTargetTurn && isOtherTurn) {
      this.wasTargetTurn = false;
      const elapsedSec = Number(((nowMs - this.turnStartMs) / 1000).toFixed(2));
      if (elapsedSec >= 0.15 && elapsedSec <= 180 && currentPlies >= 3) {
        const fullMoveNo = Math.max(
          (this.moveNumbers[this.moveNumbers.length - 1] ?? 1) + 1,
          Math.ceil(currentPlies / 2)
        );
        const san = this.readLatestPlayedSan();
        this.moveTimesSec.push(elapsedSec);
        this.moveNumbers.push(fullMoveNo);
        this.moveSanLabels.push(san);

        if (this.moveTimesSec.length > 60) {
          this.moveTimesSec.shift();
          this.moveNumbers.shift();
          this.moveSanLabels.shift();
        }
        this.onUpdate(
          summarizeLiveMoveTimes(
            this.targetOpponent,
            this.moveTimesSec,
            this.moveNumbers,
            this.moveSanLabels
          )
        );
      }
    }
  }
}
