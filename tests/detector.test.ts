import { describe, expect, it } from 'vitest';
import { isChessComBoardUrl, sanitizeChessUsername } from '../src/content/detector';

describe('Chess.com 2026 DOM & URL Detector Utilities', () => {
  it('recognizes all legacy and 2026 Chess.com board routes', () => {
    expect(isChessComBoardUrl('https://www.chess.com/game/live/128552032877')).toBe(true);
    expect(isChessComBoardUrl('https://www.chess.com/game/185842167286')).toBe(true);
    expect(isChessComBoardUrl('https://www.chess.com/play/online')).toBe(true);
    expect(isChessComBoardUrl('https://www.chess.com/play/online/new')).toBe(true);
    expect(isChessComBoardUrl('https://www.chess.com/analysis/game/live/999')).toBe(true);
    expect(isChessComBoardUrl('https://www.chess.com/settings')).toBe(false);
  });

  it('sanitizes usernames while stripping FIDE titles, parenthesized ratings, and UI placeholders', () => {
    expect(sanitizeChessUsername('GM Hikaru (3245)')).toBe('Hikaru');
    expect(sanitizeChessUsername('  GothamChess  ')).toBe('GothamChess');
    expect(sanitizeChessUsername('Opponent')).toBeNull();
    expect(sanitizeChessUsername('Rakip')).toBeNull();
    expect(sanitizeChessUsername('Searching...')).toBeNull();
    expect(sanitizeChessUsername('Guest1948271')).toBeNull();
  });

  it('preserves ALL numeric usernames (1-digit, 3-digit, 4-digit, leading digits, all-digits, mixed)', () => {
    const numericCases: Array<[string, string]> = [
      ['kaan1907', 'kaan1907'],
      ['1907fb', '1907fb'],
      ['007bond', '007bond'],
      ['123chess', '123chess'],
      ['fatihmehmettezcan5', 'fatihmehmettezcan5'],
      ['chessleopard1969', 'chessleopard1969'],
      ['sumitgm000', 'sumitgm000'],
      ['al123', 'al123'],
      ['k1905', 'k1905'],
      ['99_king_99', '99_king_99'],
      ['12345678', '12345678'],
      ['a1b2c3d4', 'a1b2c3d4'],
      ['GM1907', 'GM1907'],
      ['FM kaan1907 (1842)', 'kaan1907'],
      ['1905_gs (2105)', '1905_gs'],
      ['  \u200Bplayer2026\u200B (950) ', 'player2026'],
    ];

    for (const [raw, expected] of numericCases) {
      expect(sanitizeChessUsername(raw)).toBe(expected);
    }
  });
});
