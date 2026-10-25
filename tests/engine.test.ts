import { describe, expect, it } from 'vitest';
import { analyzePlayerBundle } from '../src/core/engine';
import { ChessComGame, PlayerRawBundle } from '../src/types';

function makeHumanPgn(seed = 1): string {
  const w = [
    0.6, 1.3, 6.2, 0.8, 16.4, 1.2, 0.5, 24.1, 3.8, 1.0, 19.0, 0.7, 9.5, 1.3, 27.0, 0.8, 5.2, 1.5,
    14.0, 0.7, 11.2, 1.0, 4.4, 18.5,
  ].map((v) => v + (seed % 2) * 0.15);
  let wc = 600;
  let bc = 600;
  const moves = w.map((d, i) => {
    if (i > 0) {
      wc = Math.max(40, wc - d);
      bc = Math.max(40, bc - d);
    }
    const fmt = (sec: number) =>
      `0:${String(Math.floor(sec / 60)).padStart(2, '0')}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
    return `${i + 1}. e4 {[%clk ${fmt(wc)}]} ${i + 1}... e5 {[%clk ${fmt(bc)}]}`;
  });
  return `[TimeControl "600"]\n\n${moves.join(' ')}`;
}

function makeShortTrapPgn(): string {
  // 10-move miniature opening trap (<32 plies)
  return `[TimeControl "600"]\n\n1. e4 {[%clk 0:09:59.0]} 1... e5 {[%clk 0:09:58.0]} 2. Nf3 {[%clk 0:09:57.0]} 2... Nc6 {[%clk 0:09:56.0]} 3. Bc4 {[%clk 0:09:55.0]} 3... Nf6 {[%clk 0:09:54.0]} 4. Ng5 {[%clk 0:09:52.0]} 4... d5 {[%clk 0:09:50.0]} 5. exd5 {[%clk 0:09:49.0]} 5... Nxd5 {[%clk 0:09:47.0]} 6. Nxf7 {[%clk 0:09:45.0]} 6... Kxf7 {[%clk 0:09:40.0]} 7. Qf3+ {[%clk 0:09:43.0]} 7... Ke8 {[%clk 0:09:30.0]} 8. Bxd5 {[%clk 0:09:41.0]} 8... Qxd5 {[%clk 0:09:25.0]} 9. Qxd5 {[%clk 0:09:40.0]} 9... Bd6 {[%clk 0:09:20.0]} 10. Qf7# {[%clk 0:09:39.0]}`;
}

function makeRoboticPgn(): string {
  const w = Array.from({ length: 26 }, (_, i) => 4.8 + (i % 2) * 0.25);
  let wc = 600;
  let bc = 600;
  const moves = w.map((d, i) => {
    if (i > 0) {
      wc = Math.max(40, wc - d);
      bc = Math.max(40, bc - d);
    }
    const fmt = (sec: number) =>
      `0:${String(Math.floor(sec / 60)).padStart(2, '0')}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
    return `${i + 1}. d4 {[%clk ${fmt(wc)}]} ${i + 1}... d5 {[%clk ${fmt(bc)}]}`;
  });
  return `[TimeControl "600"]\n\n${moves.join(' ')}`;
}

describe('Multi-Pillar Bayesian Log-Odds Engine v2.0 & False-Positive Shield', () => {
  const nowMs = 1792800000 * 1000;
  const nowSec = 1792800000;

  it('scores an established honest player with ~50% WR and untouched 400 puzzle rating at <= 6% LOW', () => {
    const games: ChessComGame[] = Array.from({ length: 30 }, (_, i) => ({
      time_class: 'rapid',
      rated: true,
      end_time: nowSec - i * 7200,
      pgn: makeHumanPgn(i),
      accuracies: { white: 80.5, black: 80.2 },
      white: { username: 'HonestClubPlayer', rating: 2050, result: i % 2 === 0 ? 'win' : 'resigned' },
      black: { username: 'OtherPlayer', rating: 2050, result: i % 2 === 0 ? 'resigned' : 'win' },
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
          last: { rating: 2050, rd: 42 },
          best: { rating: 2110 },
          record: { win: 610, loss: 595, draw: 55 },
        },
        // Untouched Chess.com default tactics rating of 400 must NOT cause false positive!
        tactics: { highest: { rating: 400 }, lowest: { rating: 400 } },
      },
      recentGames: games,
      fetchedAt: nowMs,
    };

    const res = analyzePlayerBundle(bundle, { nowMs });
    expect(res.probability).toBeLessThanOrEqual(6);
    expect(res.tier).toBe('low');
    expect(res.flags.some((f) => f.id === 'tactics_gap')).toBe(false);
  });

  it('prevents false positives from Free Daily Game-Review survivorship bias & short opening traps', () => {
    // 24 honest games (12W / 12L), but user only ran Game Review on 3 wins + 4 short 10-move traps at 98% accuracy!
    const games: ChessComGame[] = Array.from({ length: 24 }, (_, i) => {
      const won = i % 2 === 0;
      const isShortTrap = won && i < 8;
      const isReviewedLongWin = won && i >= 8 && i < 14;
      return {
        time_class: 'blitz',
        rated: true,
        end_time: nowSec - i * 3600,
        pgn: isShortTrap ? makeShortTrapPgn() : makeHumanPgn(i),
        accuracies: isShortTrap
          ? { white: 98.4, black: 62.0 }
          : isReviewedLongWin
            ? { white: 86.2, black: 77.0 }
            : undefined,
        white: { username: 'FreeTierReviewer', rating: 1450, result: won ? 'win' : 'resigned' },
        black: { username: 'Peer', rating: 1450, result: won ? 'resigned' : 'win' },
      };
    });

    const bundle: PlayerRawBundle = {
      username: 'freetierreviewer',
      profile: { username: 'FreeTierReviewer', joined: nowSec - 400 * 86400, status: 'basic' },
      stats: {
        chess_blitz: {
          last: { rating: 1450, rd: 45 },
          best: { rating: 1490 },
          record: { win: 220, loss: 215, draw: 18 },
        },
      },
      recentGames: games,
      fetchedAt: nowMs,
    };

    const res = analyzePlayerBundle(bundle, { nowMs });
    expect(res.probability).toBeLessThan(12);
    expect(res.tier).toBe('low');
  });

  it('prevents false positives when a strong player wins 90% against much lower-rated opponents in open arenas', () => {
    const games: ChessComGame[] = Array.from({ length: 20 }, (_, i) => ({
      time_class: 'blitz',
      rated: true,
      end_time: nowSec - i * 1800,
      pgn: makeHumanPgn(i),
      white: {
        username: 'ArenaPlayer1800',
        rating: 1820,
        result: i === 5 || i === 15 ? 'resigned' : 'win', // 18W / 2L = 90% raw WR!
      },
      black: {
        username: `Opponent_${i}`,
        rating: 1250, // 570 Elo weaker -> expected win rate is already ~96%!
        result: i === 5 || i === 15 ? 'win' : 'checkmated',
      },
    }));

    const bundle: PlayerRawBundle = {
      username: 'arenaplayer1800',
      profile: { username: 'ArenaPlayer1800', joined: nowSec - 600 * 86400, status: 'premium' },
      stats: {
        chess_blitz: {
          last: { rating: 1820, rd: 45 },
          best: { rating: 1850 },
          record: { win: 410, loss: 380, draw: 30 },
        },
      },
      recentGames: games,
      fetchedAt: nowMs,
    };

    const res = analyzePlayerBundle(bundle, { nowMs });
    expect(res.probability).toBeLessThan(10);
    expect(res.tier).toBe('low');
  });

  it('caps hand-played smurf hot-streaks (organic human pacing + normal accuracy) at <= 42% instead of false Critical alarm', () => {
    const games: ChessComGame[] = Array.from({ length: 20 }, (_, i) => ({
      time_class: 'rapid',
      rated: true,
      end_time: nowSec - i * 3600,
      pgn: makeHumanPgn(i),
      accuracies: { white: 82.0, black: 76.0 }, // Normal human accuracy for 1650
      white: {
        username: 'LichessMigrant',
        rating: 1650,
        result: i < 18 ? 'win' : 'resigned', // 18W / 2L against equal opponents!
      },
      black: {
        username: 'EqualOpponent',
        rating: 1650,
        result: i < 18 ? 'resigned' : 'win',
      },
    }));

    const bundle: PlayerRawBundle = {
      username: 'lichessmigrant',
      profile: { username: 'LichessMigrant', joined: nowSec - 12 * 86400, status: 'basic' },
      stats: {
        chess_rapid: {
          last: { rating: 1650, rd: 65 },
          best: { rating: 1650 },
          record: { win: 18, loss: 2, draw: 0 },
        },
      },
      recentGames: games,
      fetchedAt: nowMs,
    };

    const res = analyzePlayerBundle(bundle, { nowMs });
    expect(res.probability).toBeLessThanOrEqual(42);
    expect(res.flags.some((f) => f.id === 'smurf_human_pacing')).toBe(true);
  });

  it('flags multi-pillar Stockfish burner (high Z_Elo + +10% long-game CAPS2 + robotic QCD/entropy) as CRITICAL (>=85%)', () => {
    const games: ChessComGame[] = Array.from({ length: 28 }, (_, i) => ({
      time_class: 'rapid',
      rated: true,
      end_time: nowSec - (28 - i) * 3600,
      pgn: makeRoboticPgn(),
      accuracies: { white: 95.8, black: 79.1 },
      white: {
        username: 'StockfishBurner99',
        rating: 1700 + i * 11,
        result: i % 7 === 0 ? 'resigned' : 'win',
      },
      black: {
        username: 'Victim',
        rating: 1920,
        result: i % 7 === 0 ? 'win' : 'checkmated',
      },
    }));

    const bundle: PlayerRawBundle = {
      username: 'stockfishburner99',
      profile: {
        username: 'StockfishBurner99',
        joined: nowSec - 9 * 86400,
        status: 'basic',
      },
      stats: {
        chess_rapid: {
          last: { rating: 2008, rd: 50 },
          best: { rating: 2008 },
          record: { win: 46, loss: 7, draw: 2 },
        },
      },
      recentGames: games,
      fetchedAt: nowMs,
    };

    const res = analyzePlayerBundle(bundle, { nowMs });
    expect(res.probability).toBeGreaterThanOrEqual(85);
    expect(res.tier).toBe('critical');
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
});
