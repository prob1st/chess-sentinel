export const HUD_SHADOW_CSS = `
  :host {
    all: initial;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: #f4f4f5;
    z-index: 2147483640;
    position: fixed;
    pointer-events: none;
    inset: 0;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  * {
    box-sizing: border-box;
  }

  .sentinel-card {
    --tier-color: #34d399;
    --tier-rgb: 52, 211, 153;
    pointer-events: auto;
    position: fixed;
    top: 64px;
    right: 18px;
    width: 350px;
    max-height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, rgba(24, 25, 30, 0.96) 0%, rgba(15, 16, 20, 0.98) 100%);
    backdrop-filter: blur(22px) saturate(140%);
    -webkit-backdrop-filter: blur(22px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 14px;
    box-shadow:
      0 26px 60px -12px rgba(0, 0, 0, 0.72),
      0 8px 22px -6px rgba(0, 0, 0, 0.48),
      inset 0 1px 0 rgba(255, 255, 255, 0.09);
    overflow: hidden;
    transition:
      opacity 0.22s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
    animation: cardEnter 0.26s cubic-bezier(0.22, 1, 0.36, 1);
    user-select: none;
  }

  @keyframes cardEnter {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .sentinel-card.hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-6px) scale(0.985);
  }

  .hud-scroll-body {
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.14) transparent;
  }

  /* Titlebar */
  .hud-header {
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 9px 0 13px;
    background: rgba(255, 255, 255, 0.018);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    cursor: grab;
    flex-shrink: 0;
  }

  .hud-header:active {
    cursor: grabbing;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .brand-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--tier-color);
  }

  .brand-title {
    font-size: 12.5px;
    font-weight: 600;
    color: #f4f4f5;
    letter-spacing: -0.015em;
  }

  .surface-tag {
    font-size: 10px;
    font-weight: 600;
    padding: 1.5px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    color: #a1a1aa;
    border: 1px solid rgba(255, 255, 255, 0.07);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .surface-tag.live {
    color: #6ee7b7;
    border-color: rgba(52, 211, 153, 0.24);
    background: rgba(52, 211, 153, 0.09);
  }

  .live-pulse {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 6px rgba(52, 211, 153, 0.7);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .icon-btn {
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    color: #a1a1aa;
    border-radius: 6px;
    height: 25px;
    min-width: 25px;
    padding: 0 5px;
    font-size: 10.5px;
    font-weight: 600;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.14s ease;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #fafafa;
  }

  .icon-btn.active {
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.12);
    border-color: rgba(251, 191, 36, 0.25);
  }

  .lang-btn {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    letter-spacing: 0.02em;
    color: #d4d4d8;
  }

  /* Critical / Abort Banner */
  .alert-banner {
    margin: 10px 12px 0;
    padding: 7px 10px;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.35;
    display: flex;
    align-items: center;
    gap: 7px;
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.32);
    color: #fda4af;
  }

  /* Hero Section with Subtle Ambient Radial Wash + 240-deg Instrument Dial */
  .hero {
    position: relative;
    padding: 13px 13px 12px;
    background: radial-gradient(
      170px 115px at 88% 24%,
      rgba(var(--tier-rgb), 0.15) 0%,
      rgba(var(--tier-rgb), 0) 78%
    );
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .hero-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .identity {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  .avatar-wrap {
    position: relative;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    object-fit: cover;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: linear-gradient(145deg, #27272a, #18181b);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 700;
    color: #e4e4e7;
  }

  .avatar-dot {
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--tier-color);
    border: 2px solid #16171b;
  }

  .id-meta {
    min-width: 0;
    flex: 1;
  }

  .player-row {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }

  .title-pill {
    padding: 1px 5px;
    border-radius: 4px;
    background: linear-gradient(180deg, #dc2626, #b91c1c);
    color: #fff;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  .username-link {
    font-size: 14.5px;
    font-weight: 650;
    letter-spacing: -0.015em;
    color: #fafafa;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .username-link:hover {
    color: #fff;
    text-decoration: underline;
  }

  .iso-tag {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 9.5px;
    font-weight: 600;
    color: #a1a1aa;
    background: rgba(255, 255, 255, 0.06);
    padding: 1px 4.5px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .sub-meta-row {
    margin-top: 3px;
    font-size: 11px;
    color: #a1a1aa;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-variant-numeric: tabular-nums;
  }

  .tier-chip {
    display: inline-flex;
    align-items: center;
    padding: 1px 6.5px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    color: var(--tier-color);
    background: rgba(var(--tier-rgb), 0.12);
    border: 1px solid rgba(var(--tier-rgb), 0.28);
  }

  /* 240-Degree Precision Instrument Arc Dial */
  .dial-wrap {
    position: relative;
    width: 70px;
    height: 62px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dial-svg {
    width: 70px;
    height: 62px;
    overflow: visible;
  }

  .dial-track {
    fill: none;
    stroke: rgba(255, 255, 255, 0.08);
    stroke-width: 5;
    stroke-linecap: round;
  }

  .dial-fill {
    fill: none;
    stroke: var(--tier-color);
    stroke-width: 5;
    stroke-linecap: round;
    filter: drop-shadow(0 0 8px rgba(var(--tier-rgb), 0.35));
    transition: stroke-dasharray 0.55s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.25s ease;
  }

  .dial-center {
    position: absolute;
    inset: 4px 0 0 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .dial-num {
    font-size: 19px;
    font-weight: 750;
    letter-spacing: -0.04em;
    line-height: 1;
    color: #fafafa;
    font-variant-numeric: tabular-nums;
  }

  .dial-num small {
    font-size: 11px;
    font-weight: 600;
    color: var(--tier-color);
    margin: 0 0.5px;
  }

  .dial-lbl {
    margin-top: 3px;
    font-size: 8.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #71717a;
  }

  /* Soft Verdict Pill */
  .verdict-callout {
    margin-top: 10px;
    padding: 7px 10px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11.2px;
    line-height: 1.38;
    color: #d4d4d8;
  }

  .verdict-icon {
    margin-top: 1px;
    color: var(--tier-color);
    flex-shrink: 0;
    display: inline-flex;
  }

  .verdict-callout.warn {
    background: rgba(251, 191, 36, 0.07);
    border-color: rgba(251, 191, 36, 0.22);
    color: #fde68a;
  }

  .verdict-callout.danger {
    background: rgba(244, 63, 94, 0.09);
    border-color: rgba(244, 63, 94, 0.28);
    color: #fecdd3;
  }

  /* Raycast-Style Segmented Control */
  .view-tabs-shell {
    padding: 8px 12px 2px;
    flex-shrink: 0;
  }

  .view-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px;
    padding: 3px;
    background: rgba(0, 0, 0, 0.34);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 9px;
  }

  .view-tab {
    appearance: none;
    border: none;
    background: transparent;
    color: #a1a1aa;
    border-radius: 6.5px;
    padding: 5px 6px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    transition: all 0.15s ease;
  }

  .view-tab:hover {
    color: #e4e4e7;
  }

  .view-tab.active {
    background: rgba(255, 255, 255, 0.09);
    color: #ffffff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.09);
  }

  .tab-count {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 9.5px;
    padding: 0.5px 4.5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    color: #d4d4d8;
  }

  .tab-count.alert {
    background: rgba(244, 63, 94, 0.24);
    color: #fda4af;
  }

  /* Tab Content Container */
  .tab-pane {
    padding: 9px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Speed Pills */
  .format-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .fmt-tab {
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.025);
    color: #a1a1aa;
    border-radius: 8px;
    padding: 5px 8px;
    font-size: 10.5px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-transform: capitalize;
    transition: all 0.14s ease;
  }

  .fmt-tab:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f4f4f5;
  }

  .fmt-tab.active {
    background: rgba(var(--tier-rgb), 0.1);
    border-color: rgba(var(--tier-rgb), 0.3);
    color: #ffffff;
  }

  .fmt-elo {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10.5px;
    font-weight: 650;
    color: #e4e4e7;
  }

  /* Sculpted 2x3 Metric Cards */
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .metric-card {
    background: rgba(255, 255, 255, 0.028);
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    border-radius: 9px;
    padding: 7px 9px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .metric-lbl {
    font-size: 10px;
    font-weight: 500;
    color: #71717a;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .metric-val-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px;
    min-width: 0;
  }

  .metric-val {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #f4f4f5;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .metric-val.pos { color: #34d399; }
  .metric-val.warn { color: #fbbf24; }
  .metric-val.neg { color: #fb7185; }

  .metric-sub {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    color: #a1a1aa;
    white-space: nowrap;
  }

  /* Form Micro-Pills */
  .form-dots {
    display: inline-flex;
    align-items: center;
    gap: 2.5px;
  }

  .form-dot {
    width: 6px;
    height: 6px;
    border-radius: 2px;
  }
  .form-dot.W { background: #34d399; }
  .form-dot.L { background: #f43f5e; }
  .form-dot.D { background: #71717a; }

  /* Pinpointed Suspect Games Timeline Card */
  .pinpoint-panel {
    border: 1px solid rgba(244, 63, 94, 0.28);
    background: linear-gradient(180deg, rgba(244, 63, 94, 0.08) 0%, rgba(244, 63, 94, 0.03) 100%);
    border-radius: 10px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .sec-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    font-weight: 600;
    color: #a1a1aa;
  }

  .pinpoint-panel .sec-head {
    color: #fda4af;
  }

  .pinpoint-item {
    padding: 6px 8px;
    border-radius: 7px;
    background: rgba(0, 0, 0, 0.26);
    border-left: 2px solid #f43f5e;
    display: flex;
    flex-direction: column;
    gap: 2.5px;
  }

  .pinpoint-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 600;
    color: #f4f4f5;
  }

  .pinpoint-open {
    font-size: 10px;
    font-weight: 600;
    color: #93c5fd;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .pinpoint-open:hover {
    text-decoration: underline;
  }

  .pinpoint-body {
    font-size: 10.5px;
    line-height: 1.35;
    color: #e4e4e7;
  }

  .pinpoint-san {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 9.5px;
    color: #a1a1aa;
  }

  /* Clean Insight Bullet Rows */
  .flags-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 2px 2px 0;
  }

  .flag-line {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11px;
    line-height: 1.38;
    color: #d4d4d8;
  }

  .flag-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-top: 4.5px;
    flex-shrink: 0;
  }
  .flag-dot.danger { background: #f43f5e; box-shadow: 0 0 6px rgba(244, 63, 94, 0.5); }
  .flag-dot.warning { background: #fbbf24; }
  .flag-dot.info { background: #60a5fa; }
  .flag-dot.positive { background: #34d399; }

  /* Collapsible Signal Breakdown */
  .details-toggle {
    width: 100%;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.025);
    color: #a1a1aa;
    font-size: 10.5px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.14s ease;
  }

  .details-toggle:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f4f4f5;
  }

  .signals-panel {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 4px 2px 0;
  }

  .signals-panel.collapsed {
    display: none;
  }

  .sig-row {
    display: flex;
    flex-direction: column;
    gap: 3.5px;
  }

  .sig-head {
    display: flex;
    justify-content: space-between;
    font-size: 10.5px;
    color: #a1a1aa;
  }

  .sig-score {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-weight: 600;
    color: #e4e4e7;
  }

  .sig-bar-bg {
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    overflow: hidden;
  }

  .sig-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* Smooth Vector SVG Chronogram & Distribution Cards */
  .chart-box {
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.025);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    padding: 9px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .chart-box.suspect {
    border-color: rgba(244, 63, 94, 0.34);
    background: linear-gradient(180deg, rgba(244, 63, 94, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%);
  }

  .empty-note {
    font-size: 11px;
    color: #71717a;
    padding: 10px 2px;
    line-height: 1.45;
  }

  .chrono-svg-wrap {
    width: 100%;
    height: 82px;
    position: relative;
  }

  .chrono-svg {
    width: 100%;
    height: 82px;
    display: block;
    overflow: visible;
  }

  .move-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .move-chip {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 9.5px;
    padding: 2px 5.5px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.04);
    color: #d4d4d8;
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  .move-chip.suspect {
    background: rgba(244, 63, 94, 0.14);
    border-color: rgba(244, 63, 94, 0.35);
    color: #fda4af;
  }

  .live-suspect-msg {
    font-size: 10.5px;
    font-weight: 500;
    color: #fda4af;
    line-height: 1.38;
    padding-top: 2px;
    border-top: 1px solid rgba(244, 63, 94, 0.18);
  }

  /* Sculpted 7-Bin Capsule Histogram */
  .hist-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
    height: 64px;
    padding-top: 2px;
  }

  .hist-col-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    gap: 4px;
  }

  .hist-track {
    flex: 1;
    width: 100%;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.035);
    display: flex;
    align-items: flex-end;
    overflow: hidden;
    padding: 1px;
  }

  .hist-bar {
    width: 100%;
    border-radius: 4px;
    min-height: 3px;
    transition: height 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .hist-lbl {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 8.5px;
    color: #71717a;
  }

  /* Recent Games List + Smooth Inline SVG Sparkline Drawer */
  .matches-list {
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.02);
  }

  .match-block {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .match-block:last-child {
    border-bottom: none;
  }

  .match-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 9px;
    gap: 6px;
    font-size: 11px;
    color: #f4f4f5;
    transition: background 0.12s ease;
  }

  .match-row:hover {
    background: rgba(255, 255, 255, 0.035);
  }

  .match-left {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    flex: 1;
  }

  .match-res {
    width: 17px;
    height: 17px;
    border-radius: 5px;
    font-size: 9.5px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .match-res.W { background: rgba(52, 211, 153, 0.16); color: #34d399; }
  .match-res.L { background: rgba(244, 63, 94, 0.16); color: #fb7185; }
  .match-res.D { background: rgba(161, 161, 170, 0.16); color: #d4d4d8; }

  .match-opp {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 550;
    color: #e4e4e7;
  }

  .match-opp-elo {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    color: #71717a;
  }

  .match-right {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 10px;
    color: #a1a1aa;
    flex-shrink: 0;
  }

  .match-acc {
    padding: 1.5px 5px;
    border-radius: 4px;
    background: rgba(96, 165, 250, 0.12);
    color: #93c5fd;
    font-weight: 600;
  }

  .match-acc.high {
    background: rgba(244, 63, 94, 0.18);
    color: #fda4af;
  }

  .match-pin-tag {
    padding: 1.5px 5px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 600;
    background: rgba(244, 63, 94, 0.18);
    color: #fda4af;
  }

  .mini-link-btn {
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: #a1a1aa;
    border-radius: 5px;
    height: 20px;
    padding: 0 5px;
    font-size: 9.5px;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.12s ease;
  }

  .mini-link-btn:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.09);
  }

  .mini-link-btn.active {
    background: rgba(var(--tier-rgb), 0.15);
    border-color: rgba(var(--tier-rgb), 0.35);
    color: var(--tier-color);
  }

  .match-drawer {
    padding: 7px 10px 9px;
    background: rgba(0, 0, 0, 0.28);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  /* Footer Bar */
  .hud-footer {
    height: 38px;
    padding: 0 11px;
    background: rgba(255, 255, 255, 0.018);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-shrink: 0;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .footer-btn {
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.045);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    color: #e4e4e7;
    border-radius: 7px;
    height: 25px;
    padding: 0 9px;
    font-size: 10.5px;
    font-weight: 600;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.14s ease;
  }

  .footer-btn:hover {
    background: rgba(255, 255, 255, 0.09);
    border-color: rgba(255, 255, 255, 0.16);
    color: #ffffff;
  }

  .footer-btn.copied {
    border-color: rgba(52, 211, 153, 0.45);
    background: rgba(52, 211, 153, 0.12);
    color: #6ee7b7;
  }

  .footer-btn.report-warn {
    border-color: rgba(251, 146, 60, 0.38);
    background: rgba(251, 146, 60, 0.1);
    color: #fdba74;
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .kbd-hint {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 9.5px;
    padding: 1.5px 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #71717a;
  }

  /* Loading State */
  .loading-box {
    padding: 20px 14px;
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #34d399;
    animation: spin 0.72s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-text {
    font-size: 12.5px;
    color: #f4f4f5;
    font-weight: 600;
  }

  .loading-sub {
    font-size: 11px;
    color: #a1a1aa;
    margin-top: 2px;
  }

  /* Minimized Floating Capsule */
  .minimized-pill {
    --tier-color: #34d399;
    --tier-rgb: 52, 211, 153;
    pointer-events: auto;
    position: fixed;
    top: 64px;
    right: 18px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(24, 25, 30, 0.95) 0%, rgba(15, 16, 20, 0.98) 100%);
    backdrop-filter: blur(18px);
    border: 1px solid rgba(255, 255, 255, 0.11);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    cursor: pointer;
    user-select: none;
    transition: transform 0.15s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.15s ease;
  }

  .minimized-pill:hover {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.22);
  }

  .minimized-pill.hidden {
    display: none;
  }

  .min-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--tier-color);
    box-shadow: 0 0 8px rgba(var(--tier-rgb), 0.65);
  }

  .min-pct {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--tier-color);
    font-variant-numeric: tabular-nums;
  }

  .min-user {
    font-size: 12px;
    font-weight: 600;
    color: #e4e4e7;
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
