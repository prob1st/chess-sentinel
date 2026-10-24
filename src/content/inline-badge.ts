import { TIER_THEMES } from '../core/calibration';
import { CheatAnalysisResult, Language } from '../types';

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
      margin-left: 7px;
      padding: 2px 8px;
      border-radius: 999px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11.5px;
      font-weight: 700;
      line-height: 1.35;
      letter-spacing: 0.01em;
      cursor: pointer;
      user-select: none;
      vertical-align: middle;
      transition: transform 0.16s ease, filter 0.16s ease, box-shadow 0.16s ease;
      backdrop-filter: blur(8px);
      white-space: nowrap;
      z-index: 20;
    }
    .${BADGE_CLASS}:hover {
      transform: translateY(-1px) scale(1.03);
      filter: brightness(1.12);
    }
    .${BADGE_CLASS} .cs-pill-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .${BADGE_CLASS} .cs-pill-wld {
      opacity: 0.85;
      font-weight: 600;
      font-size: 10.5px;
      padding-left: 4px;
      border-left: 1px solid rgba(255, 255, 255, 0.16);
    }
  `;
  document.head.appendChild(style);
}

function findPlayerAnchorContainer(targetSide: 'top' | 'bottom'): Element | null {
  const selectors =
    targetSide === 'top'
      ? [
          '#board-layout-player-top .user-tagline-component',
          '#board-layout-top .user-tagline-component',
          '.board-layout-top .user-tagline-component',
          '#board-layout-player-top .user-tagline-compact-row',
          '.board-layout-top cc-user-username-component',
          '#board-layout-player-top cc-user-username-component',
        ]
      : [
          '#board-layout-player-bottom .user-tagline-component',
          '#board-layout-bottom .user-tagline-component',
          '.board-layout-bottom .user-tagline-component',
          '#board-layout-player-bottom .user-tagline-compact-row',
          '.board-layout-bottom cc-user-username-component',
          '#board-layout-player-bottom cc-user-username-component',
        ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      return el.tagName.toLowerCase() === 'cc-user-username-component'
        ? el.parentElement || el
        : el;
    }
  }
  return null;
}

export function renderInlineUsernameBadge(
  result: CheatAnalysisResult,
  targetSide: 'top' | 'bottom',
  lang: Language,
  onClick: () => void
): void {
  ensureInlineStyles();
  removeInlineUsernameBadges();

  const container = findPlayerAnchorContainer(targetSide);
  if (!container) return;

  const theme = TIER_THEMES[result.tier];
  const pf = result.formats[result.primaryFormat];

  const probText = lang === 'tr' ? `%${result.probability}` : `${result.probability}%`;
  const wldText =
    pf.recentTotal > 0
      ? lang === 'tr'
        ? `${pf.recentWins}G/${pf.recentLosses}M`
        : `${pf.recentWins}W/${pf.recentLosses}L`
      : lang === 'tr'
        ? `${pf.overallWins}G/${pf.overallLosses}M`
        : `${pf.overallWins}W/${pf.overallLosses}L`;

  const pill = document.createElement('span');
  pill.className = BADGE_CLASS;
  pill.style.background = theme.accentBg;
  pill.style.border = `1px solid ${theme.border}`;
  pill.style.color = theme.color;
  pill.style.boxShadow = `0 2px 10px ${theme.glow}`;
  pill.title =
    lang === 'tr'
      ? `Chess Sentinel — Hile Olasılığı: %${result.probability} (Detaylar için tıkla)`
      : `Chess Sentinel — Cheat Probability: ${result.probability}% (Click for HUD)`;

  const dot = document.createElement('span');
  dot.className = 'cs-pill-dot';
  dot.style.background = theme.color;
  dot.style.boxShadow = `0 0 6px ${theme.color}`;

  const probSpan = document.createElement('span');
  probSpan.textContent = probText;

  const wldSpan = document.createElement('span');
  wldSpan.className = 'cs-pill-wld';
  wldSpan.style.color = '#e2e8f0';
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
