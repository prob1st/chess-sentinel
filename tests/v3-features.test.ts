import { describe, expect, it } from 'vitest';
import {
  parseClockTextSec,
  summarizeLiveMoveTimes,
} from '../src/content/live-clock-monitor';
import { analyzePlayerBundle, buildFairPlayEvidenceReport } from '../src/core/engine';
import { PlayerRawBundle } from '../src/types';

describe('v3.2 Auto-Verdict, Exact Move-Range Pinpointer & Forensic Evidence Export', () => {
  it('parses MM:SS.d and H:MM:SS Chess.com clock strings accurately', () => {
    expect(parseClockTextSec('09:58.4')).toBeCloseTo(598.4, 2);
    expect(parseClockTextSec('1:05:12')).toBe(3912);
    expect(parseClockTextSec('')).toBeNull();
  });

  it('pinpoints exact live pause move number and exact robotic move range (#start..#end)', () => {
    const snap = summarizeLiveMoveTimes(
      'SuspectRelay99',
      [1.2, 2.1, 1.5, 36.0, 4.4, 4.6, 4.3, 4.5, 4.4, 4.6, 4.5, 4.4],
      [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
    );
    expect(snap.movesObserved).toBe(12);
    expect(snap.detectedPauseSec).toBe(36);
    expect(snap.pauseMoveNumber).toBe(9);
    expect(snap.roboticStartMove).toBe(10);
    expect(snap.roboticEndMove).toBe(17);
    expect(snap.roboticMinSec).toBe(4.3);
    expect(snap.roboticMaxSec).toBe(4.6);
    expect(snap.consecutiveRoboticMoves).toBe(8);
    expect(snap.isLiveSuspectPacing).toBe(true);
  });

  it('does NOT flag organic human live clock variance with fast recaptures', () => {
    const snap = summarizeLiveMoveTimes('HonestClubPlayer', [
      0.8, 1.4, 9.2, 1.1, 16.5, 2.2, 0.9, 7.8, 1.3, 11.4, 0.7,
    ]);
    expect(snap.isLiveSuspectPacing).toBe(false);
  });

  it('extracts exact historical suspectPinpoints (move ranges + SAN tokens) and exports v3.2 report', () => {
    const pgn = `[Event "Live Chess"]\n[TimeControl "180+0"]\n\n1. e4 {[%clk 0:02:59.1]} e5 {[%clk 0:02:58.8]} 2. Nf3 {[%clk 0:02:55.0]} Nc6 {[%clk 0:02:54.5]} 3. Bb5 {[%clk 0:02:50.5]} a6 {[%clk 0:02:50.0]} 4. Ba4 {[%clk 0:02:46.0]} Nf6 {[%clk 0:02:45.5]} 5. O-O {[%clk 0:02:41.5]} Be7 {[%clk 0:02:40.0]} 6. Re1 {[%clk 0:02:37.0]} b5 {[%clk 0:02:35.0]} 7. Bb3 {[%clk 0:02:32.5]} d6 {[%clk 0:02:30.0]} 8. c3 {[%clk 0:02:28.0]} O-O {[%clk 0:02:25.0]} 9. h3 {[%clk 0:02:23.5]} Nb8 {[%clk 0:02:20.0]} 10. d4 {[%clk 0:02:19.0]} Nbd7 {[%clk 0:02:15.0]} 11. Nbd2 {[%clk 0:02:14.5]} Bb7 {[%clk 0:02:10.0]} 12. Bc2 {[%clk 0:02:10.0]} Re8 {[%clk 0:02:05.0]} 13. Nf1 {[%clk 0:02:05.5]} Bf8 {[%clk 0:02:00.0]} 14. Ng3 {[%clk 0:02:01.0]} g6 {[%clk 0:01:55.0]} 15. a4 {[%clk 0:01:56.5]} c5 {[%clk 0:01:50.0]} 16. d5 {[%clk 0:01:52.0]} c4 {[%clk 0:01:45.0]} 17. Bg5 {[%clk 0:01:47.5]} h6 {[%clk 0:01:40.0]} 18. Be3 {[%clk 0:01:43.0]} Nc5 {[%clk 0:01:35.0]} 19. Qd2 {[%clk 0:01:38.5]} Kh7 {[%clk 0:01:30.0]} 20. Nh2 {[%clk 0:01:34.0]} Bg7 {[%clk 0:01:25.0]} 21. Ng4 {[%clk 0:01:29.5]} Nxg4 {[%clk 0:01:20.0]} 22. hxg4 {[%clk 0:01:25.0]} Qd7 {[%clk 0:01:15.0]} 23. f3 {[%clk 0:01:20.5]} Rh8 {[%clk 0:01:10.0]} 24. Kf2 {[%clk 0:01:16.0]} Kg8 {[%clk 0:01:05.0]} 1-0`;

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
        accuracies: { white: 95.8, black: 82.1 },
        white: { username: 'TestEngine99', rating: 2150 - idx * 8, result: 'win' },
        black: { username: `Opponent_${idx}`, rating: 2130, result: 'resigned' },
      })),
    };

    const res = analyzePlayerBundle(bundle, { nowMs: 1760000000000 });
    expect(res.recentMatches.length).toBe(8);
    expect(res.recentMatches[0].moveTimesSec?.length).toBeGreaterThanOrEqual(20);
    expect(res.suspectPinpoints.length).toBeGreaterThan(0);
    expect(res.suspectPinpoints[0].suspectStartMove).toBeGreaterThanOrEqual(6);
    expect(res.suspectPinpoints[0].suspectEndMove).toBeGreaterThanOrEqual(20);
    expect(res.suspectPinpoints[0].sampleMoves.length).toBeGreaterThan(0);
    expect(res.recentMatches[0].pinpointMoveRange).toContain('#');

    const liveSnap = summarizeLiveMoveTimes(
      'testengine99',
      [1.2, 2.1, 1.5, 36.0, 4.4, 4.6, 4.3, 4.5, 4.4, 4.6, 4.5, 4.4],
      [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
    );
    const trReport = buildFairPlayEvidenceReport(res, 'tr', liveSnap);
    const enReport = buildFairPlayEvidenceReport(res, 'en', liveSnap);
    expect(trReport).toContain('Chess Sentinel v4.1');
    expect(trReport).toContain('9. hamlede 36sn duraksama -> 10.-17. hamleler robotik');
    expect(enReport).toContain('Move #9 (36s pause) -> Moves #10-#17 mechanical');
    expect(enReport).toContain('https://www.chess.com/game/live/999000');
  });
});
