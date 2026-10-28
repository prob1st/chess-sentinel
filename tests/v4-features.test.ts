import { describe, expect, it } from 'vitest';
import { parseCallbackMoveTimestamps } from '../src/api/chesscom-client';
import {
  extractGameIdFromUrl,
  extractMemberProfileFromUrl,
} from '../src/content/detector';
import { HUD_SHADOW_CSS } from '../src/content/hud-styles';
import { summarizeLiveMoveTimes } from '../src/content/live-clock-monitor';
import { TIER_THEMES } from '../src/core/calibration';
import { analyzePlayerBundle, computeEffectiveLiveRisk } from '../src/core/engine';
import { TRANSLATIONS } from '../src/i18n/translations';
import { PlayerRawBundle } from '../src/types';
import { ICONS } from '../src/utils/icons';

function collectStrings(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj];
  if (obj && typeof obj === 'object') {
    return Object.values(obj).flatMap((v) => collectStrings(v));
  }
  return [];
}

describe('v4.1 High-Craft Zero-Slop Obsidian UI, Server Callback Clocks, Profile URLs & Live Risk Fusion', () => {
  it('contains strictly ZERO emojis and ZERO em-dashes across all TR/EN UI strings and SVG icons, and uses jewel-tone RGB themes', () => {
    const allStrings = [...collectStrings(TRANSLATIONS), ...collectStrings(ICONS)];
    const emojiRegex = /\p{Extended_Pictographic}/u;
    for (const str of allStrings) {
      expect(emojiRegex.test(str), `Found emoji in string: ${str}`).toBe(false);
      expect(str.includes('—'), `Found em-dash in string: ${str}`).toBe(false);
    }

    for (const theme of Object.values(TIER_THEMES)) {
      expect(theme.rgb).toMatch(/^\d+,\s*\d+,\s*\d+$/);
    }
    expect(HUD_SHADOW_CSS).toContain('rgba(15, 16, 20');
    expect(HUD_SHADOW_CSS).toContain('inset 0 1px 0 rgba(255, 255, 255, 0.09)');
    expect(HUD_SHADOW_CSS).not.toContain('#21201d');
  });

  it('extracts game IDs and member profile usernames across live, finished, analysis, and localized URLs', () => {
    expect(extractGameIdFromUrl('https://www.chess.com/game/186042459832')).toBe('186042459832');
    expect(extractGameIdFromUrl('https://www.chess.com/game/live/186042459832')).toBe('186042459832');
    expect(extractGameIdFromUrl('https://www.chess.com/analysis/game/live/186042459832?tab=review')).toBe('186042459832');
    expect(extractMemberProfileFromUrl('https://www.chess.com/member/gamer-rahUL')).toBe('gamer-rahUL');
    expect(extractMemberProfileFromUrl('https://www.chess.com/tr/member/Prob1st')).toBe('Prob1st');
    expect(extractMemberProfileFromUrl('https://www.chess.com/play/online')).toBeNull();
  });

  it('reconstructs exact 0.1s decisecond move durations from Chess.com callback moveTimestamps', () => {
    const parsed = parseCallbackMoveTimestamps(
      '5999,5979,5985,5951,5964,5946,5941,5928',
      6000,
      0
    );
    // White: 599.9 -> 598.5 (1.4s), 598.5 -> 596.4 (2.1s), 596.4 -> 594.1 (2.3s)
    expect(parsed.whiteTimesSec).toEqual([1.4, 2.1, 2.3]);
    expect(parsed.whiteMoveNumbers).toEqual([2, 3, 4]);
    // Black: 597.9 -> 595.1 (2.8s), 595.1 -> 594.6 (0.5s), 594.6 -> 592.8 (1.8s)
    expect(parsed.blackTimesSec).toEqual([2.8, 0.5, 1.8]);
    expect(parsed.blackMoveNumbers).toEqual([2, 3, 4]);
  });

  it('dynamically escalates effective risk on live mechanical toggle while keeping 0% inflation on humans', () => {
    const cleanBundle: PlayerRawBundle = {
      username: 'calmplayer88',
      fetchedAt: Date.now(),
      profile: {
        username: 'CalmPlayer88',
        joined: Math.floor(Date.now() / 1000) - 500 * 86400,
        status: 'basic',
      },
      stats: {
        chess_rapid: {
          last: { rating: 1620, rd: 45 },
          best: { rating: 1650 },
          record: { win: 200, loss: 198, draw: 20 },
        },
      },
      recentGames: [],
    };

    const baseRes = analyzePlayerBundle(cleanBundle);
    expect(baseRes.probability).toBeLessThanOrEqual(5);

    // Normal human live pacing -> strictly 0 inflation
    const humanLive = summarizeLiveMoveTimes(
      'CalmPlayer88',
      [1.1, 4.2, 0.8, 17.5, 2.4, 0.9, 11.2, 1.6, 6.4, 0.7]
    );
    const effHuman = computeEffectiveLiveRisk(baseRes, humanLive);
    expect(effHuman.probability).toBe(baseRes.probability);
    expect(effHuman.liveEscalated).toBe(false);

    // Mid-game 38s pause followed by 9 robotic 4.5s moves -> escalates dynamically!
    const suspectLive = summarizeLiveMoveTimes(
      'CalmPlayer88',
      [1.2, 2.0, 38.0, 4.5, 4.4, 4.6, 4.5, 4.4, 4.5, 4.6, 4.4, 4.5],
      [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
    );
    const effSuspect = computeEffectiveLiveRisk(baseRes, suspectLive);
    expect(effSuspect.liveEscalated).toBe(true);
    expect(effSuspect.probability).toBeGreaterThanOrEqual(74);
    expect(['elevated', 'high']).toContain(effSuspect.tier);
  });
});
