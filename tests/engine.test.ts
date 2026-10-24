import { describe, expect, it } from 'vitest';
import { analyzePlayerBundle } from '../src/core/engine';
import { ChessComGame, PlayerRawBundle } from '../src/types';

function makeHumanPgn(seed = 1): string {
  const w = [
    0.8, 1.4, 6.2, 0.9, 15.4, 1.2, 0.6, 22.1, 4.0, 1.1, 18.0, 0.7, 9.5, 1.3, 25.0, 0.9, 5.2, 1.5,
    14.0, 0.8, 11.2, 1.0,
  ].map((v) => v + (seed % 2) * 0.2);
  let wc = 600;
  let bc = 600;
  const moves = w.map((d, i) => {
    if (i > 0) {
      wc -= d;
      bc -= d;
    }
    const fmt = (sec: number) =>
      `0:${String(Math.floor(sec / 60)).padStart(2, '0')}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
    return `${i + 1}. e4 {[%clk ${fmt(wc)}]} ${i + 1}... e5 {[%clk ${fmt(bc)}]}`;
  });
  return `[TimeControl "600"]\n\n${moves.join(' ')}`;
}

function makeRoboticPgn(): string {
  const w = Array.from({ length: 24 }, (_, i) => 4.8 + (i % 2) * 0.3);
  let wc = 600;
  let bc = 600;
  const moves = w.map((d, i) => {
    if (i > 0) {
      wc -= d;
      bc -= d;
    }
    const fmt = (sec: number) =>
      `0:${String(Math.floor(sec / 60)).padStart(2, '0')}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
    return `${i + 1}. d4 {[%clk ${fmt(wc)}]} ${i + 1}... d5 {[%clk ${fmt(bc)}]}`;
  });
  return `[TimeControl "600"]\n\n${moves.join(' ')}`;
}

describe('6-Signal Bayesian Cheat Probability Engine', () => {
  const nowMs = 1792800000 * 1000;
  const nowSec = 1792800000;

  it('scores an established honest player with ~50% WR and natural pacing in LOW tier (<20%)', () => {
    const games: ChessComGame[] = Array.from({ length: 30 }, (_, i) => ({
      time_class: 'rapid',
      rated: true,
      end_time: nowSec - i * 7200,
      pgn: makeHumanPgn(i),
      accuracies: { white: 80.5, black: 80.2 },
      white: { username: 'HonestClubPlayer', rating: 1550, result: i % 2 === 0 ? 'win' : 'resigned' },
      black: { username: 'OtherPlayer', rating: 1550, result: i % 2 === 0 ? 'resigned' : 'win' },
    }));

    const bundle: PlayerRawBundle = {
      username: 'honestclubplayer',
      profile: {
        username: 'HonestClubPlayer',
        joined: nowSec - 4 * 365 * 86400,
        status: 'premium',
      },
      stats: {
        chess_rapid: {
          last: { rating: 1550, rd: 42 },
          best: { rating: 1610 },
          record: { win: 610, loss: 595, draw: 55 },
        },
      },
      recentGames: games,
      fetchedAt: nowMs,
    };

    const res = analyzePlayerBundle(bundle, { nowMs });
    expect(res.probability).toBeLessThan(20);
    expect(res.tier).toBe('low');
  });

  it('flags a fresh burner account with 82% WR, +9% CAPS2 excess, and robotic pacing as CRITICAL (>=80%)', () => {
    const games: ChessComGame[] = Array.from({ length: 28 }, (_, i) => ({
      time_class: 'rapid',
      rated: true,
      end_time: nowSec - (28 - i) * 3600,
      pgn: makeRoboticPgn(),
      accuracies: { white: 95.4, black: 79.1 },
      white: {
        username: 'StockfishBurner99',
        rating: 1700 + i * 11,
        result: i % 6 === 0 ? 'resigned' : 'win',
      },
      black: {
        username: 'Victim',
        rating: 1850,
        result: i % 6 === 0 ? 'win' : 'checkmated',
      },
    }));

    const bundle: PlayerRawBundle = {
      username: 'stockfishburner99',
      profile: {
        username: 'StockfishBurner99',
        joined: nowSec - 9 * 86400, // 9 days old
        status: 'basic',
      },
      stats: {
        chess_rapid: {
          last: { rating: 2008, rd: 54 },
          best: { rating: 2008 },
          record: { win: 46, loss: 8, draw: 2 },
        },
        tactics: { highest: { rating: 400 } },
      },
      recentGames: games,
      fetchedAt: nowMs,
    };

    const res = analyzePlayerBundle(bundle, { nowMs });
    expect(res.probability).toBeGreaterThanOrEqual(85);
    expect(res.tier).toBe('critical');
    expect(res.flags.some((f) => f.id === 'fresh_high_elo')).toBe(true);
  });

  it('immediately assigns 100% BANNED status to accounts closed for fair_play_violations', () => {
    const bundle: PlayerRawBundle = {
      username: 'bannedcheater',
      profile: {
        username: 'BannedCheater',
        joined: nowSec - 100 * 86400,
        status: 'closed:fair_play_violations',
      },
      stats: {},
      recentGames: [],
      fetchedAt: nowMs,
    };

    const res = analyzePlayerBundle(bundle, { nowMs });
    expect(res.probability).toBe(100);
    expect(res.isBannedFairPlay).toBe(true);
    expect(res.tier).toBe('banned');
  });

  it('applies FIDE Grandmaster dampener so verified GMs with high winrates do not trigger false alarms', () => {
    const games: ChessComGame[] = Array.from({ length: 24 }, (_, i) => ({
      time_class: 'blitz',
      rated: true,
      end_time: nowSec - i * 1800,
      pgn: makeHumanPgn(i),
      accuracies: { white: 90.2, black: 86.0 },
      white: {
        username: 'SuperGM_Test',
        rating: 3120,
        result: i % 4 === 0 ? 'timeout' : 'win',
      },
      black: {
        username: 'OpponentGM',
        rating: 2980,
        result: i % 4 === 0 ? 'win' : 'resigned',
      },
    }));

    const bundle: PlayerRawBundle = {
      username: 'supergm_test',
      profile: {
        username: 'SuperGM_Test',
        title: 'GM',
        joined: nowSec - 8 * 365 * 86400,
        status: 'premium',
      },
      stats: {
        chess_blitz: {
          last: { rating: 3120, rd: 38 },
          best: { rating: 3250 },
          record: { win: 14200, loss: 4800, draw: 1900 },
        },
      },
      recentGames: games,
      fetchedAt: nowMs,
    };

    const res = analyzePlayerBundle(bundle, { nowMs });
    expect(res.probability).toBeLessThan(35);
    expect(res.flags.some((f) => f.id === 'verified_title')).toBe(true);
  });
});
