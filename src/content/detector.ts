import { TimeClass } from '../types';

export interface DetectedMatchContext {
  topPlayer: string | null;
  bottomPlayer: string | null;
  opponent: string;
  detectedFormat: TimeClass | undefined;
  isAbortWindowOpen: boolean;
  url: string;
}

const INVALID_NAMES = new Set([
  'opponent',
  'rakip',
  'player',
  'oyuncu',
  'anonymous',
  'anonim',
  'searching',
  'searching...',
  'aranıyor',
  'aranıyor...',
  'waiting',
  'computer',
  'chess.com',
  'guest',
  'member',
]);

// Chess.com usernames are 3-25 chars: letters, digits, underscores, hyphens
const VALID_USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,25}$/;

export function sanitizeChessUsername(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Strip rating suffix or title tokens if accidentally captured
  const cleaned = raw
    .replace(/\(?\d{3,4}\)?/g, ' ')
    .replace(/\b(GM|WGM|IM|WIM|FM|WFM|NM|WNM|CM|WCM)\b/g, ' ')
    .trim()
    .split(/\s+/)[0]
    ?.trim();

  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (INVALID_NAMES.has(lower)) return null;
  if (lower.startsWith('guest') && /^guest\d+$/i.test(lower)) return null;
  if (!VALID_USERNAME_REGEX.test(cleaned)) return null;
  return cleaned;
}

export function isChessComBoardUrl(url: string): boolean {
  return /chess\.com\/(game|play\/online|live|analysis\/game|events)/i.test(url);
}

/**
 * Resiliently monitors Chess.com's 2026 SPA DOM (including Web Components & Shadow Roots)
 * to detect the opponent username, board orientation, active speed format, and abort window.
 */
export class ChessComOpponentDetector {
  private onContextChange: (ctx: DetectedMatchContext) => void;
  private onMatchLeft: () => void;
  private observer: MutationObserver | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSignature = '';
  private lastUrl = '';
  private active = false;

