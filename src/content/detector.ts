import { PageSurfaceKind, TimeClass } from '../types';

export interface DetectedMatchContext {
  topPlayer: string | null;
  bottomPlayer: string | null;
  opponent: string;
  opponentSide: 'top' | 'bottom';
  detectedFormat: TimeClass | undefined;
  isAbortWindowOpen: boolean;
  surface: PageSurfaceKind;
  gameId: string | null;
  isSelfProfile?: boolean;
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

const FIDE_TITLES = new Set([
  'GM',
  'WGM',
  'IM',
  'WIM',
  'FM',
  'WFM',
  'NM',
  'WNM',
  'CM',
  'WCM',
  'AGM',
  'AIM',
  'AFM',
  'ACM',
]);

// Chess.com usernames: 2-32 chars, letters, digits (start/middle/end/all-numeric), underscores, hyphens
const VALID_USERNAME_REGEX = /^[a-zA-Z0-9_-]{2,32}$/;

/**
 * Losslessly sanitizes a raw username string extracted from Chess.com DOM.
 * Preserves ALL digits inside usernames (e.g. `kaan1907`, `1905gs`, `007bond`, `ali2`, `123456`)
 * while stripping only parenthesized ratings like `(1540)` and standalone FIDE title prefixes.
 */
export function sanitizeChessUsername(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const withoutParensAndInvisible = raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Strip ONLY ratings enclosed in actual parentheses e.g. `(1642)` — never bare digits!
    .replace(/\(\s*\d{2,5}\s*\)/g, ' ')
    .trim();

  if (!withoutParensAndInvisible) return null;

  const tokens = withoutParensAndInvisible.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // Only strip a leading FIDE title token if there is another token after it (e.g. "GM Hikaru123")
  if (tokens.length > 1 && FIDE_TITLES.has(tokens[0].toUpperCase())) {
    tokens.shift();
  }

  const candidate = tokens[0]?.trim();
  if (!candidate) return null;

  const lower = candidate.toLowerCase();
  if (INVALID_NAMES.has(lower)) return null;
  if (lower.startsWith('guest') && /^guest\d+$/i.test(lower)) return null;
  if (!VALID_USERNAME_REGEX.test(candidate)) return null;

  return candidate;
}

export function isChessComBoardUrl(url: string): boolean {
  return /chess\.com\/(?:[a-z]{2}\/)?(game|play\/online|live|analysis\/game|events)/i.test(url);
}

export function extractGameIdFromUrl(url: string): string | null {
  const m =
    url.match(/\/(?:analysis\/)?game\/(?:live|daily)?\/?(\d{6,16})/i) ||
    url.match(/[?#&]g=(\d{6,16})/i);
  return m?.[1] || null;
}

export function extractMemberProfileFromUrl(url: string): string | null {
  const m = url.match(/chess\.com\/(?:[a-z]{2}\/)?member\/([a-zA-Z0-9_-]{2,32})(?:[/?#]|$)/i);
  if (!m?.[1]) return null;
  return sanitizeChessUsername(m[1]);
}

const TOP_ZONE_SELECTORS = [
  '#board-layout-player-top',
  '#board-layout-top',
  '.board-layout-player-top',
  '.board-layout-top',
  '.player-component.player-top',
  '.player-top',
  '#top-player',
  '#topPlayer',
];

const BOTTOM_ZONE_SELECTORS = [
  '#board-layout-player-bottom',
  '#board-layout-bottom',
  '.board-layout-player-bottom',
  '.board-layout-bottom',
  '.player-component.player-bottom',
  '.player-bottom',
  '#bottom-player',
  '#bottomPlayer',
];

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
    }, 600);

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
      'wc-chess-board, chess-board, #board-layout-main, .board-layout-main, #board-layout-player-top, .board-layout-top, .player-component.player-top'
    );
  }

  getLoggedInUsername(): string | null {
    const notif = document.getElementById('notifications-request');
    const fromNotif = sanitizeChessUsername(notif?.getAttribute('username'));
    if (fromNotif) return fromNotif;

    const profileNav = document.querySelector(
      'a[data-nav-link="profile"][href*="/member/"], .nav-link-profile[href*="/member/"]'
    );
    if (profileNav) {
      const m = (profileNav.getAttribute('href') || '').match(/\/member\/([^/?#]+)/i);
      if (m?.[1]) {
        const s = sanitizeChessUsername(decodeURIComponent(m[1]));
        if (s) return s;
      }
    }
    return null;
  }

  private extractCleanTextWithoutDecorations(root: Element | ShadowRoot): string {
    if (root instanceof Element) {
      const clone = root.cloneNode(true) as Element;
      clone
        .querySelectorAll(
          '.chess-sentinel-inline-pill, [class*="rating"], [class*="title"], [class*="flair"], [class*="country"], [class*="clock"]'
        )
        .forEach((n) => n.remove());
      return clone.textContent || '';
    }
    return root.textContent || '';
  }

  private extractUsernameFromHref(href: string | null): string | null {
    if (!href) return null;
    const m = href.match(/\/member\/([^/?#]+)/i);
    if (!m?.[1]) return null;
    try {
      return sanitizeChessUsername(decodeURIComponent(m[1]));
    } catch {
      return sanitizeChessUsername(m[1]);
    }
  }

  private extractNameFromElement(el: Element | null): string | null {
    if (!el) return null;

    // 1. Direct data attributes (canonical & unaffected by inner badges)
    const attrName =
      el.getAttribute('username') ||
      el.getAttribute('data-username') ||
      el.getAttribute('data-player-username');
    if (attrName) {
      const s = sanitizeChessUsername(attrName);
      if (s) return s;
    }

    // 2. Direct anchor href `/member/{username}`
    if (el.tagName === 'A') {
      const s = this.extractUsernameFromHref(el.getAttribute('href'));
      if (s) return s;
    }

    const nestedMemberLink = el.querySelector('a[href*="/member/"]');
    if (nestedMemberLink) {
      const s = this.extractUsernameFromHref(nestedMemberLink.getAttribute('href'));
      if (s) return s;
    }

    // 3. ShadowRoot inspection for Chess.com Web Components (`cc-user-username-component`)
    if (el.shadowRoot) {
      const shadowLink = el.shadowRoot.querySelector('a[href*="/member/"]');
      if (shadowLink) {
        const s = this.extractUsernameFromHref(shadowLink.getAttribute('href'));
        if (s) return s;
      }
      const shadowUser = el.shadowRoot.querySelector(
        '[data-test-element="user-tagline-username"], .cc-user-username-component, [class*="username"]:not([class*="rating"]):not([class*="title"])'
      );
      if (shadowUser) {
        const s = sanitizeChessUsername(this.extractCleanTextWithoutDecorations(shadowUser));
        if (s) return s;
      }
      const sRoot = sanitizeChessUsername(this.extractCleanTextWithoutDecorations(el.shadowRoot));
      if (sRoot) return sRoot;
    }

    // 4. Specific nested username nodes
    const nestedUser = el.querySelector(
      '[data-test-element="user-tagline-username"], .cc-user-username-component, .user-tagline-username, .user-tagline-compact-username, [class*="username"]:not([class*="rating"]):not([class*="title"])'
    );
    if (nestedUser) {
      const s = sanitizeChessUsername(this.extractCleanTextWithoutDecorations(nestedUser));
      if (s) return s;
    }

    // 5. Clean text of element itself (with ratings/titles/inline-badges stripped)
    return sanitizeChessUsername(this.extractCleanTextWithoutDecorations(el));
  }

  private extractZonePlayer(zoneSelectors: string[]): string | null {
    for (const zSel of zoneSelectors) {
      const zone = document.querySelector(zSel);
      if (!zone) continue;

      const candidateSelectors = [
        'a[href*="/member/"]',
        'cc-user-username-component',
        '[data-test-element="user-tagline-username"]',
        '.cc-user-username-component',
        '.user-username-component.user-tagline-username',
        '.user-tagline-username',
        '.user-tagline-compact-username',
        '[data-username]',
        '[data-player-username]',
        '[class*="username"]:not([class*="rating"]):not([class*="title"])',
      ];

      for (const sel of candidateSelectors) {
        const els = zone.querySelectorAll(sel);
        for (const el of Array.from(els)) {
          if (el.closest('.chess-sentinel-inline-pill')) continue;
          const name = this.extractNameFromElement(el);
          if (name) return name;
        }
      }
    }
    return null;
  }

  extractPlayers(): { topPlayer: string | null; bottomPlayer: string | null } {
    let topPlayer = this.extractZonePlayer(TOP_ZONE_SELECTORS);
    let bottomPlayer = this.extractZonePlayer(BOTTOM_ZONE_SELECTORS);

    // Fallback: Geometric Y-coordinate sorting across all player tagline components on the board
    if (!topPlayer || !bottomPlayer) {
      const candidates = Array.from(
        document.querySelectorAll(
          'cc-user-username-component, [data-test-element="user-tagline-username"], .cc-user-username-component, .user-tagline-username, .user-tagline-compact-username'
        )
      )
        .filter((el) => {
          if (el.closest('.chess-sentinel-inline-pill')) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 8 && rect.height > 6 && rect.top >= 0 && rect.top < window.innerHeight;
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

    const clockEl = document.querySelector(
      '#board-layout-player-top .clock-time-monospace, .board-layout-top .clock-time-monospace, .player-top .clock-time-monospace, .clock-component'
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
      const hasLiveClock = !!document.querySelector('.clock-component, .clock-time-monospace');
      return hasLiveClock;
    }
    return false;
  }

  private evaluateDom(): void {
    const currentUrl = window.location.href;
    const gameId = extractGameIdFromUrl(currentUrl);
    const memberProfile = !this.hasBoardOnPage() ? extractMemberProfileFromUrl(currentUrl) : null;

    if (!this.hasBoardOnPage() && !memberProfile) {
      if (this.lastSignature !== '') {
        this.lastSignature = '';
        this.onMatchLeft();
      }
      return;
    }

    const loggedIn = this.getLoggedInUsername()?.toLowerCase();

    if (memberProfile && !this.hasBoardOnPage()) {
      const isSelfProfile = Boolean(loggedIn && memberProfile.toLowerCase() === loggedIn);
      const sig = `profile|${memberProfile.toLowerCase()}|${isSelfProfile ? '1' : '0'}`;
      if (sig === this.lastSignature) return;
      this.lastSignature = sig;
      this.onContextChange({
        topPlayer: memberProfile,
        bottomPlayer: loggedIn || null,
        opponent: memberProfile,
        opponentSide: 'top',
        detectedFormat: undefined,
        isAbortWindowOpen: false,
        surface: 'profile',
        gameId: null,
        isSelfProfile,
        url: currentUrl,
      });
      return;
    }

    const { topPlayer, bottomPlayer } = this.extractPlayers();

    // Smart orientation resolution: if the user flipped the board so their own name is on top,
    // automatically target the actual opponent on the bottom!
    let opponent = topPlayer;
    let opponentSide: 'top' | 'bottom' = 'top';

    if (
      loggedIn &&
      topPlayer &&
      bottomPlayer &&
      topPlayer.toLowerCase() === loggedIn &&
      bottomPlayer.toLowerCase() !== loggedIn
    ) {
      opponent = bottomPlayer;
      opponentSide = 'bottom';
    }

    if (!opponent) return;

    const detectedFormat = this.detectActiveFormat();
    const isAbortWindowOpen = this.detectAbortWindow();
    const hasActiveClock = !!document.querySelector(
      '.clock-player-turn, [class*="clock-player-turn"]'
    );
    const surface: PageSurfaceKind =
      hasActiveClock || /\/play\/online|\/live/i.test(currentUrl) ? 'live' : 'game';

    const sig = `${surface}|${opponent.toLowerCase()}|${opponentSide}|${(bottomPlayer || '').toLowerCase()}|${isAbortWindowOpen ? '1' : '0'}|${gameId || ''}`;
    if (sig === this.lastSignature) return;

    this.lastSignature = sig;
    this.onContextChange({
      topPlayer,
      bottomPlayer,
      opponent,
      opponentSide,
      detectedFormat,
      isAbortWindowOpen,
      surface,
      gameId,
      url: currentUrl,
    });
  }
}
