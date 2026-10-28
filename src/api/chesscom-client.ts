import {
  ChessComGame,
  ChessComProfile,
  ChessComStats,
  GameCallbackHydration,
  PlayerRawBundle,
  TimeClass,
} from '../types';

const API_BASE = 'https://api.chess.com/pub';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TARGET_MIN_GAMES = 30;
const MAX_ARCHIVES_TO_WALK = 3;
const STORAGE_CACHE_KEY = 'sentinel_bundle_cache_v4';

interface CacheItem {
  bundle: PlayerRawBundle;
  expiresAt: number;
}

function hasLocalStorageApi(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

function inferTimeClassFromBaseSec(baseSec: number, incSec: number): TimeClass {
  const est = baseSec + 40 * incSec;
  if (est < 180) return 'bullet';
  if (est < 600) return 'blitz';
  return 'rapid';
}

/**
 * Parses Chess.com's comma-separated decisecond `moveTimestamps` string into
 * per-move durations (`#2..#N`) for White and Black.
 */
export function parseCallbackMoveTimestamps(
  rawTimestamps: string | undefined,
  baseTimeDs = 6000,
  incrementDs = 0
): {
  whiteTimesSec: number[];
  whiteMoveNumbers: number[];
  blackTimesSec: number[];
  blackMoveNumbers: number[];
} {
  if (!rawTimestamps || typeof rawTimestamps !== 'string') {
    return { whiteTimesSec: [], whiteMoveNumbers: [], blackTimesSec: [], blackMoveNumbers: [] };
  }

  const tokens = rawTimestamps
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);

  const whiteClocksSec: number[] = [];
  const blackClocksSec: number[] = [];

  for (let idx = 0; idx < tokens.length; idx++) {
    const sec = tokens[idx] / 10;
    if (idx % 2 === 0) whiteClocksSec.push(sec);
    else blackClocksSec.push(sec);
  }

  const incSec = Math.max(0, incrementDs / 10);
  void baseTimeDs;

  const buildDeltas = (clocks: number[]) => {
    const times: number[] = [];
    const nums: number[] = [];
    for (let i = 1; i < clocks.length; i++) {
      const elapsed = clocks[i - 1] - clocks[i] + incSec;
      const clamped = Math.min(240, Math.max(0.1, Number(elapsed.toFixed(1))));
      times.push(clamped);
      nums.push(i + 1); // Move #2 .. #N
    }
    return { times, nums };
  };

  const w = buildDeltas(whiteClocksSec);
  const b = buildDeltas(blackClocksSec);

  return {
    whiteTimesSec: w.times,
    whiteMoveNumbers: w.nums,
    blackTimesSec: b.times,
    blackMoveNumbers: b.nums,
  };
}

/**
 * Resilient Chess.com Published-Data & Live Callback Client (v4.0).
 * - Enforces serial PubAPI request execution to respect Chess.com rate limits.
 * - Persists short-TTL (5-min) bundle cache in `chrome.storage.local` so MV3 worker restarts stay instant.
 * - Hydrates live/finished game decisecond clocks via `chess.com/callback/live/game/{id}`.
 */
export class ChessComApiClient {
  private memoryCache = new Map<string, CacheItem>();
  private queue: Promise<unknown> = Promise.resolve();

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async readDiskCache(cleanUser: string): Promise<PlayerRawBundle | null> {
    if (!hasLocalStorageApi()) return null;
    try {
      const stored = await chrome.storage.local.get(STORAGE_CACHE_KEY);
      const map = (stored[STORAGE_CACHE_KEY] || {}) as Record<string, CacheItem>;
      const entry = map[cleanUser];
      if (entry && entry.expiresAt > Date.now() && entry.bundle) {
        this.memoryCache.set(cleanUser, entry);
        return entry.bundle;
      }
    } catch {
      // Ignore storage access errors
    }
    return null;
  }

  private async writeDiskCache(cleanUser: string, item: CacheItem): Promise<void> {
    if (!hasLocalStorageApi()) return;
    try {
      const stored = await chrome.storage.local.get(STORAGE_CACHE_KEY);
      const rawMap = (stored[STORAGE_CACHE_KEY] || {}) as Record<string, CacheItem>;
      const now = Date.now();
      const prunedEntries = Object.entries(rawMap)
        .filter(([, v]) => v && v.expiresAt > now)
        .slice(-24);
      const nextMap: Record<string, CacheItem> = Object.fromEntries(prunedEntries);
      nextMap[cleanUser] = item;
      await chrome.storage.local.set({ [STORAGE_CACHE_KEY]: nextMap });
    } catch {
      // Ignore quota errors
    }
  }

