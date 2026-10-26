import { describe, expect, it } from 'vitest';
import {
  parseClockTextSec,
  summarizeLiveMoveTimes,
} from '../src/content/live-clock-monitor';
import { analyzePlayerBundle, buildFairPlayEvidenceReport } from '../src/core/engine';
import { PlayerRawBundle } from '../src/types';

describe('v3.0 Live Match Clock Radar & Forensic Evidence Export', () => {
  it('parses MM:SS.d and H:MM:SS Chess.com clock strings accurately', () => {
    expect(parseClockTextSec('09:58.4')).toBeCloseTo(598.4, 2);
    expect(parseClockTextSec('1:05:12')).toBe(3912);
    expect(parseClockTextSec('')).toBeNull();
  });

  it('flags mid-game pause followed by >=8 flatline mechanical moves in live game', () => {
    const snap = summarizeLiveMoveTimes('SuspectRelay99', [
      1.2, 2.1, 1.5, 36.0, 4.4, 4.6, 4.3, 4.5, 4.4, 4.6, 4.5, 4.4,
    ]);
    expect(snap.movesObserved).toBe(12);
    expect(snap.detectedPauseSec).toBe(36);
    expect(snap.consecutiveRoboticMoves).toBe(8);
    expect(snap.isLiveSuspectPacing).toBe(true);
  });

  it('does NOT flag organic human live clock variance with fast recaptures', () => {
    const snap = summarizeLiveMoveTimes('HonestClubPlayer', [
      0.8, 1.4, 9.2, 1.1, 16.5, 2.2, 0.9, 7.8, 1.3,
    ]);
    expect(snap.isLiveSuspectPacing).toBe(false);
  });

  it('populates 7-bin chronometric histogram, recentMatches, and bilingual Fair-Play report', () => {
    const pgn = `[Event "Live Chess"]\n[TimeControl "180+0"]\n1. e4 {[%clk 0:02:59.1]} e5 {[%clk 0:02:58.8]} 2. Nf3 {[%clk 0:02:55.0]} Nc6 {[%clk 0:02:54.5]} 3. Bb5 {[%clk 0:02:50.5]} a6 {[%clk 0:02:50.0]} 4. Ba4 {[%clk 0:02:46.1]} Nf6 {[%clk 0:02:45.5]} 5. O-O {[%clk 0:02:41.6]} Be7 {[%clk 0:02:40.0]} 6. Re1 {[%clk 0:02:37.2]} b5 {[%clk 0:02:35.0]} 7. Bb3 {[%clk 0:02:32.8]} d6 {[%clk 0:02:30.0]} 8. c3 {[%clk 0:02:28.3]} O-O {[%clk 0:02:25.0]} 9. h3 {[%clk 0:02:23.9]} Nb8 {[%clk 0:02:20.0]} 10. d4 {[%clk 0:02:19.4]} Nbd7 {[%clk 0:02:15.0]} 11. Nbd2 {[%clk 0:02:15.0]} Bb7 {[%clk 0:02:10.0]} 12. Bc2 {[%clk 0:02:10.5]} Re8 {[%clk 0:02:05.0]} 13. Nf1 {[%clk 0:02:06.1]} Bf8 {[%clk 0:02:00.0]} 14. Ng3 {[%clk 0:02:01.6]} g6 {[%clk 0:01:55.0]} 15. a4 {[%clk 0:01:57.1]} c5 {[%clk 0:01:50.0]} 16. d5 {[%clk 0:01:52.7]} c4 {[%clk 0:01:45.0]} 17. Bg5 {[%clk 0:01:48.2]} h6 {[%clk 0:01:40.0]} 18. Be3 {[%clk 0:01:43.8]} Nc5 {[%clk 0:01:35.0]} 1-0`;

    const bundle: PlayerRawBundle = {
      username: 'testengine99',
      fetchedAt: 1760000000000,
      profile: {
        username: 'testengine99',
        joined: 1760000000 - 10 * 86400,
        status: 'basic',
      },
      stats: {
        chess_blitz: {
          last: { rating: 2150, rd: 45 },
          best: { rating: 2150 },
          record: { win: 38, loss: 4, draw: 1 },
        },
      },
      recentGames: Array.from({ length: 8 }, (_, idx) => ({
        url: `https://www.chess.com/game/live/99900${idx}`,
        pgn,
        time_control: '180',
        time_class: 'blitz',
        rated: true,
        end_time: 1760000000 - idx * 600,
        accuracies: { white: 95.4, black: 82.1 },
        white: { username: 'TestEngine99', rating: 2150 - idx * 8, result: 'win' },
        black: { username: `Opponent_${idx}`, rating: 2130, result: 'resigned' },
      })),
    };

    const res = analyzePlayerBundle(bundle, { nowMs: 1760000000000 });
    expect(res.recentMatches.length).toBe(5);
    expect(res.recentMatches[0].opponentUsername).toBe('Opponent_0');
    expect(res.pacing.bucketDistribution.length).toBe(7);

    const trReport = buildFairPlayEvidenceReport(res, 'tr');
    const enReport = buildFairPlayEvidenceReport(res, 'en');
    expect(trReport).toContain('Chess Sentinel v3.1');
    expect(trReport).toContain('@testengine99');
    expect(enReport).toContain('https://www.chess.com/game/live/999000');
  });
});
