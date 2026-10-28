export type Language = 'en' | 'tr';

export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily';

export type SensitivityPreset = 'conservative' | 'balanced' | 'strict';

export type RiskTierId = 'low' | 'guarded' | 'elevated' | 'high' | 'critical' | 'banned';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type PinpointAnomalyKind = 'midgame_toggle' | 'robotic_flatline' | 'caps2_spike';

export type PageSurfaceKind = 'live' | 'game' | 'profile';

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
  qcd: number;
  entropyBits: number;
  bucketCounts: number[];
  fastMoveRatio: number;
  roboticBandRatio: number;
  isFlatline: boolean;
  hasMidgameToggle: boolean;
  won: boolean;
  pauseMoveNumber: number | null;
  pauseSec: number | null;
  suspectStartMove: number;
  suspectEndMove: number;
  minBandSec: number | null;
  maxBandSec: number | null;
  sampleMoves: string[];
}

export interface SuspectGamePinpoint {
  kind: PinpointAnomalyKind;
  format: TimeClass | string;
  opponentUsername: string;
  opponentRating: number;
  gameUrl: string | null;
  endTime: number;
  accuracy: number | null;
  pauseMoveNumber: number | null;
  pauseSec: number | null;
  suspectStartMove: number;
  suspectEndMove: number;
  roboticMoveCount: number;
  minBandSec: number | null;
  maxBandSec: number | null;
  sampleMoves: string[];
}

export interface PacingSummary {
  gamesAnalyzed: number;
  medianCV: number | null;
  medianQCD: number | null;
  meanEntropyBits: number | null;
  minCV: number | null;
  meanFastMoveRatio: number | null;
  meanRoboticBandRatio: number | null;
  bucketDistribution: number[];
  flatlineGames: number;
  flatlineRate: number;
  toggleGames: number;
  isConfirmedHumanPacing: boolean;
  pacingScore: number;
}

export interface LiveMatchClockTelemetry {
  opponent: string;
  movesObserved: number;
  moveTimesSec: number[];
  moveNumbers: number[];
  moveSanLabels: string[];
  liveMeanSec: number | null;
  liveQCD: number | null;
  consecutiveRoboticMoves: number;
  detectedPauseSec: number | null;
  pauseMoveNumber: number | null;
  roboticStartMove: number | null;
  roboticEndMove: number | null;
  roboticMinSec: number | null;
  roboticMaxSec: number | null;
  isLiveSuspectPacing: boolean;
  source?: 'live_dom' | 'server_callback';
  isFinishedGame?: boolean;
  gameId?: string | null;
}

export interface GameCallbackHydration {
  gameId: string;
  isFinished: boolean;
  isRated: boolean;
  isAbortable: boolean;
  detectedFormat?: TimeClass;
  topPlayer: string | null;
  bottomPlayer: string | null;
  topTimesSec: number[];
  topMoveNumbers: number[];
  bottomTimesSec: number[];
  bottomMoveNumbers: number[];
}

export interface RecentMatchSummary {
  result: 'W' | 'L' | 'D';
  format: TimeClass | string;
  playerRating: number;
  opponentUsername: string;
  opponentRating: number;
  accuracy: number | null;
  plies: number;
  url: string | null;
  endTime: number;
  pinpointKind?: PinpointAnomalyKind | null;
  pinpointMoveRange?: string | null;
  moveTimesSec?: number[];
}

export interface SignalBreakdown {
  recentWinrate: number;
  overallWinrate: number;
  accuracyAnomaly: number;
  movePacing: number;
  eloVelocity: number;
  accountTrust: number;
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
  probability: number;
  tier: RiskTierId;
  confidence: ConfidenceLevel;
  winStreak: number;
  recentForm: Array<'W' | 'L' | 'D'>;
  recentMatches: RecentMatchSummary[];
  suspectPinpoints: SuspectGamePinpoint[];
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
  soundAlerts: boolean;
  sensitivity: SensitivityPreset;
  hudPosition: { right: number; top: number } | null;
}

export type ExtensionMessage =
  | { type: 'ANALYZE_PLAYER'; username: string; preferredFormat?: TimeClass; forceRefresh?: boolean }
  | { type: 'FETCH_GAME_CALLBACK'; gameId: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<SentinelSettings> }
  | { type: 'GET_WATCHLIST' }
  | { type: 'TOGGLE_WATCHLIST'; entry: Omit<WatchlistEntry, 'addedAt' | 'lastCheckedAt'> }
  | { type: 'REMOVE_WATCHLIST'; username: string }
  | { type: 'REFRESH_WATCHLIST_BANS' }
  | { type: 'GET_RECENT_SCANS' }
  | { type: 'TOGGLE_HUD_FROM_POPUP' }
  | { type: 'GET_ACTIVE_MATCH_STATE' };
