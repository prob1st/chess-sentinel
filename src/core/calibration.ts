import { RiskTierId, SensitivityPreset, SentinelSettings, TimeClass } from '../types';

export interface AccuracyBand {
  maxRating: number;
  expected: number;
  ceiling: number;
}

/**
 * Empirically calibrated Chess.com CAPS2 accuracy benchmarks per rating band & speed.
 * `expected`: mean CAPS2 accuracy of legitimate games in that rating bucket.
 * `ceiling`: ~95th-percentile threshold above which single-game performance is a spike.
 */
export const CAPS2_ACCURACY_BANDS: Record<TimeClass, AccuracyBand[]> = {
  bullet: [
    { maxRating: 800, expected: 69, ceiling: 80 },
    { maxRating: 1100, expected: 74, ceiling: 84 },
    { maxRating: 1400, expected: 77, ceiling: 86 },
    { maxRating: 1700, expected: 80, ceiling: 88 },
    { maxRating: 2000, expected: 82.5, ceiling: 90 },
    { maxRating: 2400, expected: 85.5, ceiling: 92 },
    { maxRating: Infinity, expected: 88.5, ceiling: 94.5 },
  ],
  blitz: [
    { maxRating: 800, expected: 70, ceiling: 80 },
    { maxRating: 1100, expected: 75, ceiling: 84 },
    { maxRating: 1400, expected: 78.5, ceiling: 87 },
    { maxRating: 1700, expected: 81, ceiling: 89 },
    { maxRating: 2000, expected: 83.5, ceiling: 90.5 },
    { maxRating: 2400, expected: 86.5, ceiling: 92.5 },
    { maxRating: Infinity, expected: 89.5, ceiling: 95 },
  ],
  rapid: [
    { maxRating: 800, expected: 71, ceiling: 81 },
    { maxRating: 1100, expected: 76, ceiling: 85 },
    { maxRating: 1400, expected: 79.5, ceiling: 88 },
    { maxRating: 1700, expected: 82, ceiling: 90 },
    { maxRating: 2000, expected: 84.5, ceiling: 91.5 },
    { maxRating: 2400, expected: 88, ceiling: 93.5 },
    { maxRating: Infinity, expected: 91, ceiling: 96 },
  ],
  daily: [
    { maxRating: 1200, expected: 78, ceiling: 88 },
    { maxRating: 1800, expected: 84, ceiling: 92 },
    { maxRating: 2400, expected: 89, ceiling: 95 },
    { maxRating: Infinity, expected: 92, ceiling: 97 },
  ],
};

export function getAccuracyBand(format: TimeClass, rating: number): AccuracyBand {
  const list = CAPS2_ACCURACY_BANDS[format] || CAPS2_ACCURACY_BANDS.blitz;
  for (const band of list) {
    if (rating < band.maxRating) return band;
  }
  return list[list.length - 1];
}

export const SENSITIVITY_MULTIPLIERS: Record<SensitivityPreset, number> = {
  conservative: 0.84,
  balanced: 1.0,
  strict: 1.18,
};

export interface TierTheme {
  id: RiskTierId;
  color: string;
  accentBg: string;
  glow: string;
  border: string;
}

export const TIER_THEMES: Record<RiskTierId, TierTheme> = {
  low: {
    id: 'low',
    color: '#10b981',
    accentBg: 'rgba(16, 185, 129, 0.14)',
    glow: 'rgba(16, 185, 129, 0.38)',
    border: 'rgba(16, 185, 129, 0.35)',
  },
  guarded: {
    id: 'guarded',
    color: '#38bdf8',
    accentBg: 'rgba(56, 189, 248, 0.14)',
    glow: 'rgba(56, 189, 248, 0.35)',
    border: 'rgba(56, 189, 248, 0.35)',
  },
  elevated: {
    id: 'elevated',
    color: '#f59e0b',
    accentBg: 'rgba(245, 158, 11, 0.15)',
    glow: 'rgba(245, 158, 11, 0.42)',
    border: 'rgba(245, 158, 11, 0.40)',
  },
  high: {
    id: 'high',
    color: '#f97316',
    accentBg: 'rgba(249, 115, 22, 0.16)',
    glow: 'rgba(249, 115, 22, 0.46)',
    border: 'rgba(249, 115, 22, 0.45)',
  },
  critical: {
    id: 'critical',
    color: '#ef4444',
    accentBg: 'rgba(239, 68, 68, 0.18)',
    glow: 'rgba(239, 68, 68, 0.55)',
    border: 'rgba(239, 68, 68, 0.55)',
  },
  banned: {
    id: 'banned',
    color: '#f43f5e',
    accentBg: 'rgba(244, 63, 94, 0.22)',
    glow: 'rgba(244, 63, 94, 0.65)',
    border: 'rgba(244, 63, 94, 0.70)',
  },
};

export function probabilityToTier(probability: number, isBanned = false): RiskTierId {
  if (isBanned) return 'banned';
  if (probability < 22) return 'low';
  if (probability < 40) return 'guarded';
  if (probability < 62) return 'elevated';
  if (probability < 80) return 'high';
  return 'critical';
}

export function getTitleDampener(title?: string | null): number {
  if (!title) return 1.0;
  const normalized = title.trim().toUpperCase();
  if (normalized === 'GM' || normalized === 'WGM') return 0.42;
  if (normalized === 'IM' || normalized === 'WIM') return 0.58;
  if (normalized === 'FM' || normalized === 'WFM' || normalized === 'NM' || normalized === 'CM') {
    return 0.78;
  }
  return 1.0;
}

export const DEFAULT_SETTINGS: SentinelSettings = {
  language: 'tr',
  autoShowHud: true,
  compactMode: false,
  showInlineBadge: true,
  ratedOnly: true,
  soundAlerts: true,
  sensitivity: 'balanced',
  hudPosition: null,
};

export const LIVE_FORMATS: TimeClass[] = ['rapid', 'blitz', 'bullet'];
