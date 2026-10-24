import { DEFAULT_SETTINGS, TIER_THEMES } from '../core/calibration';
import { formatAgeShort, formatFlag, TRANSLATIONS } from '../i18n/translations';
import {
  CheatAnalysisResult,
  ExtensionMessage,
  Language,
  SensitivityPreset,
  SentinelSettings,
  WatchlistEntry,
} from '../types';

type ActiveTab = 'scanner' | 'watchlist' | 'settings';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function barColor(score: number): string {
  if (score < 25) return '#10b981';
  if (score < 45) return '#38bdf8';
  if (score < 68) return '#f59e0b';
  if (score < 82) return '#f97316';
  return '#ef4444';
}

class PopupController {
  private root: HTMLElement;
  private tab: ActiveTab = 'scanner';
  private settings: SentinelSettings = { ...DEFAULT_SETTINGS };
  private recentScans: CheatAnalysisResult[] = [];
  private watchlist: WatchlistEntry[] = [];
  private activeResult: CheatAnalysisResult | null = null;
  private scanning = false;
  private checkingBans = false;
  private errorMsg: string | null = null;
  private searchQuery = '';

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async init(): Promise<void> {
    await this.loadAll();
    if (this.recentScans.length > 0) {
      this.activeResult = this.recentScans[0];
    }
    this.render();
  }

  private async send<T>(msg: ExtensionMessage): Promise<T> {
    return (await chrome.runtime.sendMessage(msg)) as T;
  }

  private async loadAll(): Promise<void> {
    try {
      const [sResp, rResp, wResp] = await Promise.all([
        this.send<{ ok: boolean; settings: SentinelSettings }>({ type: 'GET_SETTINGS' }),
        this.send<{ ok: boolean; scans: CheatAnalysisResult[] }>({ type: 'GET_RECENT_SCANS' }),
        this.send<{ ok: boolean; list: WatchlistEntry[] }>({ type: 'GET_WATCHLIST' }),
      ]);
      if (sResp?.ok) this.settings = sResp.settings;
      if (rResp?.ok) this.recentScans = rResp.scans;
      if (wResp?.ok) this.watchlist = wResp.list;
    } catch {
      // Fallback defaults
    }
  }

  private async runPlayerScan(username: string): Promise<void> {
    const clean = username.trim();
    if (!clean) return;
    this.scanning = true;
    this.errorMsg = null;
    this.render();

    try {
      const resp = await this.send<{
        ok: boolean;
        result?: CheatAnalysisResult;
        error?: string;
      }>({
        type: 'ANALYZE_PLAYER',
        username: clean,
        forceRefresh: true,
      });

      if (!resp.ok || !resp.result) {
        this.errorMsg =
          resp.error === 'PLAYER_NOT_FOUND'
            ? this.settings.language === 'tr'
              ? 'Oyuncu bulunamadı.'
              : 'Player not found.'
            : resp.error || 'API Error';
      } else {
        this.activeResult = resp.result;
        const scansResp = await this.send<{ ok: boolean; scans: CheatAnalysisResult[] }>({
          type: 'GET_RECENT_SCANS',
        });
        if (scansResp?.ok) this.recentScans = scansResp.scans;
      }
    } catch (e) {
      this.errorMsg = e instanceof Error ? e.message : 'Scan failed';
    } finally {
      this.scanning = false;
      this.render();
    }
  }