  private async fetchJson<T>(url: string, retries = 2): Promise<T> {
    return this.enqueue(async () => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 9000);

        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
            credentials: 'omit',
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (response.status === 404) {
            throw new Error('PLAYER_NOT_FOUND');
          }

          if (response.status === 429) {
            await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
            continue;
          }

          if (!response.ok) {
            throw new Error(`HTTP_${response.status}`);
          }

          const data = (await response.json()) as Record<string, unknown>;
          if (typeof data.code === 'number' && data.code === 0 && data.message) {
            throw new Error('CHESSCOM_INTERNAL_ERROR');
          }

          return data as T;
        } catch (err) {
          clearTimeout(timer);
          lastError = err instanceof Error ? err : new Error(String(err));
          if (lastError.message === 'PLAYER_NOT_FOUND') {
            throw lastError;
          }
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
          }
        }
      }

      throw lastError || new Error('API_FETCH_FAILED');
    });
  }

  async fetchProfileOnly(username: string): Promise<ChessComProfile> {
    const clean = username.trim().toLowerCase();
    return this.fetchJson<ChessComProfile>(`${API_BASE}/player/${encodeURIComponent(clean)}`);
  }

  async fetchGameCallback(gameId: string): Promise<GameCallbackHydration | null> {
    if (!/^\d{6,16}$/.test(gameId)) return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      const resp = await fetch(`https://www.chess.com/callback/live/game/${gameId}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) return null;

      const data = (await resp.json()) as {
        game?: {
          isFinished?: boolean;
          isRated?: boolean;
          isAbortable?: boolean;
          moveTimestamps?: string;
          baseTime1?: number;
          timeIncrement1?: number;
        };
        players?: {
          top?: { username?: string; color?: string };
          bottom?: { username?: string; color?: string };
        };
      };

      const g = data.game;
      if (!g) return null;

      const baseDs = typeof g.baseTime1 === 'number' ? g.baseTime1 : 6000;
      const incDs = typeof g.timeIncrement1 === 'number' ? g.timeIncrement1 : 0;
      const parsed = parseCallbackMoveTimestamps(g.moveTimestamps, baseDs, incDs);

      const topColor = data.players?.top?.color || 'black';
      const topIsWhite = topColor.toLowerCase() === 'white';

      return {
        gameId,
        isFinished: Boolean(g.isFinished),
        isRated: g.isRated !== false,
        isAbortable: Boolean(g.isAbortable),
        detectedFormat: inferTimeClassFromBaseSec(baseDs / 10, incDs / 10),
        topPlayer: data.players?.top?.username || null,
        bottomPlayer: data.players?.bottom?.username || null,
        topTimesSec: topIsWhite ? parsed.whiteTimesSec : parsed.blackTimesSec,
        topMoveNumbers: topIsWhite ? parsed.whiteMoveNumbers : parsed.blackMoveNumbers,
        bottomTimesSec: topIsWhite ? parsed.blackTimesSec : parsed.whiteTimesSec,
        bottomMoveNumbers: topIsWhite ? parsed.blackMoveNumbers : parsed.whiteMoveNumbers,
      };
    } catch {
      return null;
    }
  }

  async fetchPlayerBundle(username: string, forceRefresh = false): Promise<PlayerRawBundle> {
    const clean = username.trim().toLowerCase();
    if (!clean) throw new Error('INVALID_USERNAME');

    if (!forceRefresh) {
      const cached = this.memoryCache.get(clean);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.bundle;
      }
      const diskCached = await this.readDiskCache(clean);
      if (diskCached) return diskCached;
    }

    const profile = await this.fetchProfileOnly(clean);

    let stats: ChessComStats = {};
    try {
      stats = await this.fetchJson<ChessComStats>(
        `${API_BASE}/player/${encodeURIComponent(clean)}/stats`
      );
    } catch {
      stats = {};
    }

    let archiveUrls: string[] = [];
    try {
      const archResp = await this.fetchJson<{ archives?: string[] }>(
        `${API_BASE}/player/${encodeURIComponent(clean)}/games/archives`
      );
      archiveUrls = Array.isArray(archResp.archives) ? archResp.archives : [];
    } catch {
      archiveUrls = [];
    }

    const recentGames: ChessComGame[] = [];
    const candidateArchives = archiveUrls.slice(-MAX_ARCHIVES_TO_WALK).reverse();
    for (const archUrl of candidateArchives) {
      try {
        const secureUrl = archUrl.replace(/^http:\/\//i, 'https://');
        const monthData = await this.fetchJson<{ games?: ChessComGame[] }>(secureUrl, 1);
        if (Array.isArray(monthData.games)) {
          recentGames.push(...monthData.games);
        }
        if (recentGames.length >= TARGET_MIN_GAMES) {
          break;
        }
      } catch {
        continue;
      }
    }

    recentGames.sort((a, b) => (b.end_time || 0) - (a.end_time || 0));
    const trimmedGames = recentGames.slice(0, 120);

    const bundle: PlayerRawBundle = {
      username: clean,
      profile,
      stats,
      recentGames: trimmedGames,
      fetchedAt: Date.now(),
    };

    const cacheItem: CacheItem = {
      bundle,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    this.memoryCache.set(clean, cacheItem);
    if (this.memoryCache.size > 60) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) this.memoryCache.delete(oldestKey);
    }
    void this.writeDiskCache(clean, cacheItem);

    return bundle;
  }
}

export const chessComApi = new ChessComApiClient();