  constructor(
    onContextChange: (ctx: DetectedMatchContext) => void,
    onMatchLeft: () => void
  ) {
    this.onContextChange = onContextChange;
    this.onMatchLeft = onMatchLeft;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.lastUrl = window.location.href;

    this.observer = new MutationObserver(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.evaluateDom(), 220);
    });

    if (document.body) {
      this.observer.observe(document.body, { childList: true, subtree: true });
    }

    this.pollTimer = setInterval(() => {
      if (!this.active) return;
      if (window.location.href !== this.lastUrl) {
        this.lastUrl = window.location.href;
        this.lastSignature = '';
      }
      this.evaluateDom();
    }, 650);

    setTimeout(() => this.evaluateDom(), 150);
  }

  stop(): void {
    this.active = false;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  forceRecheck(): void {
    this.lastSignature = '';
    this.evaluateDom();
  }

  private hasBoardOnPage(): boolean {
    if (isChessComBoardUrl(window.location.href)) return true;
    return !!document.querySelector(
      'wc-chess-board, chess-board, #board-layout-main, .board-layout-main, #board-layout-player-top, .board-layout-top'
    );
  }

  private extractNameFromElement(el: Element | null): string | null {
    if (!el) return null;

    // 1. Check ShadowRoot first (Chess.com Web Components)
    if (el.shadowRoot) {
      const shadowLink = el.shadowRoot.querySelector('a[href*="/member/"]');
      if (shadowLink) {
        const m = (shadowLink.getAttribute('href') || '').match(/\/member\/([^/?#]+)/i);
        const s = sanitizeChessUsername(m?.[1]);
        if (s) return s;
      }
      const shadowUser = el.shadowRoot.querySelector(
        '[data-test-element="user-tagline-username"], [class*="username"]'
      );
      if (shadowUser) {
        const s = sanitizeChessUsername(shadowUser.textContent);
        if (s) return s;
      }
    }

    // 2. Direct anchor href `/member/{username}`
    if (el.tagName === 'A') {
      const m = (el.getAttribute('href') || '').match(/\/member\/([^/?#]+)/i);
      const s = sanitizeChessUsername(m?.[1]);
      if (s) return s;
    }

    const nestedMemberLink = el.querySelector('a[href*="/member/"]');
    if (nestedMemberLink) {
      const m = (nestedMemberLink.getAttribute('href') || '').match(/\/member\/([^/?#]+)/i);
      const s = sanitizeChessUsername(m?.[1]);
      if (s) return s;
    }

    // 3. Data attributes
    const attrName =
      el.getAttribute('username') ||
      el.getAttribute('data-username') ||
      el.getAttribute('data-player-username');
    if (attrName) {
      const s = sanitizeChessUsername(attrName);
      if (s) return s;
    }

    // 4. Nested username nodes
    const nestedUser = el.querySelector(
      '[data-test-element="user-tagline-username"], .cc-user-username-component, .user-tagline-username, .user-tagline-compact-username, [class*="username"]'
    );
    if (nestedUser) {
      const s = sanitizeChessUsername(nestedUser.textContent);
      if (s) return s;
    }

    // 5. Fallback direct textContent
    return sanitizeChessUsername(el.textContent);
  }

  private extractZonePlayer(zoneSelector: string): string | null {
    const zone = document.querySelector(zoneSelector);
    if (!zone) return null;

    const candidateSelectors = [
      'cc-user-username-component',
      '[data-test-element="user-tagline-username"]',
      '.cc-user-username-component',
      '.user-tagline-username',
      '.user-tagline-compact-username',
      'a[href*="/member/"]',
      '[class*="username"]',
    ];

    for (const sel of candidateSelectors) {
      const el = zone.querySelector(sel);
      const name = this.extractNameFromElement(el);
      if (name) return name;
    }
    return null;
  }

  extractPlayers(): { topPlayer: string | null; bottomPlayer: string | null } {
    let topPlayer =
      this.extractZonePlayer('#board-layout-player-top') ||
      this.extractZonePlayer('#board-layout-top') ||
      this.extractZonePlayer('.board-layout-player-top') ||
      this.extractZonePlayer('.board-layout-top');

    let bottomPlayer =
      this.extractZonePlayer('#board-layout-player-bottom') ||
      this.extractZonePlayer('#board-layout-bottom') ||
      this.extractZonePlayer('.board-layout-player-bottom') ||
      this.extractZonePlayer('.board-layout-bottom');

    // Fallback: Geometric Y-coordinate sorting across all player tagline components on the board
    if (!topPlayer || !bottomPlayer) {
      const candidates = Array.from(
        document.querySelectorAll(
          'cc-user-username-component, [data-test-element="user-tagline-username"], .user-tagline-username, .user-tagline-compact-username'
        )
      )
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 10 && rect.height > 6 && rect.top >= 0 && rect.top < window.innerHeight;
        })
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

      const names: string[] = [];
      for (const el of candidates) {
        const n = this.extractNameFromElement(el);
        if (n && !names.some((existing) => existing.toLowerCase() === n.toLowerCase())) {
          names.push(n);
        }
      }

      if (!topPlayer && names.length >= 1) topPlayer = names[0];
      if (!bottomPlayer && names.length >= 2) bottomPlayer = names[names.length - 1];
    }

    return { topPlayer, bottomPlayer };
  }

  private detectActiveFormat(): TimeClass | undefined {
    const url = window.location.href.toLowerCase();
    if (url.includes('/daily/')) return 'daily';

    // Check glyph icons or time control labels
    const glyphSelectors = [
      '[data-glyph*="bullet"]',
      '.icon-font-chess.bullet',
      '[class*="time-selector"] [class*="bullet"]',
    ];
    for (const s of glyphSelectors) {
      if (document.querySelector(s)) return 'bullet';
    }
    if (
      document.querySelector(
        '[data-glyph*="blitz"], .icon-font-chess.blitz, [data-glyph*="lightning"]'
      )
    ) {
      return 'blitz';
    }
    if (document.querySelector('[data-glyph*="rapid"], .icon-font-chess.rapid')) {
      return 'rapid';
    }

    // Fallback: inspect initial clock text if game just started
    const clockEl = document.querySelector(
      '#board-layout-player-top .clock-time-monospace, .board-layout-top .clock-time-monospace, .clock-component'
    );
    if (clockEl) {
      const txt = (clockEl.textContent || '').trim();
      const m = txt.match(/^(\d+):(\d{2})/);
      if (m) {
        const mins = Number(m[1]);
        if (mins < 3) return 'bullet';
        if (mins < 10) return 'blitz';
        return 'rapid';
      }
    }

    return undefined;
  }

  private detectAbortWindow(): boolean {
    const plies = document.querySelectorAll(
      'wc-simple-move-list [data-ply], .move-list [data-ply], .vertical-move-list .node, .main-line-row'
    );
    if (plies.length <= 1) {
      // Also confirm live clock exists so static analysis pages don't show abort banner forever
      const hasLiveClock = !!document.querySelector('.clock-component, .clock-time-monospace');
      return hasLiveClock;
    }
    return false;
  }

  private evaluateDom(): void {
    if (!this.hasBoardOnPage()) {
      if (this.lastSignature !== '') {
        this.lastSignature = '';
        this.onMatchLeft();
      }
      return;
    }

    const { topPlayer, bottomPlayer } = this.extractPlayers();
    const opponent = topPlayer;
    if (!opponent) return;

    const detectedFormat = this.detectActiveFormat();
    const isAbortWindowOpen = this.detectAbortWindow();

    const sig = `${opponent.toLowerCase()}|${(bottomPlayer || '').toLowerCase()}|${isAbortWindowOpen ? '1' : '0'}`;
    if (sig === this.lastSignature) return;

    this.lastSignature = sig;
    this.onContextChange({
      topPlayer,
      bottomPlayer,
      opponent,
      detectedFormat,
      isAbortWindowOpen,
      url: window.location.href,
    });
  }
}
