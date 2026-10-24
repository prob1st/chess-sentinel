import { chessComApi } from '../api/chesscom-client';
import { TIER_THEMES } from '../core/calibration';
import { analyzePlayerBundle } from '../core/engine';
import {
  getRecentScans,
  getSettings,
  getWatchlist,
  recordRecentScan,
  removeWatchlistEntry,
  saveWatchlist,
  toggleWatchlistEntry,
  updateSettings,
} from '../storage/store';
import { ExtensionMessage, WatchlistEntry } from '../types';

const WATCHLIST_ALARM = 'chess_sentinel_ban_check';

function setTabBadge(tabId: number | undefined, probability: number, tierColor: string): void {
  if (!tabId || typeof chrome === 'undefined' || !chrome.action) return;
  try {
    void chrome.action.setBadgeText({ tabId, text: `${probability}%` });
    void chrome.action.setBadgeBackgroundColor({ tabId, color: tierColor });
  } catch {
    // Ignore tab closed errors
  }
}

async function refreshWatchlistBans(): Promise<WatchlistEntry[]> {
  const list = await getWatchlist();
  if (list.length === 0) return list;

  const updated: WatchlistEntry[] = [];
  for (const item of list) {
    try {
      const profile = await chessComApi.fetchProfileOnly(item.username);
      const status = profile.status || 'basic';
      const isBannedFairPlay = status.toLowerCase().includes('fair_play_violations');
      updated.push({
        ...item,
        accountStatus: status,
        isBannedFairPlay,
        avatarUrl: profile.avatar || item.avatarUrl,
        lastCheckedAt: Date.now(),
      });
    } catch {
      updated.push({ ...item, lastCheckedAt: Date.now() });
    }
  }

  await saveWatchlist(updated);
  return updated;
}

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.alarms) {
    chrome.alarms.create(WATCHLIST_ALARM, { periodInMinutes: 720 }); // Check every 12h
  }
});

if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === WATCHLIST_ALARM) {
      void refreshWatchlistBans();
    }
  });
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  void (async () => {
    try {
      switch (message.type) {
        case 'ANALYZE_PLAYER': {
          const settings = await getSettings();
          const bundle = await chessComApi.fetchPlayerBundle(
            message.username,
            Boolean(message.forceRefresh)
          );
          const result = analyzePlayerBundle(bundle, {
            preferredFormat: message.preferredFormat,
            ratedOnly: settings.ratedOnly,
            sensitivity: settings.sensitivity,
          });

          await recordRecentScan(result);
          setTabBadge(sender.tab?.id, result.probability, TIER_THEMES[result.tier].color);
          sendResponse({ ok: true, result });
          break;
        }

        case 'GET_SETTINGS': {
          const settings = await getSettings();
          sendResponse({ ok: true, settings });
          break;
        }

        case 'UPDATE_SETTINGS': {
          const settings = await updateSettings(message.patch);
          sendResponse({ ok: true, settings });
          break;
        }

        case 'GET_WATCHLIST': {
          const list = await getWatchlist();
          sendResponse({ ok: true, list });
          break;
        }

        case 'TOGGLE_WATCHLIST': {
          const { added, list } = await toggleWatchlistEntry(message.entry);
          sendResponse({ ok: true, added, list });
          break;
        }

        case 'REMOVE_WATCHLIST': {
          const list = await removeWatchlistEntry(message.username);
          sendResponse({ ok: true, list });
          break;
        }

        case 'REFRESH_WATCHLIST_BANS': {
          const list = await refreshWatchlistBans();
          sendResponse({ ok: true, list });
          break;
        }

        case 'GET_RECENT_SCANS': {
          const scans = await getRecentScans();
          sendResponse({ ok: true, scans });
          break;
        }

        default:
          sendResponse({ ok: false, error: 'UNKNOWN_MESSAGE' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
      sendResponse({ ok: false, error: msg });
    }
  })();

  return true; // Keep async message channel open
});
