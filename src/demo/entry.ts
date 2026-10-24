import { DEFAULT_SETTINGS } from '../core/calibration';
import { analyzePlayerBundle } from '../core/engine';
import { SentinelHudOverlay } from '../content/hud-overlay';
import { renderInlineUsernameBadge } from '../content/inline-badge';
import { CheatAnalysisResult, Language, PlayerRawBundle, SentinelSettings } from '../types';

const settings: SentinelSettings = {
  ...DEFAULT_SETTINGS,
  language: 'tr',
  autoShowHud: true,
  showInlineBadge: true,
};

const watchlist = new Set<string>();
let currentTarget: 'top' | 'bottom' = 'top';
let lastBundleTop: PlayerRawBundle | null = null;
let lastResult: CheatAnalysisResult | null = null;
let fakeNowOverride: number | undefined = undefined;

const hud = new SentinelHudOverlay(settings, {
  onSwapTarget: () => {
    currentTarget = currentTarget === 'top' ? 'bottom' : 'top';
    const targetUser =
      currentTarget === 'top'
        ? document.getElementById('top-username-txt')?.textContent?.trim() || 'sumitgm000'
        : 'chessleopard1969';
    void loadLivePlayer(targetUser, 'normal');
  },
  onRefresh: () => {
    if (lastBundleTop) {
      renderBundle(lastBundleTop, fakeNowOverride);
    }
  },
  onToggleLanguage: (nextLang: Language) => {
    settings.language = nextLang;
    hud.updateSettings(settings);
    if (lastResult) {
      renderInlineUsernameBadge(lastResult, currentTarget, settings.language, () =>
        hud.expandFromBadge()
      );
    }
  },
  onToggleWatchlist: (res) => {
    const key = res.username.toLowerCase();
    if (watchlist.has(key)) watchlist.delete(key);
    else watchlist.add(key);
    hud.setWatchedState(watchlist.has(key));
  },
  onSavePosition: () => {},
});

function renderBundle(bundle: PlayerRawBundle, nowMs?: number): void {
  const result = analyzePlayerBundle(bundle, {
    ratedOnly: settings.ratedOnly,
    sensitivity: settings.sensitivity,
    nowMs,
  });
  lastResult = result;

  // Update mock Chess.com player bar
  const topNameEl = document.getElementById('top-username-txt');
  const topEloEl = document.getElementById('top-elo-txt');
  const topTitleEl = document.getElementById('top-title-pill');
  const topAvatarEl = document.getElementById('top-avatar-box');

  if (topNameEl) topNameEl.textContent = result.displayName;
  const pf = result.formats[result.primaryFormat];
  if (topEloEl) topEloEl.textContent = `(${pf.currentRating || 1500})`;
  if (topTitleEl) {
    if (result.title) {
      topTitleEl.style.display = 'inline-block';
      topTitleEl.textContent = result.title;
    } else {
      topTitleEl.style.display = 'none';
    }
  }
  if (topAvatarEl) {
    if (result.avatarUrl) {
      topAvatarEl.innerHTML = `<img src="${result.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:6px" alt=""/>`;
    } else {
      topAvatarEl.textContent = result.displayName[0]?.toUpperCase() || '?';
    }
  }

  hud.showResult(result, watchlist.has(result.username.toLowerCase()), true);
  renderInlineUsernameBadge(result, 'top', settings.language, () => hud.expandFromBadge());
}

async function loadLivePlayer(
  username: string,
  mode: 'normal' | 'preban_cheater' = 'normal'
): Promise<void> {
  const clean = username.trim();
  if (!clean) return;
  currentTarget = 'top';
  hud.showLoading(clean);

  const statusEl = document.getElementById('demo-status');
  if (statusEl) statusEl.textContent = `Canlı Chess.com API'den @${clean} çekiliyor...`;

  try {
    const resp = await fetch(`/api/player-bundle?username=${encodeURIComponent(clean)}&mode=${mode}`);
    const data = (await resp.json()) as {
      ok: boolean;
      bundle?: PlayerRawBundle;
      fakeNowMs?: number;
      error?: string;
    };

    if (!data.ok || !data.bundle) {
      hud.showError(clean, data.error || 'Oyuncu bulunamadı');
      if (statusEl) statusEl.textContent = `Hata: ${data.error || 'Oyuncu bulunamadı'}`;
      return;
    }

    lastBundleTop = data.bundle;
    fakeNowOverride = data.fakeNowMs;
    renderBundle(data.bundle, data.fakeNowMs);
    if (statusEl) {
      statusEl.textContent = `@${data.bundle.profile.username} analiz edildi (${data.bundle.recentGames.length} maç, PGN %clk & CAPS2 aktif).`;
    }
  } catch (err) {
    hud.showError(clean, err instanceof Error ? err.message : 'Network error');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // Preset scenario buttons
  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const user = (btn as HTMLElement).dataset.user || 'sumitgm000';
      const mode = ((btn as HTMLElement).dataset.mode || 'normal') as 'normal' | 'preban_cheater';
      void loadLivePlayer(user, mode);
    });
  });

  const form = document.getElementById('live-lookup-form') as HTMLFormElement | null;
  const input = document.getElementById('live-lookup-input') as HTMLInputElement | null;
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input?.value.trim()) {
      document.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('active'));
      void loadLivePlayer(input.value.trim(), 'normal');
    }
  });

  // Boot directly into the real pre-ban cheater benchmark so user immediately sees %89 CRITICAL HUD!
  void loadLivePlayer('sumitgm000', 'preban_cheater');
});