  private renderActiveResultCard(lang: Language): string {
    if (!this.activeResult) return '';
    const r = this.activeResult;
    const t = TRANSLATIONS[lang];
    const theme = TIER_THEMES[r.tier];
    const pf = r.formats[r.primaryFormat];
    const pctText = lang === 'tr' ? `%${r.probability}` : `${r.probability}%`;

    const bars = [
      { lbl: t.signals.recentWinrate, val: r.signals.recentWinrate },
      { lbl: t.signals.overallWinrate, val: r.signals.overallWinrate },
      { lbl: t.signals.accuracyAnomaly, val: r.signals.accuracyAnomaly },
      { lbl: t.signals.movePacing, val: r.signals.movePacing },
      { lbl: t.signals.eloVelocity, val: r.signals.eloVelocity },
      { lbl: t.signals.accountTrust, val: r.signals.accountTrust },
    ];

    const flagsHtml = r.flags
      .slice(0, 3)
      .map(
        (f) =>
          `<div style="font-size:10.5px;color:#cbd5e1;line-height:1.3">${f.icon} ${escapeHtml(
            formatFlag(lang, f.id, f.params)
          )}</div>`
      )
      .join('');

    return `
      <div class="scan-result-card" style="border-color:${theme.border}">
        <div class="scan-top">
          <div class="scan-user">
            ${
              r.avatarUrl
                ? `<img class="scan-avatar" src="${escapeHtml(r.avatarUrl)}" alt="" />`
                : `<div class="scan-avatar">${escapeHtml(r.displayName[0]?.toUpperCase() || '?')}</div>`
            }
            <div>
              <div>
                ${r.title ? `<span style="background:#dc2626;color:#fff;font-size:9px;font-weight:800;padding:1px 4px;border-radius:4px;margin-right:4px">${escapeHtml(r.title)}</span>` : ''}
                <a class="scan-name" href="https://www.chess.com/member/${encodeURIComponent(
                  r.displayName
                )}" target="_blank" rel="noopener noreferrer">@${escapeHtml(r.displayName)}</a>
              </div>
              <div class="scan-meta">
                ${escapeHtml(r.primaryFormat.toUpperCase())} ${pf.currentRating ?? '—'} •
                ${escapeHtml(formatAgeShort(r.accountAgeDays, lang))} •
                ${escapeHtml(t.tiers[r.tier].label)}
              </div>
            </div>
          </div>
          <div class="prob-badge-lg" style="background:${theme.accentBg};color:${theme.color};border:1px solid ${theme.border}">
            ${pctText}
          </div>
        </div>

        <div class="mini-bars">
          ${bars
            .map(
              (b) => `
            <div class="mini-bar-item">
              <div class="mini-bar-lbl">
                <span>${escapeHtml(b.lbl)}</span>
                <strong>${b.val}</strong>
              </div>
              <div class="mini-bar-track">
                <div class="mini-bar-fill" style="width:${b.val}%;background:${barColor(b.val)}"></div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>

        ${flagsHtml ? `<div style="display:flex;flex-direction:column;gap:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.06)">${flagsHtml}</div>` : ''}
      </div>
    `;
  }

  private renderScannerTab(lang: Language): string {
    const t = TRANSLATIONS[lang];
    const recentHtml =
      this.recentScans.length === 0
        ? `<div class="empty-state">${escapeHtml(t.popup.emptyScans)}</div>`
        : `<div class="item-list">
            ${this.recentScans
              .slice(0, 8)
              .map((item) => {
                const th = TIER_THEMES[item.tier];
                const pStr = lang === 'tr' ? `%${item.probability}` : `${item.probability}%`;
                return `
                  <div class="list-row" data-select-scan="${escapeHtml(item.username)}">
                    <div class="row-left">
                      <div>
                        <div class="row-name">@${escapeHtml(item.displayName)}</div>
                        <div class="row-sub">${escapeHtml(item.primaryFormat.toUpperCase())} • ${escapeHtml(
                          t.tiers[item.tier].label
                        )}</div>
                      </div>
                    </div>
                    <span class="row-prob" style="background:${th.accentBg};color:${th.color};border:1px solid ${th.border}">${pStr}</span>
                  </div>
                `;
              })
              .join('')}
          </div>`;

    return `
      <form class="search-bar" id="scan-form">
        <input
          class="search-input"
          id="scan-input"
          type="text"
          value="${escapeHtml(this.searchQuery)}"
          placeholder="${escapeHtml(t.popup.searchPlaceholder)}"
          autocomplete="off"
        />
        <button class="primary-btn" type="submit" ${this.scanning ? 'disabled' : ''}>
          ${this.scanning ? '…' : escapeHtml(t.popup.scanBtn)}
        </button>
      </form>
      ${this.errorMsg ? `<div style="color:#f87171;font-size:11.5px;font-weight:600">${escapeHtml(this.errorMsg)}</div>` : ''}
      ${this.renderActiveResultCard(lang)}
      <div class="sec-title">${escapeHtml(t.popup.recentScansTitle)}</div>
      ${recentHtml}
    `;
  }

  private renderWatchlistTab(lang: Language): string {
    const t = TRANSLATIONS[lang];
    const bannedCount = this.watchlist.filter((w) => w.isBannedFairPlay).length;

    const listHtml =
      this.watchlist.length === 0
        ? `<div class="empty-state">${escapeHtml(t.popup.emptyWatchlist)}</div>`
        : `<div class="item-list">
            ${this.watchlist
              .map((w) => {
                const initText = t.popup.addedOn.replace('{prob}', String(w.initialProbability));
                return `
                  <div class="list-row">
                    <div class="row-left">
                      <div>
                        <a class="row-name" style="text-decoration:none" href="https://www.chess.com/member/${encodeURIComponent(
                          w.username
                        )}" target="_blank" rel="noopener noreferrer">@${escapeHtml(w.username)}</a>
                        <div class="row-sub">${escapeHtml(initText)} • ${w.ratingAtSave ?? '—'} Elo</div>
                      </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px">
                      ${
                        w.isBannedFairPlay
                          ? `<span class="banned-pill">🚨 ${escapeHtml(t.popup.bannedTag)}</span>`
                          : `<span class="active-pill">${escapeHtml(t.popup.activeTag)}</span>`
                      }
                      <button class="pill-btn" data-remove-watch="${escapeHtml(w.username)}" title="${escapeHtml(
                        t.popup.removeBtn
                      )}">✕</button>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>`;

    return `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div class="sec-title">${escapeHtml(t.popup.watchlistTitle)} (${bannedCount}/${this.watchlist.length})</div>
        <button class="primary-btn" id="refresh-bans-btn" style="padding:6px 10px" ${
          this.checkingBans || this.watchlist.length === 0 ? 'disabled' : ''
        }>
          ${escapeHtml(this.checkingBans ? t.popup.checkingBans : t.popup.checkBansBtn)}
        </button>
      </div>
      ${listHtml}
    `;
  }

  private renderSettingsTab(lang: Language): string {
    const t = TRANSLATIONS[lang];
    const s = this.settings;

    return `
      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsLanguage)}</div>
        </div>
        <select class="select-input" data-setting-select="language">
          <option value="tr" ${s.language === 'tr' ? 'selected' : ''}>Türkçe (TR)</option>
          <option value="en" ${s.language === 'en' ? 'selected' : ''}>English (EN)</option>
        </select>
      </div>

      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsSensitivity)}</div>
        </div>
        <select class="select-input" data-setting-select="sensitivity">
          <option value="conservative" ${s.sensitivity === 'conservative' ? 'selected' : ''}>${escapeHtml(
            t.popup.sensitivityConservative
          )}</option>
          <option value="balanced" ${s.sensitivity === 'balanced' ? 'selected' : ''}>${escapeHtml(
            t.popup.sensitivityBalanced
          )}</option>
          <option value="strict" ${s.sensitivity === 'strict' ? 'selected' : ''}>${escapeHtml(
            t.popup.sensitivityStrict
          )}</option>
        </select>
      </div>

      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsAutoHud)}</div>
          <div class="setting-desc">${escapeHtml(t.popup.settingsAutoHudDesc)}</div>
        </div>
        <input class="toggle-input" type="checkbox" data-setting-check="autoShowHud" ${
          s.autoShowHud ? 'checked' : ''
        } />
      </div>

      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsInlineBadge)}</div>
          <div class="setting-desc">${escapeHtml(t.popup.settingsInlineBadgeDesc)}</div>
        </div>
        <input class="toggle-input" type="checkbox" data-setting-check="showInlineBadge" ${
          s.showInlineBadge ? 'checked' : ''
        } />
      </div>

      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsCompact)}</div>
          <div class="setting-desc">${escapeHtml(t.popup.settingsCompactDesc)}</div>
        </div>
        <input class="toggle-input" type="checkbox" data-setting-check="compactMode" ${
          s.compactMode ? 'checked' : ''
        } />
      </div>

      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsRatedOnly)}</div>
          <div class="setting-desc">${escapeHtml(t.popup.settingsRatedOnlyDesc)}</div>
        </div>
        <input class="toggle-input" type="checkbox" data-setting-check="ratedOnly" ${
          s.ratedOnly ? 'checked' : ''
        } />
      </div>
    `;
  }

  private render(): void {
    const lang = this.settings.language;
    const t = TRANSLATIONS[lang];

    const bodyHtml =
      this.tab === 'scanner'
        ? this.renderScannerTab(lang)
        : this.tab === 'watchlist'
          ? this.renderWatchlistTab(lang)
          : this.renderSettingsTab(lang);

    this.root.innerHTML = `
      <div class="popup-shell">
        <div class="top-bar">
          <div class="brand-group">
            <div class="brand-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                <path d="M12 2L4 5.5v6.2c0 5.3 3.4 9.9 8 11.3 4.6-1.4 8-6 8-11.3V5.5L12 2z"/>
                <path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div>
              <div class="brand-name">${escapeHtml(t.appName)}</div>
              <div class="brand-sub">${escapeHtml(t.appSubtitle)}</div>
            </div>
          </div>
          <div class="top-controls">
            <button class="pill-btn" id="quick-lang-btn">${lang === 'tr' ? 'EN' : 'TR'}</button>
            <button class="pill-btn" id="toggle-hud-btn" title="${escapeHtml(t.popup.toggleInPageHud)}">HUD</button>
          </div>
        </div>

        <div class="nav-tabs">
          <button class="nav-tab ${this.tab === 'scanner' ? 'active' : ''}" data-tab="scanner">
            ${escapeHtml(t.popup.tabScanner)}
          </button>
          <button class="nav-tab ${this.tab === 'watchlist' ? 'active' : ''}" data-tab="watchlist">
            ${escapeHtml(t.popup.tabWatchlist)} (${this.watchlist.length})
          </button>
          <button class="nav-tab ${this.tab === 'settings' ? 'active' : ''}" data-tab="settings">
            ${escapeHtml(t.popup.tabSettings)}
          </button>
        </div>

        <div class="tab-body">${bodyHtml}</div>

        <div class="footer-note">${escapeHtml(t.popup.privacyNote)}</div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.root.querySelectorAll('button[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.tab = (btn as HTMLElement).dataset.tab as ActiveTab;
        this.render();
      });
    });

    const quickLang = this.root.querySelector('#quick-lang-btn');
    quickLang?.addEventListener('click', () => {
      void (async () => {
        const next: Language = this.settings.language === 'tr' ? 'en' : 'tr';
        const resp = await this.send<{ ok: boolean; settings: SentinelSettings }>({
          type: 'UPDATE_SETTINGS',
          patch: { language: next },
        });
        if (resp?.ok) this.settings = resp.settings;
        this.render();
      })();
    });

    const toggleHudBtn = this.root.querySelector('#toggle-hud-btn');
    toggleHudBtn?.addEventListener('click', () => {
      void (async () => {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab?.id) {
            await chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_HUD_FROM_POPUP' });
          }
        } catch {
          // Not on a Chess.com tab
        }
      })();
    });

    const form = this.root.querySelector('#scan-form') as HTMLFormElement | null;
    const input = this.root.querySelector('#scan-input') as HTMLInputElement | null;
    if (input) {
      input.addEventListener('input', () => {
        this.searchQuery = input.value;
      });
    }
    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        void this.runPlayerScan(input.value);
      });
    }

    this.root.querySelectorAll('[data-select-scan]').forEach((row) => {
      row.addEventListener('click', () => {
        const u = (row as HTMLElement).dataset.selectScan;
        const found = this.recentScans.find((s) => s.username.toLowerCase() === u?.toLowerCase());
        if (found) {
          this.activeResult = found;
          this.render();
        }
      });
    });

    const refreshBansBtn = this.root.querySelector('#refresh-bans-btn');
    refreshBansBtn?.addEventListener('click', () => {
      void (async () => {
        this.checkingBans = true;
        this.render();
        const resp = await this.send<{ ok: boolean; list: WatchlistEntry[] }>({
          type: 'REFRESH_WATCHLIST_BANS',
        });
        if (resp?.ok) this.watchlist = resp.list;
        this.checkingBans = false;
        this.render();
      })();
    });

    this.root.querySelectorAll('button[data-remove-watch]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const u = (btn as HTMLElement).dataset.removeWatch;
        if (!u) return;
        void (async () => {
          const resp = await this.send<{ ok: boolean; list: WatchlistEntry[] }>({
            type: 'REMOVE_WATCHLIST',
            username: u,
          });
          if (resp?.ok) this.watchlist = resp.list;
          this.render();
        })();
      });
    });

    this.root.querySelectorAll('input[data-setting-check]').forEach((el) => {
      el.addEventListener('change', () => {
        const inputEl = el as HTMLInputElement;
        const key = inputEl.dataset.settingCheck as keyof SentinelSettings;
        void (async () => {
          const resp = await this.send<{ ok: boolean; settings: SentinelSettings }>({
            type: 'UPDATE_SETTINGS',
            patch: { [key]: inputEl.checked } as Partial<SentinelSettings>,
          });
          if (resp?.ok) this.settings = resp.settings;
        })();
      });
    });

    this.root.querySelectorAll('select[data-setting-select]').forEach((el) => {
      el.addEventListener('change', () => {
        const selEl = el as HTMLSelectElement;
        const key = selEl.dataset.settingSelect;
        void (async () => {
          const patch: Partial<SentinelSettings> =
            key === 'language'
              ? { language: selEl.value as Language }
              : { sensitivity: selEl.value as SensitivityPreset };
          const resp = await this.send<{ ok: boolean; settings: SentinelSettings }>({
            type: 'UPDATE_SETTINGS',
            patch,
          });
          if (resp?.ok) this.settings = resp.settings;
          this.render();
        })();
      });
    });
  }
}

const appEl = document.getElementById('app');
if (appEl) {
  const popup = new PopupController(appEl);
  void popup.init();
}
