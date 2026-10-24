import { DEFAULT_SETTINGS } from '../core/calibration';
import { CheatAnalysisResult, SentinelSettings, WatchlistEntry } from '../types';

const KEYS = {
  SETTINGS: 'sentinel_settings_v1',
  WATCHLIST: 'sentinel_watchlist_v1',
  RECENT_SCANS: 'sentinel_recent_scans_v1',
} as const;

const MAX_RECENT_SCANS = 20;

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

export async function getSettings(): Promise<SentinelSettings> {
  if (!hasChromeStorage()) return { ...DEFAULT_SETTINGS };
  try {
    const res = await chrome.storage.local.get(KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(res[KEYS.SETTINGS] || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function updateSettings(patch: Partial<SentinelSettings>): Promise<SentinelSettings> {
  const current = await getSettings();
  const next: SentinelSettings = { ...current, ...patch };
  if (hasChromeStorage()) {
    try {
      await chrome.storage.local.set({ [KEYS.SETTINGS]: next });
    } catch {
      // Ignore quota / context errors
    }
  }
  return next;
}

export async function getWatchlist(): Promise<WatchlistEntry[]> {
  if (!hasChromeStorage()) return [];
  try {
    const res = await chrome.storage.local.get(KEYS.WATCHLIST);
    return Array.isArray(res[KEYS.WATCHLIST]) ? res[KEYS.WATCHLIST] : [];
  } catch {
    return [];
  }
}

export async function saveWatchlist(list: WatchlistEntry[]): Promise<void> {
  if (!hasChromeStorage()) return;
  try {
    await chrome.storage.local.set({ [KEYS.WATCHLIST]: list });
  } catch {
    // Ignore
  }
}

export async function toggleWatchlistEntry(
  entry: Omit<WatchlistEntry, 'addedAt' | 'lastCheckedAt'>
): Promise<{ added: boolean; list: WatchlistEntry[] }> {
  const list = await getWatchlist();
  const userLower = entry.username.toLowerCase();
  const existingIdx = list.findIndex((item) => item.username.toLowerCase() === userLower);

  if (existingIdx >= 0) {
    list.splice(existingIdx, 1);
    await saveWatchlist(list);
    return { added: false, list };
  }

  const now = Date.now();
  const fullEntry: WatchlistEntry = {
    ...entry,
    username: userLower,
    addedAt: now,
    lastCheckedAt: now,
  };
  const next = [fullEntry, ...list].slice(0, 150);
  await saveWatchlist(next);
  return { added: true, list: next };
}

export async function removeWatchlistEntry(username: string): Promise<WatchlistEntry[]> {
  const list = await getWatchlist();
  const userLower = username.toLowerCase();
  const next = list.filter((item) => item.username.toLowerCase() !== userLower);
  await saveWatchlist(next);
  return next;
}

export async function getRecentScans(): Promise<CheatAnalysisResult[]> {
  if (!hasChromeStorage()) return [];
  try {
    const res = await chrome.storage.local.get(KEYS.RECENT_SCANS);
    return Array.isArray(res[KEYS.RECENT_SCANS]) ? res[KEYS.RECENT_SCANS] : [];
  } catch {
    return [];
  }
}

export async function recordRecentScan(result: CheatAnalysisResult): Promise<void> {
  if (!hasChromeStorage()) return;
  try {
    const current = await getRecentScans();
    const filtered = current.filter(
      (item) => item.username.toLowerCase() !== result.username.toLowerCase()
    );
    const next = [result, ...filtered].slice(0, MAX_RECENT_SCANS);
    await chrome.storage.local.set({ [KEYS.RECENT_SCANS]: next });
  } catch {
    // Ignore
  }
}
