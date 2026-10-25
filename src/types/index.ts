export type Language = 'en' | 'tr';

export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily';

export type SensitivityPreset = 'conservative' | 'balanced' | 'strict';

export type RiskTierId = 'low' | 'guarded' | 'elevated' | 'high' | 'critical' | 'banned';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface ChessComProfile {
  player_id?: number;
  '@id'?: string;
  url?: string;
  name?: string;
  username: string;
  title?: string;
  followers?: number;
  country?: string;
  location?: string;
  last_online?: number;
  joined?: number;
  status?: string;
  is_streamer?: boolean;
  verified?: boolean;
  avatar?: string;
  league?: string;
}

export interface ChessComFormatRecord {
  last?: {
    rating: number;
    date?: number;
    rd?: number;
  };
  best?: {
    rating: number;
    date?: number;
    game?: string;
  };
  record?: {
    win: number;
    loss: number;
    draw: number;
    time_per_move?: number;
    timeout_percent?: number;
  };
}

export interface ChessComStats {
  chess_bullet?: ChessComFormatRecord;
  chess_blitz?: ChessComFormatRecord;
  chess_rapid?: ChessComFormatRecord;
  chess_daily?: ChessComFormatRecord;
  fide?: number;
  tactics?: {
    highest?: { rating: number; date?: number };
    lowest?: { rating: number; date?: number };
  };
  puzzle_rush?: {
    best?: { total_attempts: number; score: number };
  };
  [key: string]: unknown;
}

export interface ChessComGamePlayer {
  rating: number;
  result: string;
  '@id'?: string;
  username: string;
  uuid?: string;
}

export interface ChessComGame {
  url?: string;
  pgn?: string;
  time_control?: string;
  end_time?: number;
  rated?: boolean;
  accuracies?: {
    white: number;
    black: number;
  };
  tcn?: string;
  uuid?: string;
  initial_setup?: string;
  fen?: string;
  time_class?: TimeClass | string;
  rules?: string;
  white: ChessComGamePlayer;
  black: ChessComGamePlayer;
}

export interface PlayerRawBundle {
  username: string;
  profile: ChessComProfile;
  stats: ChessComStats;
  recentGames: ChessComGame[];
  fetchedAt: number;
}

export interface PacingGameMetrics {
  timeClass: string;
  movesAnalyzed: number;
  meanMoveSec: number;
  stdMoveSec: number;
  cv: number;
  qcd: number; // Robust Quartile Coefficient of Dispersion (Q3-Q1)/(Q3+Q1)
  entropyBits: number; // Shannon entropy across 7 log-time buckets (0 - 2.81 bits)
  fastMoveRatio: number;
  roboticBandRatio: number;
  isFlatline: boolean;
  hasMidgameToggle: boolean;
  won: boolean;
}

export interface PacingSummary {
  gamesAnalyzed: number;
  medianCV: number | null;
  medianQCD: number | null;
  meanEntropyBits: number | null;
  minCV: number | null;
  meanFastMoveRatio: number | null;
  meanRoboticBandRatio: number | null;
  flatlineGames: number;
  flatlineRate: number;
  toggleGames: number;
  isConfirmedHumanPacing: boolean;
  pacingScore: number; // 0-100
}

export interface SignalBreakdown {
  recentWinrate: number;    // 0-100
  overallWinrate: number;   // 0-100
  accuracyAnomaly: number;  // 0-100
  movePacing: number;       // 0-100
  eloVelocity: number;      // 0-100
  accountTrust: number;     // 0-100
}

export interface FormatTelemetry {
  format: TimeClass;
  currentRating: number | null;
  peakRating: number | null;
  rd: number | null;
  overallWins: number;
  overallLosses: number;
  overallDraws: number;
  overallTotal: number;
  overallWinPct: number;
  recentWins: number;
  recentLosses: number;
  recentDraws: number;
  recentTotal: number;
  recentWinPct: number;
  avgAccuracy: number | null;
  expectedAccuracy: number;
  highAccCeiling: number;
  highAccRate: number;
  reviewedGames: number;
  eloZScore: number;
  performanceRating: number | null;
  eloDelta7d: number | null;
  eloDelta30d: number | null;
  formatProbability: number;
}

export interface InsightFlag {
  id: string;
  severity: 'positive' | 'info' | 'warning' | 'danger';
  icon: string;
  params?: Record<string, string | number>;
}

export interface CheatAnalysisResult {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  countryCode: string | null;
  title: string | null;
  accountStatus: string;
  isBannedFairPlay: boolean;
  accountAgeDays: number | null;
  joinedTimestamp: number | null;
  primaryFormat: TimeClass;
  probability: number; // 0 - 100 (% cheat probability)
  tier: RiskTierId;
  confidence: ConfidenceLevel;
  winStreak: number;
  recentForm: Array<'W' | 'L' | 'D'>; // Last 8 games
  signals: SignalBreakdown;
  pacing: PacingSummary;
  formats: Record<TimeClass, FormatTelemetry>;
  flags: InsightFlag[];
  analyzedGamesCount: number;
  timestamp: number;
}

export interface WatchlistEntry {
  username: string;
  addedAt: number;
  initialProbability: number;
  ratingAtSave: number | null;
  format: TimeClass;
  avatarUrl: string | null;
  lastCheckedAt: number;
  isBannedFairPlay: boolean;
  accountStatus: string;
  notes?: string;
}

export interface SentinelSettings {
  language: Language;
  autoShowHud: boolean;
  compactMode: boolean;
  showInlineBadge: boolean;
  ratedOnly: boolean;
  sensitivity: SensitivityPreset;
  hudPosition: { right: number; top: number } | null;
}

export type ExtensionMessage =
  | { type: 'ANALYZE_PLAYER'; username: string; preferredFormat?: TimeClass; forceRefresh?: boolean }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<SentinelSettings> }
  | { type: 'GET_WATCHLIST' }
  | { type: 'TOGGLE_WATCHLIST'; entry: Omit<WatchlistEntry, 'addedAt' | 'lastCheckedAt'> }
  | { type: 'REMOVE_WATCHLIST'; username: string }
  | { type: 'REFRESH_WATCHLIST_BANS' }
  | { type: 'GET_RECENT_SCANS' }
  | { type: 'TOGGLE_HUD_FROM_POPUP' };
