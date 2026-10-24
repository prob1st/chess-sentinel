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

  it('sanitizes usernames while stripping FIDE titles, ratings, and UI placeholders', () => {
    expect(sanitizeChessUsername('GM Hikaru (3245)')).toBe('Hikaru');
    expect(sanitizeChessUsername('  GothamChess  ')).toBe('GothamChess');
    expect(sanitizeChessUsername('Opponent')).toBeNull();
    expect(sanitizeChessUsername('Rakip')).toBeNull();
    expect(sanitizeChessUsername('Searching...')).toBeNull();
    expect(sanitizeChessUsername('Guest1948271')).toBeNull();
  });
});
