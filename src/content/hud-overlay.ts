import { LIVE_FORMATS, TIER_THEMES } from '../core/calibration';
import { buildFairPlayEvidenceReport, computeEffectiveLiveRisk } from '../core/engine';
import { formatAgeShort, formatFlag, TRANSLATIONS } from '../i18n/translations';
import {
  CheatAnalysisResult,
  Language,
  LiveMatchClockTelemetry,
  PageSurfaceKind,
  SentinelSettings,
  TimeClass,
} from '../types';
import { ICONS } from '../utils/icons';
import { escapeHtml, setSafeHtml } from '../utils/safe-dom';
import { HUD_SHADOW_CSS } from './hud-styles';

const HIST_LABELS = ['<0.9s', '1.8s', '3.2s', '5.5s', '9.5s', '18s', '18s+'];

type HudViewTab = 'overview' | 'clock' | 'games';

function barColor(score: number): string {
  if (score < 25) return '#81b64c';
  if (score < 45) return '#6ba4d9';
  if (score < 68) return '#e59934';
  if (score < 82) return '#e06c35';
  return '#e04644';
}

export interface HudCallbacks {
  onSwapTarget: () => void;
  onRefresh: () => void;
  onToggleLanguage: (nextLang: Language) => void;
  onToggleSound: (enabled: boolean) => void;
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
  private liveClock: LiveMatchClockTelemetry | null = null;
  private surface: PageSurfaceKind = 'live';
  private selectedFormat: TimeClass = 'blitz';
  private activeTab: HudViewTab = 'overview';
  private expandedMatchIdx: number | null = null;
  private isMinimized = false;
  private isHidden = true;
  private detailsExpanded = false;
  private isAbortWindowOpen = false;
  private isWatched = false;
  private copiedFeedback = false;
  private loadingUsername: string | null = null;

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private startRight = 16;
  private startTop = 64;

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
    const prevSound = this.settings.soundAlerts;
    this.settings = next;
    if (prevLang !== next.language || prevSound !== next.soundAlerts) {
      this.render();
    }
  }

  updateLiveClock(telemetry: LiveMatchClockTelemetry | null): void {
    const wasSuspect = Boolean(this.liveClock?.isLiveSuspectPacing);
    this.liveClock = telemetry;
    if (telemetry?.isLiveSuspectPacing && !wasSuspect) {
      this.activeTab = 'clock';
    }
    if (this.currentResult && !this.isHidden) {
      this.render();
    }
  }

  setSurface(surface: PageSurfaceKind): void {
    if (this.surface !== surface) {
      this.surface = surface;
      if (this.currentResult && !this.isHidden) this.render();
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
    this.liveClock = null;
    this.expandedMatchIdx = null;
    this.isHidden = false;
    this.render();
    this.syncVisibility();
  }

  showResult(
    result: CheatAnalysisResult,
    watched: boolean,
    isAbortWindowOpen: boolean,
    surface: PageSurfaceKind = 'live'
  ): void {
    this.mount();
    const isNewUser = this.currentResult?.username !== result.username;
    this.loadingUsername = null;
    this.currentResult = result;
    this.selectedFormat = result.primaryFormat;
    this.isWatched = watched;
    this.isAbortWindowOpen = isAbortWindowOpen;
    this.surface = surface;
    this.copiedFeedback = false;
    if (isNewUser) {
      this.activeTab = 'overview';
      this.expandedMatchIdx = null;
    }
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
    setSafeHtml(
      this.cardEl,
      `
      ${this.renderHeaderHtml(lang)}
      <div class="loading-box">
        <div>
          <div class="loading-text">@${escapeHtml(username)}</div>
          <div class="loading-sub">${escapeHtml(message)}</div>
        </div>
      </div>
    `
    );
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

  private getTargetLiveClock(res: CheatAnalysisResult): LiveMatchClockTelemetry | null {
    if (!this.liveClock) return null;
    const lcUser = this.liveClock.opponent.toLowerCase();
    if (
      lcUser === res.username.toLowerCase() ||
      lcUser === res.displayName.toLowerCase()
    ) {
      return this.liveClock;
    }
    return null;
  }

  private renderHeaderHtml(lang: Language): string {
    const t = TRANSLATIONS[lang];
    const nextLang = lang === 'tr' ? 'EN' : 'TR';
    const surfLabel = t.surfaceBadge[this.surface];
    const surfCls = this.surface === 'live' ? 'live' : '';

    return `
      <div class="hud-header" data-drag-handle="1">
        <div class="brand">
          <span class="brand-dot"></span>
          <span class="brand-title">Chess Sentinel</span>
          <span class="surface-tag ${surfCls}">${escapeHtml(surfLabel)}</span>
        </div>
        <div class="header-actions">
          <button class="icon-btn lang-btn" data-action="lang" title="TR / EN">${nextLang}</button>
          ${
            this.surface !== 'profile'
              ? `<button class="icon-btn" data-action="swap" title="${escapeHtml(t.actions.swapTarget)}">${ICONS.swap}</button>`
              : ''
          }
          ${
            this.currentResult
              ? `<button class="icon-btn ${this.isWatched ? 'active' : ''}" data-action="watch" title="${escapeHtml(
                  this.isWatched ? t.actions.watchingSuspect : t.actions.watchSuspect
                )}">${this.isWatched ? ICONS.bookmarkFilled : ICONS.bookmark}</button>`
              : ''
          }
          <button class="icon-btn" data-action="refresh" title="${escapeHtml(t.actions.refresh)}">${ICONS.refresh}</button>
          <button class="icon-btn" data-action="minimize" title="${escapeHtml(t.actions.minimize)}">${ICONS.minimize}</button>
          <button class="icon-btn" data-action="close" title="Close">${ICONS.close}</button>
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
        } else if (act === 'sound') {
          const nextSound = !this.settings.soundAlerts;
          this.settings = { ...this.settings, soundAlerts: nextSound };
          this.render();
          this.callbacks.onToggleSound(nextSound);
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

  private resolveStatusLine(
    res: CheatAnalysisResult,
    displayProb: number,
    lang: Language
  ): { cls: string; message: string } {
    const t = TRANSLATIONS[lang].v3;
    const lc = this.getTargetLiveClock(res);

    if (res.isBannedFairPlay) {
      return { cls: 'danger', message: t.verdictBanned };
    }
    if (lc && lc.isLiveSuspectPacing && lc.roboticStartMove !== null && lc.roboticEndMove !== null) {
      if (lc.pauseMoveNumber !== null && lc.detectedPauseSec !== null) {
        return {
          cls: 'danger',
          message: t.verdictLiveToggle
            .replace('{pauseMove}', String(lc.pauseMoveNumber))
            .replace('{pauseSec}', String(lc.detectedPauseSec))
            .replace('{start}', String(lc.roboticStartMove))
            .replace('{end}', String(lc.roboticEndMove))
            .replace('{min}', String(lc.roboticMinSec ?? '-'))
            .replace('{max}', String(lc.roboticMaxSec ?? '-')),
        };
      }
      return {
        cls: 'danger',
        message: t.verdictLiveFlatline
          .replace('{start}', String(lc.roboticStartMove))
          .replace('{end}', String(lc.roboticEndMove))
          .replace('{count}', String(lc.consecutiveRoboticMoves))
          .replace('{min}', String(lc.roboticMinSec ?? '-'))
          .replace('{max}', String(lc.roboticMaxSec ?? '-')),
      };
    }
    if (displayProb >= 75) {
      return {
        cls: 'danger',
        message: this.isAbortWindowOpen
          ? t.verdictAbortNow.replace('{pins}', String(Math.max(1, res.suspectPinpoints.length)))
          : t.verdictHighWatch,
      };
    }
    if (displayProb >= 55) {
      return { cls: 'warn', message: t.verdictElevatedWatch };
    }
    if (res.flags.some((f) => f.id === 'smurf_human_pacing')) {
      return { cls: '', message: t.verdictSmurfHuman };
    }
    return { cls: '', message: t.verdictCleanSafe };
  }

  private renderSuspectPinpointsHtml(res: CheatAnalysisResult, lang: Language): string {
    if (!res.suspectPinpoints || res.suspectPinpoints.length === 0) return '';
    const t = TRANSLATIONS[lang].v3;

    const itemsHtml = res.suspectPinpoints
      .map((p) => {
        const href =
          p.gameUrl || `https://www.chess.com/member/${encodeURIComponent(res.displayName)}`;
        let desc = '';
        if (p.kind === 'midgame_toggle') {
          desc = t.pinpointToggleRow
            .replace('{pauseMove}', String(p.pauseMoveNumber ?? '?'))
            .replace('{pauseSec}', String(p.pauseSec ?? '?'))
            .replace('{start}', String(p.suspectStartMove))
            .replace('{end}', String(p.suspectEndMove))
            .replace('{min}', String(p.minBandSec ?? '-'))
            .replace('{max}', String(p.maxBandSec ?? '-'));
        } else if (p.kind === 'robotic_flatline') {
          desc = t.pinpointFlatlineRow
            .replace('{start}', String(p.suspectStartMove))
            .replace('{end}', String(p.suspectEndMove))
            .replace('{count}', String(p.roboticMoveCount))
            .replace('{min}', String(p.minBandSec ?? '-'))
            .replace('{max}', String(p.maxBandSec ?? '-'));
        } else {
          desc = t.pinpointCapsRow
            .replace('{end}', String(p.suspectEndMove))
            .replace('{acc}', String(p.accuracy ?? '-'));
        }

        const sanHtml =
          p.sampleMoves && p.sampleMoves.length > 0
            ? `<div class="pinpoint-san">${escapeHtml(p.sampleMoves.join('  '))}${
                p.accuracy !== null ? ` · %${p.accuracy}` : ''
              }</div>`
            : p.accuracy !== null && p.kind !== 'caps2_spike'
              ? `<div class="pinpoint-san">CAPS2 %${p.accuracy}</div>`
              : '';

        return `
          <div class="pinpoint-item">
            <div class="pinpoint-head">
              <span>vs @${escapeHtml(p.opponentUsername)} (${p.opponentRating})</span>
              <a class="pinpoint-open" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
                <span>${escapeHtml(t.pinpointOpenGame)}</span>
                ${ICONS.external}
              </a>
            </div>
            <div class="pinpoint-body">${escapeHtml(desc)}</div>
            ${sanHtml}
          </div>
        `;
      })
      .join('');

    return `
      <div class="pinpoint-panel">
        <div class="sec-head">
          <span>${escapeHtml(t.pinpointSectionTitle)}</span>
          <span>${res.suspectPinpoints.length}</span>
        </div>
        ${itemsHtml}
      </div>
    `;
  }

  private renderOverviewTabHtml(res: CheatAnalysisResult, lang: Language): string {
    const t = TRANSLATIONS[lang];
    const fmtData = res.formats[this.selectedFormat] || res.formats[res.primaryFormat];

    const formatTabsHtml = LIVE_FORMATS.map((fmt) => {
      const f = res.formats[fmt];
      const active = fmt === this.selectedFormat ? 'active' : '';
      const elo = f.currentRating ? String(f.currentRating) : '-';
      return `
        <button class="fmt-tab ${active}" data-fmt="${fmt}">
          <span>${fmt}</span>
          <span class="fmt-elo">${elo}</span>
        </button>
      `;
    }).join('');

    const formDotsHtml = res.recentForm
      .slice(0, 6)
      .map((r) => `<span class="form-dot ${r}"></span>`)
      .join('');

    const wldVal =
      fmtData.recentTotal > 0
        ? lang === 'tr'
          ? `${fmtData.recentWins}G ${fmtData.recentLosses}M ${fmtData.recentDraws}B`
          : `${fmtData.recentWins}W ${fmtData.recentLosses}L ${fmtData.recentDraws}D`
        : lang === 'tr'
          ? `%${fmtData.overallWinPct}`
          : `${fmtData.overallWinPct}%`;
    const wldSub =
      fmtData.recentTotal > 0
        ? `%${fmtData.recentWinPct}`
        : `${fmtData.overallTotal}`;

    const perfStr = fmtData.performanceRating ? String(fmtData.performanceRating) : '-';
    const zSign = fmtData.eloZScore >= 0 ? '+' : '';
    const zClass = fmtData.eloZScore >= 2.8 ? 'warn' : '';

    const accStr = fmtData.avgAccuracy !== null ? `${fmtData.avgAccuracy}%` : '-';
    const accClass =
      fmtData.avgAccuracy !== null && fmtData.avgAccuracy - fmtData.expectedAccuracy >= 4
        ? 'neg'
        : fmtData.avgAccuracy !== null
          ? 'pos'
          : '';

    const cvVal = res.pacing.medianCV;
    const qcdVal = res.pacing.medianQCD;
    const paceStr = cvVal !== null ? `CV ${cvVal}` : '-';
    const paceSub = qcdVal !== null ? `QCD ${qcdVal}` : '';
    const cvClass =
      cvVal !== null && cvVal < 0.45 ? 'neg' : cvVal !== null && cvVal < 0.60 ? 'warn' : 'pos';

    const d7 = fmtData.eloDelta7d;
    const d7Str = d7 === null ? '0' : d7 > 0 ? `+${d7}` : `${d7}`;
    const d7Class = d7 !== null && d7 >= 100 ? 'warn' : d7 !== null && d7 > 0 ? 'pos' : '';
    const streakSub =
      res.winStreak >= 2
        ? lang === 'tr'
          ? `${res.winStreak}G seri`
          : `${res.winStreak}W streak`
        : '';

    const ageStr = formatAgeShort(res.accountAgeDays, lang);
    const totalGames =
      res.formats.rapid.overallTotal +
      res.formats.blitz.overallTotal +
      res.formats.bullet.overallTotal +
      res.formats.daily.overallTotal;
    const gamesSub = t.stats.lifetimeGames.replace('{count}', String(totalGames));

    const flagsHtml = res.flags
      .map(
        (f) => `
        <div class="flag-line">
          <span class="flag-dot ${f.severity}"></span>
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
            <span class="sig-score">${s.score}</span>
          </div>
          <div class="sig-bar-bg">
            <div class="sig-bar-fill" style="width:${s.score}%;background:${barColor(s.score)}"></div>
          </div>
        </div>
      `
      )
      .join('');

    return `
      <div class="tab-pane">
        <div class="format-tabs">${formatTabsHtml}</div>

        <div class="metric-table">
          <div class="metric-cell">
            <div class="metric-lbl">
              <span>${escapeHtml(t.stats.recentRecord)}</span>
              <span class="form-dots">${formDotsHtml}</span>
            </div>
            <div class="metric-val">${escapeHtml(wldVal)} <span class="metric-sub">${escapeHtml(wldSub)}</span></div>
          </div>

          <div class="metric-cell">
            <div class="metric-lbl"><span>${escapeHtml(t.stats.performance)}</span></div>
            <div class="metric-val ${zClass}">${escapeHtml(perfStr)} <span class="metric-sub">${zSign}${fmtData.eloZScore}σ</span></div>
          </div>

          <div class="metric-cell">
            <div class="metric-lbl"><span>${escapeHtml(t.stats.avgAccuracy)}</span></div>
            <div class="metric-val ${accClass}">${escapeHtml(accStr)} <span class="metric-sub">${escapeHtml(t.stats.expectedShort)} ${fmtData.expectedAccuracy}%</span></div>
          </div>

          <div class="metric-cell">
            <div class="metric-lbl"><span>${escapeHtml(t.stats.moveCV)}</span></div>
            <div class="metric-val ${cvClass}">${escapeHtml(paceStr)} <span class="metric-sub">${escapeHtml(paceSub)}</span></div>
          </div>

          <div class="metric-cell">
            <div class="metric-lbl"><span>${escapeHtml(t.stats.elo7d)}</span></div>
            <div class="metric-val ${d7Class}">${escapeHtml(d7Str)} <span class="metric-sub">${escapeHtml(streakSub)}</span></div>
          </div>

          <div class="metric-cell">
            <div class="metric-lbl"><span>${escapeHtml(t.stats.accountAge)}</span></div>
            <div class="metric-val">${escapeHtml(ageStr)} <span class="metric-sub">${escapeHtml(gamesSub)}</span></div>
          </div>
        </div>

        ${this.renderSuspectPinpointsHtml(res, lang)}
        ${flagsHtml ? `<div class="flags-list">${flagsHtml}</div>` : ''}

        <button class="details-toggle" data-toggle-details="1">
          <span>${escapeHtml(this.detailsExpanded ? t.actions.hideDetails : t.actions.toggleDetails)}</span>
          ${this.detailsExpanded ? ICONS.chevronUp : ICONS.chevronDown}
        </button>

        <div class="signals-panel ${this.detailsExpanded ? '' : 'collapsed'}">
          ${signalsHtml}
        </div>
      </div>
    `;
  }

  private renderClockTabHtml(res: CheatAnalysisResult, lang: Language): string {
    const t = TRANSLATIONS[lang];
    const lc = this.getTargetLiveClock(res);

    let liveBoxHtml = '';
    if (!lc || lc.movesObserved < 2) {
      liveBoxHtml = `
        <div class="chart-box">
          <div class="sec-head"><span>${escapeHtml(t.v3.liveClockTitle)}</span></div>
          <div class="empty-note">${escapeHtml(t.v3.emptyLiveClock)}</div>
        </div>
      `;
    } else {
      const maxSec = Math.max(12, ...lc.moveTimesSec);
      const barsHtml = lc.moveTimesSec
        .map((sec, idx) => {
          const moveNo = lc.moveNumbers?.[idx] ?? idx + 2;
          const san = lc.moveSanLabels?.[idx] || '';
          const isPauseMove = lc.pauseMoveNumber !== null && moveNo === lc.pauseMoveNumber;
          const isInRoboticRange =
            lc.isLiveSuspectPacing &&
            lc.roboticStartMove !== null &&
            lc.roboticEndMove !== null &&
            moveNo >= lc.roboticStartMove &&
            moveNo <= lc.roboticEndMove;

          const hPx = Math.max(3, Math.min(32, Math.round((sec / maxSec) * 32)));
          const color = isPauseMove
            ? '#e59934'
            : isInRoboticRange
              ? '#e04644'
              : sec <= 1.8
                ? '#81b64c'
                : sec >= 18
                  ? '#d9922b'
                  : '#6ba4d9';
          const numCls = isPauseMove ? 'pause' : isInRoboticRange ? 'suspect' : '';
          const tip = `#${moveNo}${san ? ` (${san})` : ''}: ${sec}s`;

          return `
            <div class="live-spark-item" title="${escapeHtml(tip)}">
              <div class="live-spark-col" style="height:${hPx}px;background:${color}"></div>
              <span class="live-spark-num ${numCls}">${moveNo}</span>
            </div>
          `;
        })
        .join('');

      const recentChipsHtml = lc.moveTimesSec
        .slice(-8)
        .map((sec, idx, arr) => {
          const globalIdx = lc.moveTimesSec.length - arr.length + idx;
          const moveNo = lc.moveNumbers?.[globalIdx] ?? globalIdx + 2;
          const san = lc.moveSanLabels?.[globalIdx] || '';
          const isSus =
            lc.isLiveSuspectPacing &&
            lc.roboticStartMove !== null &&
            lc.roboticEndMove !== null &&
            moveNo >= lc.roboticStartMove &&
            moveNo <= lc.roboticEndMove;
          return `<span class="move-chip ${isSus ? 'suspect' : ''}">#${moveNo}${san ? ` ${escapeHtml(san)}` : ''} ${sec}s</span>`;
        })
        .join('');

      const statsText = t.v3.liveClockMoves
        .replace('{count}', String(lc.movesObserved))
        .replace('{mean}', String(lc.liveMeanSec ?? '-'))
        .replace('{qcd}', String(lc.liveQCD ?? '-'));

      let pinpointMsg = '';
      if (lc.isLiveSuspectPacing && lc.roboticStartMove !== null && lc.roboticEndMove !== null) {
        if (lc.pauseMoveNumber !== null && lc.detectedPauseSec !== null) {
          pinpointMsg = t.v3.livePinpointToggle
            .replace('{pauseMove}', String(lc.pauseMoveNumber))
            .replace('{pauseSec}', String(lc.detectedPauseSec))
            .replace('{start}', String(lc.roboticStartMove))
            .replace('{end}', String(lc.roboticEndMove))
            .replace('{min}', String(lc.roboticMinSec ?? '-'))
            .replace('{max}', String(lc.roboticMaxSec ?? '-'));
        } else {
          pinpointMsg = t.v3.livePinpointFlatline
            .replace('{start}', String(lc.roboticStartMove))
            .replace('{end}', String(lc.roboticEndMove))
            .replace('{count}', String(lc.consecutiveRoboticMoves))
            .replace('{min}', String(lc.roboticMinSec ?? '-'))
            .replace('{max}', String(lc.roboticMaxSec ?? '-'));
        }
      } else if (lc.isLiveSuspectPacing) {
        pinpointMsg = t.v3.liveClockSuspect;
      }

      const headTitle = lc.isFinishedGame ? t.v3.finishedClockTitle : t.v3.liveClockTitle;

      liveBoxHtml = `
        <div class="chart-box ${lc.isLiveSuspectPacing ? 'suspect' : ''}">
          <div class="sec-head">
            <span>${escapeHtml(headTitle)}</span>
            <span>${escapeHtml(statsText)}</span>
          </div>
          <div class="live-spark-bars">${barsHtml}</div>
          <div class="move-chips">${recentChipsHtml}</div>
          ${pinpointMsg ? `<div class="live-suspect-msg">${escapeHtml(pinpointMsg)}</div>` : ''}
        </div>
      `;
    }

    let histHtml = '';
    if (res.pacing.gamesAnalyzed >= 4 && res.pacing.bucketDistribution.length >= 7) {
      const dist = res.pacing.bucketDistribution;
      const maxRatio = Math.max(0.25, ...dist);
      const colsHtml = dist
        .map((ratio, idx) => {
          const hPx = Math.max(2, Math.round((ratio / maxRatio) * 32));
          const isRoboticZone = (idx === 3 || idx === 4) && res.signals.movePacing >= 55;
          const color = isRoboticZone
            ? '#e04644'
            : idx <= 1
              ? '#81b64c'
              : '#6ba4d9';
          const pct = Math.round(ratio * 100);
          return `
            <div class="hist-col-wrap" title="${HIST_LABELS[idx]}: ${pct}%">
              <div class="hist-bar" style="height:${hPx}px;background:${color}"></div>
              <span class="hist-lbl">${HIST_LABELS[idx]}</span>
            </div>
          `;
        })
        .join('');

      const entTag = t.v3.pacingEntropyTag
        .replace('{ent}', String(res.pacing.meanEntropyBits ?? '-'))
        .replace('{qcd}', String(res.pacing.medianQCD ?? '-'));

      histHtml = `
        <div class="chart-box">
          <div class="sec-head">
            <span>${escapeHtml(t.v3.pacingHistTitle)}</span>
            <span>${escapeHtml(entTag)}</span>
          </div>
          <div class="hist-grid">${colsHtml}</div>
        </div>
      `;
    }

    return `<div class="tab-pane">${liveBoxHtml}${histHtml}</div>`;
  }

  private renderGamesTabHtml(res: CheatAnalysisResult, lang: Language): string {
    const t = TRANSLATIONS[lang];
    if (!res.recentMatches || res.recentMatches.length === 0) {
      return `<div class="tab-pane"><div class="empty-note">${escapeHtml(t.stats.noReviewedGames)}</div></div>`;
    }

    const bandCeiling = res.formats[res.primaryFormat]?.highAccCeiling ?? 92;

    const rowsHtml = res.recentMatches
      .slice(0, 8)
      .map((m, idx) => {
        const resLbl =
          lang === 'tr' ? (m.result === 'W' ? 'G' : m.result === 'L' ? 'M' : 'B') : m.result;
        const movesCount = Math.max(1, Math.round(m.plies / 2));
        const accHtml =
          m.accuracy !== null
            ? `<span class="match-acc ${m.accuracy >= bandCeiling ? 'high' : ''}">${m.accuracy}%</span>`
            : '';
        const pinHtml = m.pinpointMoveRange
          ? `<span class="match-pin-tag">${escapeHtml(m.pinpointMoveRange)}</span>`
          : '';
        const href =
          m.url || `https://www.chess.com/member/${encodeURIComponent(res.displayName)}`;

        const hasSpark = Array.isArray(m.moveTimesSec) && m.moveTimesSec.length >= 4;
        const isExpanded = this.expandedMatchIdx === idx && hasSpark;

        let drawerHtml = '';
        if (isExpanded && m.moveTimesSec) {
          const maxD = Math.max(10, ...m.moveTimesSec);
          const bars = m.moveTimesSec
            .map((sec, sIdx) => {
              const h = Math.max(2, Math.min(26, Math.round((sec / maxD) * 26)));
              const col =
                m.pinpointKind && sec >= 2.6 && sec <= 8.5
                  ? '#e04644'
                  : sec <= 1.8
                    ? '#81b64c'
                    : '#6ba4d9';
              return `<div class="drawer-bar" style="height:${h}px;background:${col}" title="#${sIdx + 2}: ${sec}s"></div>`;
            })
            .join('');
          drawerHtml = `
            <div class="match-drawer">
              <div class="drawer-bars">${bars}</div>
            </div>
          `;
        }

        return `
          <div class="match-block">
            <div class="match-row">
              <div class="match-left">
                <span class="match-res ${m.result}">${resLbl}</span>
                <span class="match-opp">@${escapeHtml(m.opponentUsername)}</span>
                <span class="match-opp-elo">(${m.opponentRating})</span>
              </div>
              <div class="match-right">
                ${pinHtml}
                ${accHtml}
                <span>${movesCount}m</span>
                ${
                  hasSpark
                    ? `<button class="mini-link-btn ${isExpanded ? 'active' : ''}" data-expand-match="${idx}" title="${escapeHtml(t.v3.inspectMoves)}">${ICONS.clock}</button>`
                    : ''
                }
                <a class="mini-link-btn" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(t.v3.pinpointOpenGame)}">${ICONS.external}</a>
              </div>
            </div>
            ${drawerHtml}
          </div>
        `;
      })
      .join('');

    return `
      <div class="tab-pane">
        <div class="sec-head">
          <span>${escapeHtml(t.v3.recentMatchesTitle)}</span>
          <span>${escapeHtml(t.stats.gamesAnalyzed.replace('{count}', String(res.analyzedGamesCount)))}</span>
        </div>
        <div class="matches-list">${rowsHtml}</div>
      </div>
    `;
  }

  private render(): void {
    if (!this.cardEl || !this.minPillEl) return;
    const lang = this.settings.language;
    const t = TRANSLATIONS[lang];

    if (this.loadingUsername && !this.currentResult) {
      this.cardEl.style.setProperty('--tier-color', '#81b64c');
      setSafeHtml(
        this.cardEl,
        `
        ${this.renderHeaderHtml(lang)}
        <div class="loading-box">
          <div class="spinner"></div>
          <div>
            <div class="loading-text">@${escapeHtml(this.loadingUsername)}</div>
            <div class="loading-sub">${escapeHtml(t.scanningOpponent)}</div>
          </div>
        </div>
      `
      );
      setSafeHtml(
        this.minPillEl,
        `<span class="min-dot"></span><span class="min-pct">...</span><span class="min-user">@${escapeHtml(this.loadingUsername)}</span>`
      );
      this.bindHeaderEvents();
      return;
    }

    const res = this.currentResult;
    if (!res) return;

    const lc = this.getTargetLiveClock(res);
    const eff = computeEffectiveLiveRisk(res, lc, this.selectedFormat);
    const theme = TIER_THEMES[eff.tier];

    this.cardEl.style.setProperty('--tier-color', theme.color);
    this.minPillEl.style.setProperty('--tier-color', theme.color);

    const fmtData = res.formats[this.selectedFormat] || res.formats[res.primaryFormat];
    const displayProb = eff.probability;

    let alertHtml = '';
    if (res.isBannedFairPlay) {
      alertHtml = `<div class="alert-banner banned">${escapeHtml(t.bannedFairPlayBanner)}</div>`;
    } else if (this.isAbortWindowOpen && displayProb >= 75) {
      alertHtml = `<div class="alert-banner abort-warn">${escapeHtml(t.abortWindowActive)}: ${escapeHtml(
        t.considerAborting
      )}</div>`;
    }

    const avatarHtml = res.avatarUrl
      ? `<img class="avatar" src="${escapeHtml(res.avatarUrl)}" alt="" />`
      : `<div class="avatar">${escapeHtml(res.displayName.slice(0, 1).toUpperCase())}</div>`;

    const titleBadgeHtml = res.title
      ? `<span class="title-pill">${escapeHtml(res.title.toUpperCase())}</span>`
      : '';

    const isoHtml =
      res.countryCode && res.countryCode.length === 2
        ? `<span class="iso-tag">${escapeHtml(res.countryCode.toUpperCase())}</span>`
        : '';

    const fmtRatingLabel = `${this.selectedFormat.charAt(0).toUpperCase() + this.selectedFormat.slice(1)} ${fmtData.currentRating ?? '-'}`;
    const pctText = lang === 'tr' ? `%${displayProb}` : `${displayProb}%`;
    const statusLine = this.resolveStatusLine(res, displayProb, lang);

    const clockCountBadge =
      lc && lc.movesObserved >= 2
        ? `<span class="tab-count ${lc.isLiveSuspectPacing ? 'alert' : ''}">${lc.movesObserved}</span>`
        : '';
    const gamesCountBadge =
      res.suspectPinpoints.length > 0
        ? `<span class="tab-count alert">${res.suspectPinpoints.length}</span>`
        : `<span class="tab-count">${res.recentMatches.length}</span>`;

    const tabContentHtml =
      this.activeTab === 'overview'
        ? this.renderOverviewTabHtml(res, lang)
        : this.activeTab === 'clock'
          ? this.renderClockTabHtml(res, lang)
          : this.renderGamesTabHtml(res, lang);

    const soundIcon = this.settings.soundAlerts ? ICONS.bellOn : ICONS.bellOff;
    const soundTitle = this.settings.soundAlerts ? t.actions.soundOn : t.actions.soundOff;

    setSafeHtml(
      this.cardEl,
      `
      ${this.renderHeaderHtml(lang)}
      ${alertHtml}
      <div class="hud-scroll-body">
        <div class="hero">
          <div class="hero-top">
            <div class="identity">
              ${avatarHtml}
              <div class="id-meta">
                <div class="player-row">
                  ${titleBadgeHtml}
                  <a class="username-link" href="https://www.chess.com/member/${encodeURIComponent(
                    res.displayName
                  )}" target="_blank" rel="noopener noreferrer">
                    ${escapeHtml(res.displayName)}
                  </a>
                  ${isoHtml}
                </div>
                <div class="sub-meta-row">
                  <span>${escapeHtml(fmtRatingLabel)}</span>
                  <span>·</span>
                  <span>${escapeHtml(t.confidenceLabel[res.confidence])}</span>
                </div>
              </div>
            </div>
            <div class="score-readout">
              <div class="score-num">${pctText}</div>
              <div class="score-tier">${escapeHtml(t.tiers[eff.tier].label)}</div>
            </div>
          </div>

          <div class="meter-wrap">
            <div class="meter-track">
              <div class="meter-fill" style="width:${Math.max(2, displayProb)}%"></div>
            </div>
          </div>
          <div class="verdict-line ${statusLine.cls}">${escapeHtml(statusLine.message)}</div>
        </div>

        <div class="view-tabs">
          <button class="view-tab ${this.activeTab === 'overview' ? 'active' : ''}" data-view-tab="overview">
            <span>${escapeHtml(t.hudTabs.overview)}</span>
          </button>
          <button class="view-tab ${this.activeTab === 'clock' ? 'active' : ''}" data-view-tab="clock">
            <span>${escapeHtml(t.hudTabs.clock)}</span>
            ${clockCountBadge}
          </button>
          <button class="view-tab ${this.activeTab === 'games' ? 'active' : ''}" data-view-tab="games">
            <span>${escapeHtml(t.hudTabs.games)}</span>
            ${gamesCountBadge}
          </button>
        </div>

        ${tabContentHtml}
      </div>

      <div class="hud-footer">
        <div class="footer-left">
          <button class="footer-btn ${this.copiedFeedback ? 'copied' : ''}" data-copy-report="1">
            ${this.copiedFeedback ? ICONS.check : ICONS.copy}
            <span>${escapeHtml(this.copiedFeedback ? t.actions.copiedReport : t.actions.copyReport)}</span>
          </button>
          <button class="footer-btn ${displayProb >= 45 ? 'report-warn' : ''}" data-open-report="1" title="${escapeHtml(t.actions.openProfile)}">
            ${ICONS.flag}
            <span>${escapeHtml(t.actions.reportFairPlay)}</span>
          </button>
        </div>
        <div class="footer-right">
          <button class="icon-btn" data-action="sound" title="${escapeHtml(soundTitle)}">${soundIcon}</button>
          <span class="kbd-hint">Alt+S</span>
        </div>
      </div>
    `
    );

    setSafeHtml(
      this.minPillEl,
      `
      <span class="min-dot"></span>
      <span class="min-pct">${pctText}</span>
      <span class="min-user">@${escapeHtml(res.displayName)}</span>
    `
    );

    this.bindHeaderEvents();

    this.cardEl.querySelectorAll('button[data-view-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.viewTab as HudViewTab;
        if (tab && tab !== this.activeTab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });

    this.cardEl.querySelectorAll('button[data-fmt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fmt = (btn as HTMLElement).dataset.fmt as TimeClass;
        if (fmt) {
          this.selectedFormat = fmt;
          this.render();
        }
      });
    });

    const toggleBtn = this.cardEl.querySelector('[data-toggle-details="1"]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.detailsExpanded = !this.detailsExpanded;
        this.render();
      });
    }

    this.cardEl.querySelectorAll('button[data-expand-match]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number((btn as HTMLElement).dataset.expandMatch);
        this.expandedMatchIdx = this.expandedMatchIdx === idx ? null : idx;
        this.render();
      });
    });

    const copyBtn = this.cardEl.querySelector('[data-copy-report="1"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = buildFairPlayEvidenceReport(res, lang, lc);
        void navigator.clipboard?.writeText(text).catch(() => {});
        this.copiedFeedback = true;
        this.render();
        setTimeout(() => {
          this.copiedFeedback = false;
          if (!this.isHidden) this.render();
        }, 2000);
      });
    }

    const reportBtn = this.cardEl.querySelector('[data-open-report="1"]');
    if (reportBtn) {
      reportBtn.addEventListener('click', () => {
        const text = buildFairPlayEvidenceReport(res, lang, lc);
        void navigator.clipboard?.writeText(text).catch(() => {});
        window.open(
          `https://www.chess.com/member/${encodeURIComponent(res.displayName)}`,
          '_blank',
          'noopener,noreferrer'
        );
      });
    }
  }
}
