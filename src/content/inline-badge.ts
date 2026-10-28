import { TIER_THEMES } from '../core/calibration';
import { computeEffectiveLiveRisk } from '../core/engine';
import {
  CheatAnalysisResult,
  Language,
  LiveMatchClockTelemetry,
  PageSurfaceKind,
} from '../types';

const BADGE_CLASS = 'chess-sentinel-inline-pill';
const STYLE_ID = 'chess-sentinel-inline-style';

function ensureInlineStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${BADGE_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 4px;
      background: #21201d;
      border: 1px solid rgba(255, 255, 255, 0.14);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 11px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      line-height: 1.4;
      color: #e7e5e4;
      cursor: pointer;
      user-select: none;
      vertical-align: middle;
      white-space: nowrap;
      transition: background-color 0.12s ease, border-color 0.12s ease;
      z-index: 20;
    }
    .${BADGE_CLASS}:hover {
      background: #2b2926;
      border-color: rgba(255, 255, 255, 0.26);
    }
    .${BADGE_CLASS} .cs-pill-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .${BADGE_CLASS} .cs-pill-prob {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-weight: 700;
    }
    .${BADGE_CLASS} .cs-pill-wld {
      color: #a8a29e;
      font-weight: 500;
      font-size: 10.5px;
      padding-left: 5px;
      border-left: 1px solid rgba(255, 255, 255, 0.12);
    }
  `;
  document.head.appendChild(style);
}

function findProfileHeaderAnchor(): Element | null {
  const selectors = [
    '.profile-card-username',
    '[data-cy="profile-header-username"]',
    '.profile-header-details-username',
    '.v5-section-content-wide .profile-card-info h1',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el.parentElement || el;
  }
  return null;
}

function findPlayerAnchorContainer(
  targetSide: 'top' | 'bottom',
  surface: PageSurfaceKind = 'live'
): Element | null {
  if (surface === 'profile') {
    return findProfileHeaderAnchor();
  }

  const selectors =
    targetSide === 'top'
      ? [
          '#board-layout-player-top .user-tagline-component',
          '#board-layout-top .user-tagline-component',
          '.board-layout-top .user-tagline-component',
          '.player-component.player-top .user-tagline-component',
          '.player-top .user-tagline-component',
          '#board-layout-player-top .cc-user-block',
          '.player-top .cc-user-block',
          '#board-layout-player-top .user-tagline-compact-row',
          '.board-layout-top cc-user-username-component',
          '#board-layout-player-top cc-user-username-component',
          '.player-top cc-user-username-component',
        ]
      : [
          '#board-layout-player-bottom .user-tagline-component',
          '#board-layout-bottom .user-tagline-component',
          '.board-layout-bottom .user-tagline-component',
          '.player-component.player-bottom .user-tagline-component',
          '.player-bottom .user-tagline-component',
          '#board-layout-player-bottom .cc-user-block',
          '.player-bottom .cc-user-block',
          '#board-layout-player-bottom .user-tagline-compact-row',
          '.board-layout-bottom cc-user-username-component',
          '#board-layout-player-bottom cc-user-username-component',
          '.player-bottom cc-user-username-component',
        ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      if (
        el.tagName.toLowerCase() === 'cc-user-username-component' ||
        el.classList.contains('cc-user-username-component') ||
        el.classList.contains('user-tagline-username')
      ) {
        return el.parentElement || el;
      }
      return el;
    }
  }
  return null;
}

export function renderInlineUsernameBadge(
  result: CheatAnalysisResult,
  targetSide: 'top' | 'bottom',
  lang: Language,
  onClick: () => void,
  options?: {
    liveClock?: LiveMatchClockTelemetry | null;
    surface?: PageSurfaceKind;
  }
): void {
  ensureInlineStyles();
  removeInlineUsernameBadges();

  const container = findPlayerAnchorContainer(targetSide, options?.surface ?? 'live');
  if (!container) return;

  const eff = computeEffectiveLiveRisk(result, options?.liveClock);
  const theme = TIER_THEMES[eff.tier];
  const pf = result.formats[result.primaryFormat];

  const probText = lang === 'tr' ? `%${eff.probability}` : `${eff.probability}%`;
  const wldText =
    pf.recentTotal > 0
      ? lang === 'tr'
        ? `${pf.recentWins}G-${pf.recentLosses}M`
        : `${pf.recentWins}W-${pf.recentLosses}L`
      : lang === 'tr'
        ? `${pf.overallWins}G-${pf.overallLosses}M`
        : `${pf.overallWins}W-${pf.overallLosses}L`;

  const pill = document.createElement('span');
  pill.className = BADGE_CLASS;
  pill.style.borderColor = theme.border;
  pill.title =
    lang === 'tr'
      ? `Chess Sentinel: %${eff.probability} (Paneli acmak icin tikla)`
      : `Chess Sentinel: ${eff.probability}% (Click to open panel)`;

  const dot = document.createElement('span');
  dot.className = 'cs-pill-dot';
  dot.style.background = theme.color;

  const probSpan = document.createElement('span');
  probSpan.className = 'cs-pill-prob';
  probSpan.style.color = theme.color;
  probSpan.textContent = probText;

  const wldSpan = document.createElement('span');
  wldSpan.className = 'cs-pill-wld';
  wldSpan.textContent = wldText;

  pill.append(dot, probSpan, wldSpan);
  pill.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  container.appendChild(pill);
}

export function removeInlineUsernameBadges(): void {
  document.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
}
