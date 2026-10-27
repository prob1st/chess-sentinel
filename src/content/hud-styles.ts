export const HUD_SHADOW_CSS = `
  :host {
    all: initial;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #f8fafc;
    z-index: 2147483640;
    position: fixed;
    pointer-events: none;
    inset: 0;
  }

  * {
    box-sizing: border-box;
  }

  .sentinel-card {
    pointer-events: auto;
    position: fixed;
    top: 72px;
    right: 20px;
    width: 356px;
    max-height: calc(100vh - 88px);
    display: flex;
    flex-direction: column;
    background: linear-gradient(165deg, rgba(13, 18, 30, 0.94) 0%, rgba(8, 11, 20, 0.97) 100%);
    backdrop-filter: blur(22px) saturate(165%);
    -webkit-backdrop-filter: blur(22px) saturate(165%);
    border: 1px solid var(--tier-border, rgba(148, 163, 184, 0.22));
    border-radius: 18px;
    box-shadow:
      0 24px 54px -12px rgba(0, 0, 0, 0.72),
      0 0 0 1px rgba(255, 255, 255, 0.04) inset,
      0 0 28px -8px var(--tier-glow, rgba(16, 185, 129, 0.22));
    overflow: hidden;
    transition:
      opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.24s cubic-bezier(0.16, 1, 0.3, 1),
      border-color 0.3s ease,
      box-shadow 0.3s ease;
    animation: sentinelSlideIn 0.32s cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
  }

  .hud-scroll-body {
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgba(148, 163, 184, 0.25) transparent;
  }

  .sentinel-card.hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-8px) scale(0.97);
  }

  @keyframes sentinelSlideIn {
    from {
      opacity: 0;
      transform: translateY(-12px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes pulseDanger {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45); }
    50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
  }

  /* Top Glow Bar */
  .tier-accent-line {
    height: 3px;
    width: 100%;
    background: linear-gradient(90deg, transparent 0%, var(--tier-color, #10b981) 50%, transparent 100%);
    opacity: 0.95;
  }

  /* Header / Drag Handle */
  .hud-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 13px 8px;
    cursor: grab;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .hud-header:active {
    cursor: grabbing;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .brand-shield {
    width: 18px;
    height: 18px;
    color: var(--tier-color, #10b981);
    filter: drop-shadow(0 0 6px var(--tier-glow, rgba(16, 185, 129, 0.4)));
    flex-shrink: 0;
  }

  .brand-title {
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    background: linear-gradient(90deg, #f8fafc, #cbd5e1);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .icon-btn {
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: #94a3b8;
    border-radius: 7px;
    height: 24px;
    min-width: 24px;
    padding: 0 6px;
    font-size: 11px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.11);
    color: #f8fafc;
    border-color: rgba(255, 255, 255, 0.18);
  }

  .icon-btn.active {
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.45);
    background: rgba(251, 191, 36, 0.14);
  }

  .lang-btn {
    font-size: 10px;
    letter-spacing: 0.04em;
    color: #cbd5e1;
  }

  /* Banned or Abort Alert Banner */
  .alert-banner {
    margin: 10px 13px 0;
    padding: 7px 10px;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 7px;
    letter-spacing: 0.02em;
  }

  .alert-banner.banned {
    background: rgba(244, 63, 94, 0.2);
    border: 1px solid rgba(244, 63, 94, 0.55);
    color: #fda4af;
    animation: pulseDanger 2s infinite;
  }

  .alert-banner.abort-warn {
    background: rgba(239, 68, 68, 0.16);
    border: 1px solid rgba(239, 68, 68, 0.42);
    color: #fca5a5;
  }

  .alert-banner.abort-safe {
    background: rgba(56, 189, 248, 0.11);
    border: 1px solid rgba(56, 189, 248, 0.28);
    color: #bae6fd;
  }

  /* Hero Section: Gauge + Player Identity */
  .hero {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 13px 14px 11px;
  }

  .gauge-wrap {
    position: relative;
    width: 86px;
    height: 86px;
    flex-shrink: 0;
  }

  .gauge-svg {
    width: 86px;
    height: 86px;
    transform: rotate(-90deg);
  }

  .gauge-track {
    fill: none;
    stroke: rgba(255, 255, 255, 0.07);
    stroke-width: 7;
  }

  .gauge-progress {
    fill: none;
    stroke: var(--tier-color, #10b981);
    stroke-width: 7;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.75s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease;
    filter: drop-shadow(0 0 6px var(--tier-glow, rgba(16, 185, 129, 0.5)));
  }

  .gauge-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .gauge-pct {
    font-size: 23px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    line-height: 1;
    color: #f8fafc;
  }

  .gauge-pct span {
    font-size: 13px;
    font-weight: 700;
    color: var(--tier-color, #10b981);
  }

  .gauge-caption {
    margin-top: 3px;
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #94a3b8;
    text-transform: uppercase;
  }

  .identity {
    flex: 1;
    min-width: 0;
  }

  .player-row {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .avatar {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    object-fit: cover;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: #1e293b;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    color: #cbd5e1;
  }

  .title-pill {
    padding: 1px 5px;
    border-radius: 4px;
    background: linear-gradient(135deg, #b91c1c, #dc2626);
    color: #fff;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .username-link {
    font-size: 14.5px;
    font-weight: 700;
    color: #f8fafc;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .username-link:hover {
    text-decoration: underline;
    color: #38bdf8;
  }

  .tier-badge-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  .tier-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2.5px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    background: var(--tier-bg, rgba(16, 185, 129, 0.15));
    color: var(--tier-color, #10b981);
    border: 1px solid var(--tier-border, rgba(16, 185, 129, 0.35));
  }

  .conf-tag {
    font-size: 10px;
    color: #94a3b8;
    font-weight: 500;
  }

  .verdict-sub {
    margin-top: 5px;
    font-size: 11px;
    color: #cbd5e1;
    line-height: 1.3;
  }

  /* Format Tabs */
  .format-tabs {
    display: flex;
    gap: 5px;
    padding: 0 14px 10px;
  }

  .fmt-tab {
    flex: 1;
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.03);
    color: #94a3b8;
    border-radius: 8px;
    padding: 5px 6px;
    font-size: 10.5px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.15s ease;
    text-transform: capitalize;
  }

  .fmt-tab:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #e2e8f0;
  }

  .fmt-tab.active {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--tier-border, rgba(56, 189, 248, 0.4));
    color: #f8fafc;
  }

  .fmt-elo {
    font-variant-numeric: tabular-nums;
    color: #cbd5e1;
    font-weight: 600;
  }

  /* 4-Tile Stat Grid */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    padding: 0 14px 10px;
  }

  .stat-tile {
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 9px;
    padding: 6px 7px;
    text-align: center;
  }

  .stat-val {
    font-size: 12.5px;
    font-weight: 800;
    color: #f8fafc;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .stat-val.pos { color: #34d399; }
  .stat-val.warn { color: #fbbf24; }
  .stat-val.neg { color: #f87171; }

  .stat-lbl {
    margin-top: 2px;
    font-size: 9px;
    font-weight: 600;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Recent Form Strip */
  .form-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px 10px;
    gap: 8px;
  }

  .form-dots {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .form-dot {
    width: 17px;
    height: 17px;
    border-radius: 5px;
    font-size: 9.5px;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .form-dot.W {
    background: rgba(16, 185, 129, 0.18);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }
  .form-dot.L {
    background: rgba(239, 68, 68, 0.16);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .form-dot.D {
    background: rgba(148, 163, 184, 0.16);
    color: #cbd5e1;
    border: 1px solid rgba(148, 163, 184, 0.28);
  }

  .wld-summary {
    font-size: 10.5px;
    font-weight: 700;
    color: #cbd5e1;
    font-variant-numeric: tabular-nums;
  }

  /* Insight Flags */
  .flags-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 0 14px 10px;
  }

  .flag-chip {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 8px;
    font-size: 10.8px;
    line-height: 1.32;
    font-weight: 500;
  }

  .flag-chip.danger {
    background: rgba(239, 68, 68, 0.13);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fecaca;
  }
  .flag-chip.warning {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.28);
    color: #fde68a;
  }
  .flag-chip.info {
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.28);
    color: #bae6fd;
  }
  .flag-chip.positive {
    background: rgba(16, 185, 129, 0.11);
    border: 1px solid rgba(16, 185, 129, 0.26);
    color: #a7f3d0;
  }

  /* Collapsible 6-Signal Bars */
  .details-toggle {
    width: calc(100% - 28px);
    margin: 0 14px 10px;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.03);
    color: #cbd5e1;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: background 0.15s ease;
  }

  .details-toggle:hover {
    background: rgba(255, 255, 255, 0.07);
  }

  .signals-panel {
    padding: 2px 14px 13px;
    display: flex;
    flex-direction: column;
    gap: 7px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .signals-panel.collapsed {
    display: none;
  }

  .sig-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .sig-head {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 600;
    color: #cbd5e1;
  }

  .sig-score {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: #f8fafc;
  }

  .sig-bar-bg {
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .sig-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.55s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* v3.2 Automatic Plain-Language Verdict Card */
  .auto-verdict-card {
    margin: 0 14px 9px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(16, 185, 129, 0.32);
    background: rgba(16, 185, 129, 0.1);
    color: #d1fae5;
    font-size: 10.5px;
    line-height: 1.38;
  }
  .auto-verdict-card.smurf {
    border-color: rgba(56, 189, 248, 0.35);
    background: rgba(56, 189, 248, 0.11);
    color: #e0f2fe;
  }
  .auto-verdict-card.warn {
    border-color: rgba(245, 158, 11, 0.42);
    background: rgba(245, 158, 11, 0.12);
    color: #fef3c7;
  }
  .auto-verdict-card.danger {
    border-color: rgba(239, 68, 68, 0.58);
    background: rgba(127, 29, 29, 0.32);
    color: #fee2e2;
  }
  .auto-verdict-head {
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.07em;
    opacity: 0.82;
    margin-bottom: 3px;
  }
  .auto-verdict-text {
    font-weight: 600;
  }

  /* v3.2 Pinpointed Suspect Games & Exact Move Ranges Panel */
  .pinpoint-panel {
    margin: 0 14px 9px;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(127, 29, 29, 0.18);
    border: 1px solid rgba(248, 113, 113, 0.35);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pinpoint-title {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #fca5a5;
  }
  .pinpoint-item {
    padding: 6px 8px;
    border-radius: 7px;
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.07);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .pinpoint-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 700;
    color: #f8fafc;
  }
  .pinpoint-open {
    font-size: 9.5px;
    font-weight: 700;
    color: #7dd3fc;
    text-decoration: none;
  }
  .pinpoint-open:hover {
    text-decoration: underline;
  }
  .pinpoint-body {
    font-size: 10px;
    line-height: 1.32;
    color: #fecaca;
    font-weight: 600;
  }
  .pinpoint-san {
    font-size: 9px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #cbd5e1;
    opacity: 0.9;
  }

  /* v3.0 / v3.2 Live Match Clock Radar with Move Numbers */
  .live-clock-box {
    margin: 0 14px 9px;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(15, 23, 42, 0.72);
    border: 1px solid rgba(56, 189, 248, 0.22);
  }
  .live-clock-box.suspect {
    background: rgba(127, 29, 29, 0.24);
    border-color: rgba(239, 68, 68, 0.55);
  }
  .live-clock-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: #7dd3fc;
    margin-bottom: 5px;
  }
  .live-clock-box.suspect .live-clock-head {
    color: #fca5a5;
  }
  .live-spark-bars {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 32px;
  }
  .live-spark-item {
    flex: 1;
    min-width: 8px;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
  }
  .live-spark-col {
    width: 100%;
    border-radius: 2px 2px 0 0;
    transition: height 0.2s ease;
  }
  .live-spark-num {
    font-size: 7.5px;
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .live-spark-num.suspect {
    color: #fca5a5;
    font-weight: 800;
  }
  .live-spark-num.pause {
    color: #fcd34d;
    font-weight: 800;
  }
  .live-suspect-msg {
    margin-top: 6px;
    font-size: 10px;
    font-weight: 700;
    color: #fecaca;
    line-height: 1.35;
  }
  .match-pin-tag {
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 8.5px;
    font-weight: 800;
    background: rgba(239, 68, 68, 0.22);
    color: #fecaca;
    border: 1px solid rgba(248, 113, 113, 0.35);
  }

  /* v3.0 7-Bin Move-Time Histogram */
  .hist-card {
    margin-top: 6px;
    padding: 8px 10px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }
  .sub-sec-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #94a3b8;
    margin-bottom: 7px;
  }
  .hist-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    align-items: end;
    height: 44px;
  }
  .hist-col-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    gap: 3px;
  }
  .hist-bar {
    width: 100%;
    border-radius: 3px 3px 1px 1px;
    min-height: 3px;
  }
  .hist-lbl {
    font-size: 8px;
    color: #64748b;
    font-variant-numeric: tabular-nums;
  }

  /* v3.0 Recent 5 Matches Strip */
  .matches-card {
    margin-top: 5px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .match-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
    text-decoration: none;
    color: #e2e8f0;
    font-size: 10px;
    transition: background 0.14s ease;
  }
  .match-row:hover {
    background: rgba(255, 255, 255, 0.07);
  }
  .match-left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .match-res {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    font-size: 9.5px;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .match-res.W { background: rgba(16, 185, 129, 0.2); color: #34d399; }
  .match-res.L { background: rgba(239, 68, 68, 0.2); color: #f87171; }
  .match-res.D { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; }
  .match-opp {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 145px;
    font-weight: 600;
  }
  .match-right {
    display: flex;
    align-items: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
    font-size: 9.5px;
    color: #94a3b8;
    flex-shrink: 0;
  }
  .match-acc {
    padding: 1px 5px;
    border-radius: 4px;
    font-weight: 700;
    background: rgba(56, 189, 248, 0.12);
    color: #7dd3fc;
  }
  .match-acc.high {
    background: rgba(239, 68, 68, 0.18);
    color: #fca5a5;
  }

  /* v3.0 Copy Fair-Play Evidence Button */
  .copy-report-btn {
    margin-top: 6px;
    width: 100%;
    padding: 7px 10px;
    border-radius: 8px;
    border: 1px solid rgba(56, 189, 248, 0.28);
    background: rgba(56, 189, 248, 0.1);
    color: #bae6fd;
    font-size: 10.5px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.16s ease;
    text-align: center;
  }
  .copy-report-btn:hover {
    background: rgba(56, 189, 248, 0.19);
    color: #f8fafc;
  }
  .copy-report-btn.copied {
    border-color: rgba(16, 185, 129, 0.5);
    background: rgba(16, 185, 129, 0.18);
    color: #6ee7b7;
  }

  /* Loading State */
  .loading-box {
    padding: 22px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2.5px solid rgba(255, 255, 255, 0.12);
    border-top-color: #38bdf8;
    animation: spin 0.75s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-text {
    font-size: 12px;
    color: #cbd5e1;
    font-weight: 600;
  }

  .loading-sub {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 2px;
  }

  /* Minimized Pill */
  .minimized-pill {
    pointer-events: auto;
    position: fixed;
    top: 72px;
    right: 20px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(11, 15, 26, 0.92);
    backdrop-filter: blur(16px);
    border: 1px solid var(--tier-border, rgba(148, 163, 184, 0.3));
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55), 0 0 18px -4px var(--tier-glow, transparent);
    cursor: pointer;
    user-select: none;
    transition: transform 0.15s ease, box-shadow 0.2s ease;
  }

  .minimized-pill:hover {
    transform: translateY(-1px) scale(1.02);
  }

  .minimized-pill.hidden {
    display: none;
  }

  .min-pct {
    font-size: 13px;
    font-weight: 800;
    color: var(--tier-color, #10b981);
    font-variant-numeric: tabular-nums;
  }

  .min-user {
    font-size: 12px;
    font-weight: 600;
    color: #e2e8f0;
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
