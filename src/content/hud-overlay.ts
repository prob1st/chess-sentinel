import { LIVE_FORMATS, TIER_THEMES } from '../core/calibration';
import { formatAgeShort, formatFlag, TRANSLATIONS } from '../i18n/translations';
import {
  CheatAnalysisResult,
  Language,
  SentinelSettings,
  TimeClass,
} from '../types';
import { HUD_SHADOW_CSS } from './hud-styles';

function countryToFlagEmoji(code: string | null): string {
  if (!code || code.length !== 2) return '';
  const upper = code.toUpperCase();
  const A = 0x1f1e6;
  const first = upper.charCodeAt(0) - 65;
  const second = upper.charCodeAt(1) - 65;
  if (first < 0 || first > 25 || second < 0 || second > 25) return '';
  return String.fromCodePoint(A + first, A + second);
}

function barColor(score: number): string {
  if (score < 25) return '#10b981';
  if (score < 45) return '#38bdf8';
  if (score < 68) return '#f59e0b';
  if (score < 82) return '#f97316';
  return '#ef4444';
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface HudCallbacks {
  onSwapTarget: () => void;
  onRefresh: () => void;
  onToggleLanguage: (nextLang: Language) => void;
  onToggleWatchlist: (result: CheatAnalysisResult) => void;
  onSavePosition: (pos: { right: number; top: number }) => void;
}

export class SentinelHudOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private cardEl: HTMLElement | null = null;
  private minPillEl: HTMLElement | null = null;

  private settings: SentinelSettings;
  private callbacks: HudCallbacks;
  private currentResult: CheatAnalysisResult | null = null;
  private selectedFormat: TimeClass = 'blitz';
  private isMinimized = false;
  private isHidden = true;
  private detailsExpanded = true;
  private isAbortWindowOpen = false;
  private isWatched = false;
  private loadingUsername: string | null = null;

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private startRight = 20;
  private startTop = 72;

  constructor(settings: SentinelSettings, callbacks: HudCallbacks) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.detailsExpanded = !settings.compactMode;
    if (settings.hudPosition) {
      this.startRight = settings.hudPosition.right;
      this.startTop = settings.hudPosition.top;
    }
  }

  mount(): void {
    if (this.host && document.body.contains(this.host)) return;

    this.host = document.createElement('div');
    this.host.id = 'chess-sentinel-hud-root';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = HUD_SHADOW_CSS;

    this.cardEl = document.createElement('div');
    this.cardEl.className = 'sentinel-card hidden';

    this.minPillEl = document.createElement('div');
    this.minPillEl.className = 'minimized-pill hidden';
    this.minPillEl.addEventListener('click', () => {
      this.isMinimized = false;
      this.syncVisibility();
    });

    this.shadow.append(styleEl, this.cardEl, this.minPillEl);
    document.body.appendChild(this.host);

    this.applyPosition();
    this.setupGlobalDragListeners();
  }

  unmount(): void {
    if (this.host) {
      this.host.remove();
      this.host = null;
      this.shadow = null;
      this.cardEl = null;
      this.minPillEl = null;
    }
  }

  updateSettings(next: SentinelSettings): void {
    const prevLang = this.settings.language;
    this.settings = next;
    if (prevLang !== next.language) {
      this.render();
    }
  }

  setWatchedState(watched: boolean): void {
    this.isWatched = watched;
    this.render();
  }

  setAbortWindow(open: boolean): void {
    if (this.isAbortWindowOpen !== open) {
      this.isAbortWindowOpen = open;
      if (this.currentResult) this.render();
    }
  }

  showLoading(username: string): void {
    this.mount();
    this.loadingUsername = username;
    this.currentResult = null;
    this.isHidden = false;
    this.render();
    this.syncVisibility();
  }

  showResult(result: CheatAnalysisResult, watched: boolean, isAbortWindowOpen: boolean): void {
    this.mount();
    this.loadingUsername = null;
    this.currentResult = result;
    this.selectedFormat = result.primaryFormat;
    this.isWatched = watched;
    this.isAbortWindowOpen = isAbortWindowOpen;
    this.isHidden = false;
    this.render();
    this.syncVisibility();
  }

  showError(username: string, message: string): void {
    this.mount();
    this.loadingUsername = null;
    this.isHidden = false;
    if (!this.cardEl) return;

    const lang = this.settings.language;
    this.cardEl.innerHTML = `
      <div class="tier-accent-line"></div>
      ${this.renderHeaderHtml(lang)}
      <div class="loading-box">
        <div>
          <div class="loading-text">@${escapeHtml(username)}</div>
          <div class="loading-sub">${escapeHtml(message)}</div>
        </div>
      </div>
    `;
    this.bindHeaderEvents();
    this.syncVisibility();
  }

  hide(): void {
    this.isHidden = true;
    this.syncVisibility();
  }

  toggleVisibility(): void {
    this.mount();
    if (this.isHidden) {
      this.isHidden = false;
      this.isMinimized = false;
    } else if (this.isMinimized) {
      this.isMinimized = false;
    } else {
      this.isMinimized = true;
    }
    this.syncVisibility();
  }

  expandFromBadge(): void {
    this.mount();
    this.isHidden = false;
    this.isMinimized = false;
    this.syncVisibility();
  }

  private syncVisibility(): void {
    if (!this.cardEl || !this.minPillEl) return;
    if (this.isHidden) {
      this.cardEl.classList.add('hidden');
      this.minPillEl.classList.add('hidden');
      return;
    }
    if (this.isMinimized) {
      this.cardEl.classList.add('hidden');
      this.minPillEl.classList.remove('hidden');
    } else {
      this.cardEl.classList.remove('hidden');
      this.minPillEl.classList.add('hidden');
    }
  }

  private applyPosition(): void {
    const clampedRight = Math.max(8, Math.min(window.innerWidth - 180, this.startRight));
    const clampedTop = Math.max(8, Math.min(window.innerHeight - 80, this.startTop));
    if (this.cardEl) {
      this.cardEl.style.right = `${clampedRight}px`;
      this.cardEl.style.top = `${clampedTop}px`;
    }
    if (this.minPillEl) {
      this.minPillEl.style.right = `${clampedRight}px`;
      this.minPillEl.style.top = `${clampedTop}px`;
    }
  }

  private setupGlobalDragListeners(): void {
    window.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.startRight = Math.max(8, Math.min(window.innerWidth - 220, this.startRight - dx));
      this.startTop = Math.max(8, Math.min(window.innerHeight - 60, this.startTop + dy));
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.applyPosition();
    });

    window.addEventListener('pointerup', () => {
      if (this.dragging) {
        this.dragging = false;
        this.callbacks.onSavePosition({ right: this.startRight, top: this.startTop });
      }
    });
  }

  private renderHeaderHtml(lang: Language): string {
    const t = TRANSLATIONS[lang];
    const nextLang = lang === 'tr' ? 'EN' : 'TR';
    return `
      <div class="hud-header" data-drag-handle="1">
        <div class="brand">
          <svg class="brand-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 2L4 5.5v6.2c0 5.3 3.4 9.9 8 11.3 4.6-1.4 8-6 8-11.3V5.5L12 2z"/>
            <path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="brand-title">Chess Sentinel</span>
        </div>
        <div class="header-actions">
          <button class="icon-btn lang-btn" data-action="lang" title="Switch Language / Dil Değiştir">${nextLang}</button>
          <button class="icon-btn" data-action="swap" title="${escapeHtml(t.actions.swapTarget)}">⇅</button>
          ${
            this.currentResult
              ? `<button class="icon-btn ${this.isWatched ? 'active' : ''}" data-action="watch" title="${escapeHtml(
                  this.isWatched ? t.actions.watchingSuspect : t.actions.watchSuspect
                )}">👁</button>`
              : ''
          }
          <button class="icon-btn" data-action="refresh" title="${escapeHtml(t.actions.refresh)}">↻</button>
          <button class="icon-btn" data-action="minimize" title="${escapeHtml(t.actions.minimize)}">—</button>
          <button class="icon-btn" data-action="close" title="Close">✕</button>
        </div>
      </div>
    `;
  }

  private bindHeaderEvents(): void {
    if (!this.cardEl) return;
    const header = this.cardEl.querySelector('[data-drag-handle="1"]') as HTMLElement | null;
    if (header) {
      header.addEventListener('pointerdown', (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button')) return;
        this.dragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
      });
    }

    this.cardEl.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = (btn as HTMLElement).dataset.action;
        if (act === 'lang') {
          const next: Language = this.settings.language === 'tr' ? 'en' : 'tr';
          this.settings = { ...this.settings, language: next };
          this.render();
          this.callbacks.onToggleLanguage(next);
        } else if (act === 'swap') {
          this.callbacks.onSwapTarget();
        } else if (act === 'watch' && this.currentResult) {
          this.callbacks.onToggleWatchlist(this.currentResult);
        } else if (act === 'refresh') {
          this.callbacks.onRefresh();
        } else if (act === 'minimize') {
          this.isMinimized = true;
          this.syncVisibility();
        } else if (act === 'close') {
          this.hide();
        }
      });
    });
  }

  private render(): void {
    if (!this.cardEl || !this.minPillEl) return;
    const lang = this.settings.language;
    const t = TRANSLATIONS[lang];

    if (this.loadingUsername && !this.currentResult) {
      this.cardEl.style.setProperty('--tier-color', '#38bdf8');
      this.cardEl.style.setProperty('--tier-border', 'rgba(56, 189, 248, 0.3)');
      this.cardEl.style.setProperty('--tier-glow', 'rgba(56, 189, 248, 0.25)');
      this.cardEl.innerHTML = `
        <div class="tier-accent-line"></div>
        ${this.renderHeaderHtml(lang)}
        <div class="loading-box">
          <div class="spinner"></div>
          <div>
            <div class="loading-text">@${escapeHtml(this.loadingUsername)}</div>
            <div class="loading-sub">${escapeHtml(t.scanningOpponent)}</div>
          </div>
        </div>
      `;
      this.minPillEl.innerHTML = `<span class="min-pct">…</span><span class="min-user">@${escapeHtml(
        this.loadingUsername
      )}</span>`;
      this.bindHeaderEvents();
      return;
    }

    const res = this.currentResult;
    if (!res) return;

    const theme = TIER_THEMES[res.tier];
    this.cardEl.style.setProperty('--tier-color', theme.color);
    this.cardEl.style.setProperty('--tier-bg', theme.accentBg);
    this.cardEl.style.setProperty('--tier-border', theme.border);
    this.cardEl.style.setProperty('--tier-glow', theme.glow);

    this.minPillEl.style.setProperty('--tier-color', theme.color);
    this.minPillEl.style.setProperty('--tier-border', theme.border);
    this.minPillEl.style.setProperty('--tier-glow', theme.glow);

    const fmtData = res.formats[this.selectedFormat] || res.formats[res.primaryFormat];
    const displayProb =
      res.isBannedFairPlay
        ? 100
        : this.selectedFormat === res.primaryFormat
          ? res.probability
          : fmtData.formatProbability;

    // SVG gauge geometry (r = 35 => circumference = 219.91)
    const radius = 35;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (Math.min(100, Math.max(0, displayProb)) / 100) * circ;

    // Alert banner logic
    let alertHtml = '';
    if (res.isBannedFairPlay) {
      alertHtml = `<div class="alert-banner banned">🚨 ${escapeHtml(t.bannedFairPlayBanner)}</div>`;
    } else if (this.isAbortWindowOpen && displayProb >= 55) {
      alertHtml = `<div class="alert-banner abort-warn">⚠️ ${escapeHtml(t.abortWindowActive)} — ${escapeHtml(
        t.considerAborting
      )}</div>`;
    } else if (this.isAbortWindowOpen && displayProb < 30) {
      alertHtml = `<div class="alert-banner abort-safe">🛡️ ${escapeHtml(t.safeToPlay)}</div>`;
    }

    const flagEmoji = countryToFlagEmoji(res.countryCode);
    const avatarHtml = res.avatarUrl
      ? `<img class="avatar" src="${escapeHtml(res.avatarUrl)}" alt="" />`
      : `<div class="avatar">${escapeHtml(res.displayName.slice(0, 1).toUpperCase())}</div>`;

    const titleBadgeHtml = res.title
      ? `<span class="title-pill">${escapeHtml(res.title.toUpperCase())}</span>`
      : '';

    const verdictText =
      res.isBannedFairPlay
        ? t.tiers.banned.summary
        : displayProb >= 60
          ? t.considerAborting
          : displayProb >= 35
            ? t.cautionAdvised
            : t.safeToPlay;

    // Quick Stat Tiles
    const ageStr = formatAgeShort(res.accountAgeDays, lang);
    const accStr = fmtData.avgAccuracy !== null ? `${fmtData.avgAccuracy}%` : '—';
    const accClass =
      fmtData.avgAccuracy !== null && fmtData.avgAccuracy - fmtData.expectedAccuracy >= 4
        ? 'neg'
        : fmtData.avgAccuracy !== null
          ? 'pos'
          : '';

    const cvVal = res.pacing.medianCV;
    const cvStr = cvVal !== null ? String(cvVal) : '—';
    const cvClass =
      cvVal !== null && cvVal < 0.48 ? 'neg' : cvVal !== null && cvVal < 0.62 ? 'warn' : 'pos';

    const d7 = fmtData.eloDelta7d;
    const d7Str = d7 === null ? '0' : d7 > 0 ? `+${d7}` : `${d7}`;
    const d7Class = d7 !== null && d7 >= 90 ? 'warn' : d7 !== null && d7 > 0 ? 'pos' : '';

    const formDotsHtml = res.recentForm
      .map((r) => {
        const lbl =
          lang === 'tr' ? (r === 'W' ? 'G' : r === 'L' ? 'M' : 'B') : r;
        return `<span class="form-dot ${r}">${lbl}</span>`;
      })
      .join('');

    const wldLabel =
      fmtData.recentTotal > 0
        ? lang === 'tr'
          ? `Son: ${fmtData.recentWins}G ${fmtData.recentLosses}M ${fmtData.recentDraws}B (%${fmtData.recentWinPct})`
          : `Recent: ${fmtData.recentWins}W ${fmtData.recentLosses}L ${fmtData.recentDraws}D (${fmtData.recentWinPct}%)`
        : lang === 'tr'
          ? `Genel: %${fmtData.overallWinPct} (${fmtData.overallTotal})`
          : `All: ${fmtData.overallWinPct}% (${fmtData.overallTotal})`;

    const flagsHtml = res.flags
      .map(
        (f) => `
        <div class="flag-chip ${f.severity}">
          <span>${f.icon}</span>
          <span>${escapeHtml(formatFlag(lang, f.id, f.params))}</span>
        </div>
      `
      )
      .join('');

    const signalRows: Array<{ label: string; score: number }> = [
      { label: t.signals.recentWinrate, score: res.signals.recentWinrate },
      { label: t.signals.overallWinrate, score: res.signals.overallWinrate },
      { label: t.signals.accuracyAnomaly, score: res.signals.accuracyAnomaly },
      { label: t.signals.movePacing, score: res.signals.movePacing },
      { label: t.signals.eloVelocity, score: res.signals.eloVelocity },
      { label: t.signals.accountTrust, score: res.signals.accountTrust },
    ];

    const signalsHtml = signalRows
      .map(
        (s) => `
        <div class="sig-row">
          <div class="sig-head">
            <span>${escapeHtml(s.label)}</span>
            <span class="sig-score">${s.score}/100</span>
          </div>
          <div class="sig-bar-bg">
            <div class="sig-bar-fill" style="width:${s.score}%;background:${barColor(s.score)}"></div>
          </div>
        </div>
      `
      )
      .join('');

    const formatTabsHtml = LIVE_FORMATS.map((fmt) => {
      const f = res.formats[fmt];
      const active = fmt === this.selectedFormat ? 'active' : '';
      const elo = f.currentRating ? String(f.currentRating) : '—';
      return `
        <button class="fmt-tab ${active}" data-fmt="${fmt}">
          <span>${fmt}</span>
          <span class="fmt-elo">${elo}</span>
        </button>
      `;
    }).join('');

    const pctDisplay =
      lang === 'tr'
        ? `<span>%</span>${displayProb}`
        : `${displayProb}<span>%</span>`;

    this.cardEl.innerHTML = `
      <div class="tier-accent-line"></div>
      ${this.renderHeaderHtml(lang)}
      ${alertHtml}
      <div class="hero">
        <div class="gauge-wrap">
          <svg class="gauge-svg" viewBox="0 0 86 86">
            <circle class="gauge-track" cx="43" cy="43" r="${radius}"></circle>
            <circle
              class="gauge-progress"
              cx="43"
              cy="43"
              r="${radius}"
              stroke-dasharray="${circ.toFixed(2)}"
              stroke-dashoffset="${offset.toFixed(2)}"
            ></circle>
          </svg>
          <div class="gauge-center">
            <div class="gauge-pct">${pctDisplay}</div>
            <div class="gauge-caption">${escapeHtml(t.cheatProbability)}</div>
          </div>
        </div>
        <div class="identity">
          <div class="player-row">
            ${avatarHtml}
            ${titleBadgeHtml}
            <a class="username-link" href="https://www.chess.com/member/${encodeURIComponent(
              res.displayName
            )}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(res.displayName)}
            </a>
            ${flagEmoji ? `<span>${flagEmoji}</span>` : ''}
          </div>
          <div class="tier-badge-row">
            <span class="tier-pill">${escapeHtml(t.tiers[res.tier].label)}</span>
            <span class="conf-tag">• ${escapeHtml(t.confidenceLabel[res.confidence])}</span>
          </div>
          <div class="verdict-sub">${escapeHtml(verdictText)}</div>
        </div>
      </div>

      <div class="format-tabs">${formatTabsHtml}</div>

      <div class="stat-grid">
        <div class="stat-tile">
          <div class="stat-val">${escapeHtml(ageStr)}</div>
          <div class="stat-lbl">${escapeHtml(t.stats.accountAge)}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-val ${accClass}">${escapeHtml(accStr)}</div>
          <div class="stat-lbl">${escapeHtml(t.stats.avgAccuracy)}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-val ${cvClass}">${escapeHtml(cvStr)}</div>
          <div class="stat-lbl">${escapeHtml(t.stats.moveCV)}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-val ${d7Class}">${escapeHtml(d7Str)}</div>
          <div class="stat-lbl">${escapeHtml(t.stats.elo7d)}</div>
        </div>
      </div>

      ${
        res.recentForm.length > 0
          ? `<div class="form-strip">
              <div class="form-dots">${formDotsHtml}</div>
              <div class="wld-summary">${escapeHtml(wldLabel)}</div>
            </div>`
          : ''
      }

      ${flagsHtml ? `<div class="flags-list">${flagsHtml}</div>` : ''}

      <button class="details-toggle" data-toggle-details="1">
        <span>${escapeHtml(this.detailsExpanded ? t.actions.hideDetails : t.actions.toggleDetails)}</span>
        <span>${this.detailsExpanded ? '▴' : '▾'}</span>
      </button>

      <div class="signals-panel ${this.detailsExpanded ? '' : 'collapsed'}">
        ${signalsHtml}
      </div>
    `;

    const minPctText = lang === 'tr' ? `%${displayProb}` : `${displayProb}%`;
    this.minPillEl.innerHTML = `
      <span>🛡️</span>
      <span class="min-pct">${minPctText}</span>
      <span class="min-user">@${escapeHtml(res.displayName)}</span>
    `;

    this.bindHeaderEvents();

    // Format tabs listener
    this.cardEl.querySelectorAll('button[data-fmt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fmt = (btn as HTMLElement).dataset.fmt as TimeClass;
        if (fmt) {
          this.selectedFormat = fmt;
          this.render();
        }
      });
    });

    // Details expand/collapse listener
    const toggleBtn = this.cardEl.querySelector('[data-toggle-details="1"]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.detailsExpanded = !this.detailsExpanded;
        this.render();
      });
    }
  }
}
