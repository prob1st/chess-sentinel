export const HUD_SHADOW_CSS = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: #e7e5e4;
    z-index: 2147483640;
    position: fixed;
    pointer-events: none;
    inset: 0;
    -webkit-font-smoothing: antialiased;
  }

  * {
    box-sizing: border-box;
  }

  .sentinel-card {
    pointer-events: auto;
    position: fixed;
    top: 64px;
    right: 16px;
    width: 336px;
    max-height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
    background: #21201d;
    border: 1px solid #383530;
    border-radius: 8px;
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.56), 0 1px 0 rgba(255, 255, 255, 0.04) inset;
    overflow: hidden;
    transition: opacity 0.16s ease, transform 0.16s ease;
    user-select: none;
  }

  .sentinel-card.hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
  }

  .hud-scroll-body {
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: #3f3c37 transparent;
  }

  /* Titlebar */
  .hud-header {
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 0 11px;
    background: #1a1917;
    border-bottom: 1px solid #302e2a;
    cursor: grab;
    flex-shrink: 0;
  }

  .hud-header:active {
    cursor: grabbing;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .brand-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--tier-color, #81b64c);
    flex-shrink: 0;
  }

  .brand-title {
    font-size: 12px;
    font-weight: 600;
    color: #d6d3ce;
    letter-spacing: -0.01em;
  }

  .surface-tag {
    font-size: 9.5px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    background: #292724;
    color: #a8a29e;
    border: 1px solid #36332e;
  }

  .surface-tag.live {
    color: #95c95f;
    border-color: rgba(129, 182, 76, 0.32);
    background: rgba(129, 182, 76, 0.1);
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
    color: #9c968f;
    border-radius: 4px;
    height: 24px;
    min-width: 24px;
    padding: 0 5px;
    font-size: 10.5px;
    font-weight: 600;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease;
  }

  .icon-btn:hover {
    background: #2c2a26;
    color: #f5f5f4;
  }

  .icon-btn.active {
    color: #e59934;
    background: rgba(229, 153, 52, 0.12);
  }

  .lang-btn {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10px;
    color: #b8b2aa;
  }

  /* Critical / Abort Callout Bar (only shown on danger/banned) */
  .alert-banner {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.35;
    border-bottom: 1px solid #302e2a;
  }

  .alert-banner.banned,
  .alert-banner.abort-warn {
    background: rgba(224, 70, 68, 0.15);
    color: #fca5a5;
    border-bottom-color: rgba(224, 70, 68, 0.35);
  }

  /* Identity + Tabular Score Readout */
  .hero {
    padding: 11px 12px 10px;
    border-bottom: 1px solid #2e2c28;
  }

  .hero-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .identity {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    flex: 1;
  }

  .avatar {
    width: 34px;
    height: 34px;
    border-radius: 5px;
    object-fit: cover;
    border: 1px solid #3a3732;
    background: #2b2926;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: #d6d3ce;
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
    padding: 1px 4px;
    border-radius: 3px;
    background: #a62b28;
    color: #fff;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  .username-link {
    font-size: 13.5px;
    font-weight: 600;
    color: #f5f5f4;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .username-link:hover {
    text-decoration: underline;
  }

  .iso-tag {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 9.5px;
    font-weight: 600;
    color: #8c867e;
    background: #2a2825;
    padding: 0 4px;
    border-radius: 3px;
    border: 1px solid #36332e;
    flex-shrink: 0;
  }

  .sub-meta-row {
    margin-top: 2px;
    font-size: 11px;
    color: #9c968f;
    display: flex;
    align-items: center;
    gap: 5px;
    font-variant-numeric: tabular-nums;
  }

  .score-readout {
    text-align: right;
    flex-shrink: 0;
    padding-left: 8px;
    border-left: 2px solid var(--tier-color, #81b64c);
  }

  .score-num {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--tier-color, #81b64c);
    font-variant-numeric: tabular-nums;
  }

  .score-tier {
    margin-top: 3px;
    font-size: 10px;
    font-weight: 600;
    color: #d6d3ce;
  }

  /* Segmented Risk Meter */
  .meter-wrap {
    margin-top: 9px;
  }

  .meter-track {
    position: relative;
    height: 4px;
    background: #171614;
    border-radius: 2px;
    overflow: hidden;
  }

  .meter-fill {
    height: 100%;
    background: var(--tier-color, #81b64c);
    border-radius: 2px;
    transition: width 0.35s ease, background-color 0.25s ease;
  }

  .meter-ticks {
    position: relative;
    height: 0;
  }

  .verdict-line {
    margin-top: 7px;
    font-size: 11px;
    line-height: 1.38;
    color: #a8a29e;
  }

  .verdict-line.warn {
    color: #f3c37a;
  }

  .verdict-line.danger {
    color: #fca5a5;
    font-weight: 500;
  }

  /* 3-View Segmented Navigation */
  .view-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    padding: 5px 10px;
    background: #1b1a17;
    border-bottom: 1px solid #2e2c28;
    flex-shrink: 0;
  }

  .view-tab {
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    color: #9c968f;
    border-radius: 4px;
    padding: 4px 6px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    transition: background-color 0.12s ease, color 0.12s ease;
  }

  .view-tab:hover {
    color: #e7e5e4;
    background: #252320;
  }

  .view-tab.active {
    background: #2c2a26;
    color: #f5f5f4;
    border-color: #3d3a34;
  }

  .tab-count {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 9.5px;
    padding: 0 4px;
    border-radius: 3px;
    background: #191816;
    color: #a8a29e;
  }

  .tab-count.alert {
    background: rgba(224, 70, 68, 0.22);
    color: #fca5a5;
  }

  /* Tab Content Container */
  .tab-pane {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Speed Switcher */
  .format-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }

  .fmt-tab {
    appearance: none;
    border: 1px solid #302e2a;
    background: #1b1a17;
    color: #9c968f;
    border-radius: 4px;
    padding: 4px 7px;
    font-size: 10.5px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-transform: capitalize;
    transition: border-color 0.12s ease, color 0.12s ease, background-color 0.12s ease;
  }

  .fmt-tab:hover {
    border-color: #423f39;
    color: #e7e5e4;
  }

  .fmt-tab.active {
    background: #2a2824;
    border-color: #524e47;
    color: #f5f5f4;
  }

  .fmt-elo {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10.5px;
    color: #d6d3ce;
  }

  /* Hairline 3x2 Telemetry Grid */
  .metric-table {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1px;
    background: #302e2a;
    border: 1px solid #302e2a;
    border-radius: 5px;
    overflow: hidden;
  }

  .metric-cell {
    background: #21201d;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .metric-lbl {
    font-size: 10px;
    color: #8c867e;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .metric-val {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11.5px;
    font-weight: 600;
    color: #e7e5e4;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .metric-val.pos { color: #95c95f; }
  .metric-val.warn { color: #e59934; }
  .metric-val.neg { color: #ef6b68; }

  .metric-sub {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 10px;
    font-weight: 400;
    color: #8c867e;
  }

  /* Form Squares */
  .form-dots {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .form-dot {
    width: 6px;
    height: 6px;
    border-radius: 1.5px;
  }
  .form-dot.W { background: #81b64c; }
  .form-dot.L { background: #ca3431; }
  .form-dot.D { background: #78716c; }

  /* Findings List (Clean Dot-Prefixed Lines, Zero Rainbow Boxes) */
  .flags-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .flag-line {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    font-size: 11px;
    line-height: 1.35;
    color: #d6d3ce;
  }

  .flag-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    margin-top: 5px;
    flex-shrink: 0;
  }
  .flag-dot.danger { background: #e04644; }
  .flag-dot.warning { background: #e59934; }
  .flag-dot.info { background: #6ba4d9; }
  .flag-dot.positive { background: #81b64c; }

  /* Pinpointed Suspect Games */
  .pinpoint-panel {
    border: 1px solid rgba(224, 70, 68, 0.36);
    background: rgba(224, 70, 68, 0.07);
    border-radius: 5px;
    padding: 7px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sec-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    font-weight: 600;
    color: #a8a29e;
  }

  .pinpoint-panel .sec-head {
    color: #f89896;
  }

  .pinpoint-item {
    padding-top: 5px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pinpoint-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    font-weight: 600;
    color: #f5f5f4;
  }

  .pinpoint-open {
    font-size: 10px;
    font-weight: 600;
    color: #9c968f;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .pinpoint-open:hover {
    color: #f5f5f4;
  }

  .pinpoint-body {
    font-size: 10.5px;
    line-height: 1.32;
    color: #e7e5e4;
  }

  .pinpoint-san {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 9.5px;
    color: #9c968f;
  }

  /* Collapsible Signal Breakdown */
  .details-toggle {
    width: 100%;
    padding: 5px 8px;
    border-radius: 4px;
    border: 1px solid #302e2a;
    background: #1b1a17;
    color: #a8a29e;
    font-size: 10.5px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .details-toggle:hover {
    color: #e7e5e4;
    border-color: #3f3c36;
  }

  .signals-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 2px;
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
    font-size: 10.5px;
    color: #a8a29e;
  }

  .sig-score {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-weight: 600;
    color: #d6d3ce;
  }

  .sig-bar-bg {
    height: 3px;
    border-radius: 1.5px;
    background: #161513;
    overflow: hidden;
  }

  .sig-bar-fill {
    height: 100%;
    border-radius: 1.5px;
    transition: width 0.35s ease;
  }

  /* Clock & Histogram Panels */
  .chart-box {
    border: 1px solid #302e2a;
    background: #1b1a17;
    border-radius: 5px;
    padding: 8px 9px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .chart-box.suspect {
    border-color: rgba(224, 70, 68, 0.44);
  }

  .empty-note {
    font-size: 11px;
    color: #8c867e;
    padding: 8px 2px;
    line-height: 1.4;
  }

  .live-spark-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 44px;
    padding-top: 4px;
  }

  .live-spark-item {
    flex: 1;
    min-width: 6px;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
  }

  .live-spark-col {
    width: 100%;
    border-radius: 1.5px 1.5px 0 0;
    min-height: 3px;
  }

  .live-spark-num {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 8px;
    color: #78716c;
    line-height: 1;
  }

  .live-spark-num.suspect {
    color: #fca5a5;
    font-weight: 700;
  }

  .live-spark-num.pause {
    color: #e59934;
    font-weight: 700;
  }

  .move-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  .move-chip {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 9.5px;
    padding: 1px 5px;
    border-radius: 3px;
    background: #252320;
    color: #b8b2aa;
    border: 1px solid #33302b;
  }

  .move-chip.suspect {
    border-color: rgba(224, 70, 68, 0.45);
    color: #fca5a5;
  }

  .live-suspect-msg {
    font-size: 10.5px;
    color: #fca5a5;
    line-height: 1.35;
  }

  .hist-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    align-items: end;
    height: 46px;
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
    border-radius: 1.5px 1.5px 0 0;
    min-height: 2px;
  }

  .hist-lbl {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 8px;
    color: #78716c;
  }

  /* Recent Games List + Expandable Per-Game Sparkline */
  .matches-list {
    display: flex;
    flex-direction: column;
    border: 1px solid #302e2a;
    border-radius: 5px;
    overflow: hidden;
    background: #1b1a17;
  }

  .match-block {
    border-bottom: 1px solid #2a2824;
  }

  .match-block:last-child {
    border-bottom: none;
  }

  .match-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    gap: 6px;
    font-size: 11px;
    color: #e7e5e4;
  }

  .match-row:hover {
    background: #24221f;
  }

  .match-left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  .match-res {
    width: 15px;
    height: 15px;
    border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 9.5px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .match-res.W { background: rgba(129, 182, 76, 0.2); color: #95c95f; }
  .match-res.L { background: rgba(202, 52, 49, 0.2); color: #ef6b68; }
  .match-res.D { background: rgba(140, 134, 126, 0.2); color: #b8b2aa; }

  .match-opp {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
    color: #d6d3ce;
  }

  .match-opp-elo {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10px;
    color: #8c867e;
  }

  .match-right {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10px;
    color: #9c968f;
    flex-shrink: 0;
  }

  .match-acc {
    padding: 1px 4px;
    border-radius: 3px;
    background: #292723;
    color: #d6d3ce;
  }

  .match-acc.high {
    background: rgba(224, 70, 68, 0.18);
    color: #fca5a5;
  }

  .match-pin-tag {
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 9px;
    background: rgba(224, 70, 68, 0.18);
    color: #fca5a5;
  }

  .mini-link-btn {
    appearance: none;
    border: 1px solid #34312c;
    background: #252320;
    color: #a8a29e;
    border-radius: 3px;
    height: 19px;
    padding: 0 5px;
    font-size: 9.5px;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    text-decoration: none;
  }

  .mini-link-btn:hover {
    color: #f5f5f4;
    border-color: #4a463f;
  }

  .mini-link-btn.active {
    background: #302d28;
    color: #f5f5f4;
  }

  .match-drawer {
    padding: 6px 8px 8px;
    background: #171614;
    border-top: 1px solid #262420;
  }

  .drawer-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 28px;
  }

  .drawer-bar {
    flex: 1;
    min-width: 3px;
    border-radius: 1px 1px 0 0;
    background: #6ba4d9;
  }

  /* Footer Bar */
  .hud-footer {
    height: 34px;
    padding: 0 10px;
    background: #1a1917;
    border-top: 1px solid #302e2a;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-shrink: 0;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .footer-btn {
    appearance: none;
    border: 1px solid #36332e;
    background: #252320;
    color: #d6d3ce;
    border-radius: 4px;
    height: 23px;
    padding: 0 8px;
    font-size: 10.5px;
    font-weight: 600;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    text-decoration: none;
    transition: background-color 0.12s ease, border-color 0.12s ease;
  }

  .footer-btn:hover {
    background: #2e2c28;
    border-color: #4a463f;
    color: #fff;
  }

  .footer-btn.copied {
    border-color: rgba(129, 182, 76, 0.5);
    color: #95c95f;
  }

  .footer-btn.report-warn {
    border-color: rgba(224, 108, 53, 0.45);
    color: #f3a982;
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .kbd-hint {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 9.5px;
    color: #6e6962;
  }

  /* Loading State */
  .loading-box {
    padding: 18px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid #36332e;
    border-top-color: #81b64c;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-text {
    font-size: 12px;
    color: #e7e5e4;
    font-weight: 600;
  }

  .loading-sub {
    font-size: 11px;
    color: #8c867e;
    margin-top: 1px;
  }

  /* Minimized Compact Tag */
  .minimized-pill {
    pointer-events: auto;
    position: fixed;
    top: 64px;
    right: 16px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 10px;
    border-radius: 6px;
    background: #21201d;
    border: 1px solid #3a3732;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.48);
    cursor: pointer;
    user-select: none;
    transition: background-color 0.12s ease;
  }

  .minimized-pill:hover {
    background: #292724;
  }

  .minimized-pill.hidden {
    display: none;
  }

  .min-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--tier-color, #81b64c);
  }

  .min-pct {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    font-weight: 700;
    color: var(--tier-color, #81b64c);
    font-variant-numeric: tabular-nums;
  }

  .min-user {
    font-size: 11.5px;
    font-weight: 600;
    color: #d6d3ce;
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
