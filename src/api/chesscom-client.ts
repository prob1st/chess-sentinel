import {
  ChessComGame,
  ChessComProfile,
  ChessComStats,
  PlayerRawBundle,
} from '../types';

const API_BASE = 'https://api.chess.com/pub';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TARGET_MIN_GAMES = 30;
const MAX_ARCHIVES_TO_WALK = 3;

interface CacheItem {
  bundle: PlayerRawBundle;
  expiresAt: number;
}

/**
 * Resilient Chess.com Published-Data API Client.
 * - Enforces serial request execution to respect Chess.com's parallel rate-limiting rules.
 * - Handles Chess.com `{ code: 0 }` archive errors (e.g. oversized monthly archives) gracefully
 *   by walking backward through earlier monthly archives without failing.
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
            throw new Error(`PLAYER_NOT_FOUND`);
          }

          if (response.status === 429) {
            // Back off gently on rate-limit
            await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
            continue;
          }

          if (!response.ok) {
            throw new Error(`HTTP_${response.status}`);
          }

          const data = (await response.json()) as Record<string, unknown>;
          // Chess.com occasionally returns 200/500 JSON `{ code: 0, message: "An internal error..." }`
          if (typeof data.code === 'number' && data.code === 0 && data.message) {
            throw new Error(`CHESSCOM_INTERNAL_ERROR`);
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

  async fetchPlayerBundle(username: string, forceRefresh = false): Promise<PlayerRawBundle> {
    const clean = username.trim().toLowerCase();
    if (!clean) throw new Error('INVALID_USERNAME');

    if (!forceRefresh) {
      const cached = this.memoryCache.get(clean);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.bundle;
      }
    }

    const profile = await this.fetchProfileOnly(clean);

    let stats: ChessComStats = {};
    try {
      stats = await this.fetchJson<ChessComStats>(
        `${API_BASE}/player/${encodeURIComponent(clean)}/stats`
      );
    } catch {
      // Newly created accounts may occasionally return empty stats
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
    // Walk from newest monthly archive backwards until we have enough games or hit limit
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
        // Gracefully skip broken monthly archive (e.g. Hikaru mega-month `{code:0}`) and try previous month
        continue;
      }
    }

    // Keep most recent 120 games max so memory & CPU stay ultra-lean
    recentGames.sort((a, b) => (b.end_time || 0) - (a.end_time || 0));
    const trimmedGames = recentGames.slice(0, 120);

    const bundle: PlayerRawBundle = {
      username: clean,
      profile,
      stats,
      recentGames: trimmedGames,
      fetchedAt: Date.now(),
    };

    this.memoryCache.set(clean, {
      bundle,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    // Cap LRU memory cache at 60 players
    if (this.memoryCache.size > 60) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) this.memoryCache.delete(oldestKey);
    }

    return bundle;
  }
}

export const chessComApi = new ChessComApiClient();
