import { describe, expect, it } from 'vitest';
import {
  analyzeSingleGamePacing,
  computeAggregatePacing,
  extractPlayerMoveTimes,
} from '../src/core/pgn-pacing';
import { ChessComGame } from '../src/types';

function buildMockPgn(whiteDeltas: number[], blackDeltas: number[], baseSec = 600, inc = 0): string {
  let wClock = baseSec;
  let bClock = baseSec;
  const moves: string[] = [];
  const count = Math.min(whiteDeltas.length, blackDeltas.length);

  for (let i = 0; i < count; i++) {
    if (i > 0) wClock = Math.max(35, wClock - whiteDeltas[i] + inc);
    if (i > 0) bClock = Math.max(35, bClock - blackDeltas[i] + inc);
    const fmt = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = (sec % 60).toFixed(1).padStart(4, '0');
      return `0:${String(m).padStart(2, '0')}:${s}`;
    };
    moves.push(`${i + 1}. Nf3 {[%clk ${fmt(wClock)}]} ${i + 1}... Nf6 {[%clk ${fmt(bClock)}]}`);
  }

  return `[Event "Live Chess"]\n[TimeControl "${baseSec}${inc ? `+${inc}` : ''}"]\n\n${moves.join(' ')}`;
}

describe('PGN [%clk] Chronometric Entropy & QCD Pacing Analyzer v2.0', () => {
  it('extracts accurate per-move durations with increment handling', () => {
    const deltas = Array.from({ length: 18 }, (_, i) => (i % 2 === 0 ? 3.5 : 8.0));
    const pgn = buildMockPgn(deltas, deltas, 180, 2);
    const res = extractPlayerMoveTimes(pgn, true);
    expect(res).not.toBeNull();
    expect(res!.incrementSec).toBe(2);
    expect(res!.moveDurationsSec.length).toBe(17);
    expect(res!.moveDurationsSec[1]).toBeCloseTo(3.5, 1);
    expect(res!.moveDurationsSec[2]).toBeCloseTo(8.0, 1);
  });

  it('flags metronomic flatline engine pacing via low QCD + collapsed Shannon entropy', () => {
    const roboticDeltas = [
      2.1, 3.0, 4.1, 4.8, 5.1, 4.9, 5.2, 4.7, 5.0, 5.3, 4.8, 4.6, 5.1, 5.0, 4.9, 5.4, 4.7, 5.0,
      4.8, 5.1, 4.9, 5.2, 4.6, 5.0, 4.8, 5.1, 4.9, 5.0,
    ];
    const humanDeltas = [
      0.6, 1.2, 4.5, 0.5, 14.2, 1.1, 0.6, 24.4, 3.1, 0.8, 19.5, 1.4, 0.7, 9.2, 31.0, 1.0, 0.4,
      11.5, 2.0, 0.9, 16.2, 1.3, 0.8, 7.4, 1.1, 21.0, 0.5, 6.2,
    ];
    const pgn = buildMockPgn(roboticDeltas, humanDeltas, 600, 0);

    const cheaterMetrics = analyzeSingleGamePacing(pgn, true, 'rapid', true);
    const humanMetrics = analyzeSingleGamePacing(pgn, false, 'rapid', false);

    expect(cheaterMetrics).not.toBeNull();
    expect(cheaterMetrics!.isFlatline).toBe(true);
    expect(cheaterMetrics!.qcd).toBeLessThan(0.15);
    expect(cheaterMetrics!.entropyBits).toBeLessThan(1.3);

    expect(humanMetrics).not.toBeNull();
    expect(humanMetrics!.isFlatline).toBe(false);
    expect(humanMetrics!.qcd).toBeGreaterThan(0.45);
    expect(humanMetrics!.entropyBits).toBeGreaterThan(2.0);
  });

  it('catches a cheater via outlier-immune QCD even if they take a single 55s break mid-game', () => {
    // 19 robotic 4.8s moves + ONE 55s break (which inflates std/CV, but QCD stays <0.10!)
    const deltasWithSingleBreak = [
      2.0, 3.1, 4.7, 4.9, 5.0, 4.8, 4.9, 5.1, 4.8, 4.7, 4.9, 55.0, 4.8, 5.0, 4.9, 4.7, 5.1, 4.8,
      4.9, 5.0, 4.8, 4.9, 5.0, 4.7, 4.9,
    ];
    const pgn = buildMockPgn(deltasWithSingleBreak, deltasWithSingleBreak, 600, 0);
    const m = analyzeSingleGamePacing(pgn, true, 'rapid', true);
    expect(m).not.toBeNull();
    expect(m!.qcd).toBeLessThan(0.12);
    expect(m!.isFlatline).toBe(true);
  });

  it('detects strict mid-game engine launch toggle signature', () => {
    const toggleDeltas = [
      0.9, 2.5, 0.8, 6.4, 1.4, 11.2, 1.8, 4.5, 1.2, 44.0, 4.6, 4.8, 4.7, 5.0, 4.5, 4.9, 4.7, 4.6,
      4.8, 4.7, 5.0, 4.6, 4.8,
    ];
    const oppDeltas = Array.from({ length: toggleDeltas.length }, (_, i) =>
      i % 3 === 0 ? 1.4 : 9.5
    );
    const pgn = buildMockPgn(toggleDeltas, oppDeltas, 600, 0);

    const m = analyzeSingleGamePacing(pgn, true, 'rapid', true);
    expect(m).not.toBeNull();
    expect(m!.hasMidgameToggle).toBe(true);
  });

  it('confirms organic human pacing (`isConfirmedHumanPacing = true`, `pacingScore = 0`) on heavy-tailed human games', () => {
    const roboticDeltas = Array.from({ length: 26 }, (_, i) => 4.7 + (i % 3) * 0.3);
    const humanDeltas = [
      0.5, 1.1, 8.2, 0.8, 22.0, 1.4, 0.5, 14.3, 3.2, 0.7, 29.5, 1.2, 0.6, 6.8, 17.4, 1.0, 0.8,
      12.1, 1.5, 24.0, 0.7, 5.5, 1.3, 15.2, 0.6, 9.0,
    ];
    const pgn = buildMockPgn(roboticDeltas, humanDeltas, 600, 0);

    const games: ChessComGame[] = Array.from({ length: 12 }, (_, idx) => ({
      pgn,
      time_class: 'rapid',
      rated: true,
      end_time: 1760000000 + idx * 900,
      white: { username: 'BotSuspect', rating: 2050, result: 'win' },
      black: { username: 'HonestJoe', rating: 2040, result: 'checkmated' },
    }));

    const suspectSummary = computeAggregatePacing(games, 'BotSuspect');
    const honestSummary = computeAggregatePacing(games, 'HonestJoe');

    expect(suspectSummary.pacingScore).toBeGreaterThanOrEqual(75);
    expect(suspectSummary.isConfirmedHumanPacing).toBe(false);

    expect(honestSummary.isConfirmedHumanPacing).toBe(true);
    expect(honestSummary.pacingScore).toBe(0);
  });
});
