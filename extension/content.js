"use strict";
(() => {
  // src/core/calibration.ts
  var CAPS2_ACCURACY_BANDS = {
    bullet: [
      { maxRating: 800, expected: 69, ceiling: 80 },
      { maxRating: 1100, expected: 74, ceiling: 84 },
      { maxRating: 1400, expected: 77, ceiling: 86 },
      { maxRating: 1700, expected: 80, ceiling: 88 },
      { maxRating: 2e3, expected: 82.5, ceiling: 90 },
      { maxRating: 2400, expected: 85.5, ceiling: 92 },
      { maxRating: Infinity, expected: 88.5, ceiling: 94.5 }
    ],
    blitz: [
      { maxRating: 800, expected: 70, ceiling: 80 },
      { maxRating: 1100, expected: 75, ceiling: 84 },
      { maxRating: 1400, expected: 78.5, ceiling: 87 },
      { maxRating: 1700, expected: 81, ceiling: 89 },
      { maxRating: 2e3, expected: 83.5, ceiling: 90.5 },
      { maxRating: 2400, expected: 86.5, ceiling: 92.5 },
      { maxRating: Infinity, expected: 89.5, ceiling: 95 }
    ],
    rapid: [
      { maxRating: 800, expected: 71, ceiling: 81 },
      { maxRating: 1100, expected: 76, ceiling: 85 },
      { maxRating: 1400, expected: 79.5, ceiling: 88 },
      { maxRating: 1700, expected: 82, ceiling: 90 },
      { maxRating: 2e3, expected: 84.5, ceiling: 91.5 },
      { maxRating: Infinity, expected: 84.5, ceiling: 91.5 }
    ].slice(0, 5).concat([
      { maxRating: 2400, expected: 88, ceiling: 93.5 },
      { maxRating: Infinity, expected: 91, ceiling: 96 }
    ]),
    daily: [
      { maxRating: 1200, expected: 78, ceiling: 88 },
      { maxRating: 1800, expected: 84, ceiling: 92 },
      { maxRating: 2400, expected: 89, ceiling: 95 },
      { maxRating: Infinity, expected: 92, ceiling: 97 }
    ]
  };
  var TIER_THEMES = {
    low: {
      id: "low",
      color: "#34d399",
      rgb: "52, 211, 153",
      accentBg: "rgba(52, 211, 153, 0.11)",
      glow: "rgba(52, 211, 153, 0.16)",
      border: "rgba(52, 211, 153, 0.28)"
    },
    guarded: {
      id: "guarded",
      color: "#60a5fa",
      rgb: "96, 165, 250",
      accentBg: "rgba(96, 165, 250, 0.11)",
      glow: "rgba(96, 165, 250, 0.16)",
      border: "rgba(96, 165, 250, 0.28)"
    },
    elevated: {
      id: "elevated",
      color: "#fbbf24",
      rgb: "251, 191, 36",
      accentBg: "rgba(251, 191, 36, 0.12)",
      glow: "rgba(251, 191, 36, 0.18)",
      border: "rgba(251, 191, 36, 0.32)"
    },
    high: {
      id: "high",
      color: "#fb923c",
      rgb: "251, 146, 60",
      accentBg: "rgba(251, 146, 60, 0.13)",
      glow: "rgba(251, 146, 60, 0.20)",
      border: "rgba(251, 146, 60, 0.36)"
    },
    critical: {
      id: "critical",
      color: "#f43f5e",
      rgb: "244, 63, 94",
      accentBg: "rgba(244, 63, 94, 0.14)",
      glow: "rgba(244, 63, 94, 0.22)",
      border: "rgba(244, 63, 94, 0.42)"
    },
    banned: {
      id: "banned",
      color: "#f43f5e",
      rgb: "244, 63, 94",
      accentBg: "rgba(244, 63, 94, 0.18)",
      glow: "rgba(244, 63, 94, 0.26)",
      border: "rgba(244, 63, 94, 0.52)"
    }
  };
  function probabilityToTier(probability, isBanned = false) {
    if (isBanned) return "banned";
    if (probability < 30) return "low";
    if (probability < 55) return "guarded";
    if (probability < 75) return "elevated";
    if (probability < 90) return "high";
    return "critical";
  }
  var DEFAULT_SETTINGS = {
    language: "tr",
    autoShowHud: true,
    compactMode: false,
    showInlineBadge: true,
    ratedOnly: true,
    soundAlerts: true,
    sensitivity: "balanced",
    hudPosition: null
  };
  var LIVE_FORMATS = ["rapid", "blitz", "bullet"];

  // src/storage/store.ts
  var KEYS = {
    SETTINGS: "sentinel_settings_v1",
    WATCHLIST: "sentinel_watchlist_v1",
    RECENT_SCANS: "sentinel_recent_scans_v1"
  };
  function hasChromeStorage() {
    return typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.local;
  }
  async function getSettings() {
    if (!hasChromeStorage()) return { ...DEFAULT_SETTINGS };
    try {
      const res = await chrome.storage.local.get(KEYS.SETTINGS);
      return { ...DEFAULT_SETTINGS, ...res[KEYS.SETTINGS] || {} };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  async function updateSettings(patch) {
    const current = await getSettings();
    const next = { ...current, ...patch };
    if (hasChromeStorage()) {
      try {
        await chrome.storage.local.set({ [KEYS.SETTINGS]: next });
      } catch {
      }
    }
    return next;
  }
  async function getWatchlist() {
    if (!hasChromeStorage()) return [];
    try {
      const res = await chrome.storage.local.get(KEYS.WATCHLIST);
      return Array.isArray(res[KEYS.WATCHLIST]) ? res[KEYS.WATCHLIST] : [];
    } catch {
      return [];
    }
  }

  // src/utils/safe-dom.ts
  function escapeHtml(raw) {
    return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function setSafeHtml(target, html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<!DOCTYPE html><html><body>${html}</body></html>`, "text/html");
    const nodes = Array.from(doc.body.childNodes).map((node) => document.importNode(node, true));
    target.replaceChildren(...nodes);
  }
  function playRiskAlertChime(isCritical) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => {
        });
      }
      const now = ctx.currentTime;
      const freqs = isCritical ? [587.33, 880, 1174.66] : [523.25, 659.25];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = isCritical ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);
        gain.gain.setValueAtTime(1e-4, now + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.075, now + idx * 0.11 + 0.02);
        gain.gain.exponentialRampToValueAtTime(1e-4, now + idx * 0.11 + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.17);
      });
      setTimeout(() => {
        void ctx.close().catch(() => {
        });
      }, 800);
    } catch {
    }
  }

  // src/content/detector.ts
  var INVALID_NAMES = /* @__PURE__ */ new Set([
    "opponent",
    "rakip",
    "player",
    "oyuncu",
    "anonymous",
    "anonim",
    "searching",
    "searching...",
    "aran\u0131yor",
    "aran\u0131yor...",
    "waiting",
    "computer",
    "chess.com",
    "guest",
    "member"
  ]);
  var FIDE_TITLES = /* @__PURE__ */ new Set([
    "GM",
    "WGM",
    "IM",
    "WIM",
    "FM",
    "WFM",
    "NM",
    "WNM",
    "CM",
    "WCM",
    "AGM",
    "AIM",
    "AFM",
    "ACM"
  ]);
  var VALID_USERNAME_REGEX = /^[a-zA-Z0-9_-]{2,32}$/;
  function sanitizeChessUsername(raw) {
    if (!raw) return null;
    const withoutParensAndInvisible = raw.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\(\s*\d{2,5}\s*\)/g, " ").trim();
    if (!withoutParensAndInvisible) return null;
    const tokens = withoutParensAndInvisible.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;
    if (tokens.length > 1 && FIDE_TITLES.has(tokens[0].toUpperCase())) {
      tokens.shift();
    }
    const candidate = tokens[0]?.trim();
    if (!candidate) return null;
    const lower = candidate.toLowerCase();
    if (INVALID_NAMES.has(lower)) return null;
    if (lower.startsWith("guest") && /^guest\d+$/i.test(lower)) return null;
    if (!VALID_USERNAME_REGEX.test(candidate)) return null;
    return candidate;
  }
  function isChessComBoardUrl(url) {
    return /chess\.com\/(?:[a-z]{2}\/)?(game|play\/online|live|analysis\/game|events)/i.test(url);
  }
  function extractGameIdFromUrl(url) {
    const m = url.match(/\/(?:analysis\/)?game\/(?:live|daily)?\/?(\d{6,16})/i) || url.match(/[?#&]g=(\d{6,16})/i);
    return m?.[1] || null;
  }
  function extractMemberProfileFromUrl(url) {
    const m = url.match(/chess\.com\/(?:[a-z]{2}\/)?member\/([a-zA-Z0-9_-]{2,32})(?:[/?#]|$)/i);
    if (!m?.[1]) return null;
    return sanitizeChessUsername(m[1]);
  }
  var TOP_ZONE_SELECTORS = [
    "#board-layout-player-top",
    "#board-layout-top",
    ".board-layout-player-top",
    ".board-layout-top",
    ".player-component.player-top",
    ".player-top",
    "#top-player",
    "#topPlayer"
  ];
  var BOTTOM_ZONE_SELECTORS = [
    "#board-layout-player-bottom",
    "#board-layout-bottom",
    ".board-layout-player-bottom",
    ".board-layout-bottom",
    ".player-component.player-bottom",
    ".player-bottom",
    "#bottom-player",
    "#bottomPlayer"
  ];
  var ChessComOpponentDetector = class {
    onContextChange;
    onMatchLeft;
    observer = null;
    pollTimer = null;
    debounceTimer = null;
    lastSignature = "";
    lastUrl = "";
    active = false;
    constructor(onContextChange, onMatchLeft) {
      this.onContextChange = onContextChange;
      this.onMatchLeft = onMatchLeft;
    }
    start() {
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
          this.lastSignature = "";
        }
        this.evaluateDom();
      }, 600);
      setTimeout(() => this.evaluateDom(), 150);
    }
    stop() {
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
    forceRecheck() {
      this.lastSignature = "";
      this.evaluateDom();
    }
    hasBoardOnPage() {
      if (isChessComBoardUrl(window.location.href)) return true;
      return !!document.querySelector(
        "wc-chess-board, chess-board, #board-layout-main, .board-layout-main, #board-layout-player-top, .board-layout-top, .player-component.player-top"
      );
    }
    getLoggedInUsername() {
      const notif = document.getElementById("notifications-request");
      const fromNotif = sanitizeChessUsername(notif?.getAttribute("username"));
      if (fromNotif) return fromNotif;
      const profileNav = document.querySelector(
        'a[data-nav-link="profile"][href*="/member/"], .nav-link-profile[href*="/member/"]'
      );
      if (profileNav) {
        const m = (profileNav.getAttribute("href") || "").match(/\/member\/([^/?#]+)/i);
        if (m?.[1]) {
          const s = sanitizeChessUsername(decodeURIComponent(m[1]));
          if (s) return s;
        }
      }
      return null;
    }
    extractCleanTextWithoutDecorations(root) {
      if (root instanceof Element) {
        const clone = root.cloneNode(true);
        clone.querySelectorAll(
          '.chess-sentinel-inline-pill, [class*="rating"], [class*="title"], [class*="flair"], [class*="country"], [class*="clock"]'
        ).forEach((n) => n.remove());
        return clone.textContent || "";
      }
      return root.textContent || "";
    }
    extractUsernameFromHref(href) {
      if (!href) return null;
      const m = href.match(/\/member\/([^/?#]+)/i);
      if (!m?.[1]) return null;
      try {
        return sanitizeChessUsername(decodeURIComponent(m[1]));
      } catch {
        return sanitizeChessUsername(m[1]);
      }
    }
    extractNameFromElement(el) {
      if (!el) return null;
      const attrName = el.getAttribute("username") || el.getAttribute("data-username") || el.getAttribute("data-player-username");
      if (attrName) {
        const s = sanitizeChessUsername(attrName);
        if (s) return s;
      }
      if (el.tagName === "A") {
        const s = this.extractUsernameFromHref(el.getAttribute("href"));
        if (s) return s;
      }
      const nestedMemberLink = el.querySelector('a[href*="/member/"]');
      if (nestedMemberLink) {
        const s = this.extractUsernameFromHref(nestedMemberLink.getAttribute("href"));
        if (s) return s;
      }
      if (el.shadowRoot) {
        const shadowLink = el.shadowRoot.querySelector('a[href*="/member/"]');
        if (shadowLink) {
          const s = this.extractUsernameFromHref(shadowLink.getAttribute("href"));
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
      const nestedUser = el.querySelector(
        '[data-test-element="user-tagline-username"], .cc-user-username-component, .user-tagline-username, .user-tagline-compact-username, [class*="username"]:not([class*="rating"]):not([class*="title"])'
      );
      if (nestedUser) {
        const s = sanitizeChessUsername(this.extractCleanTextWithoutDecorations(nestedUser));
        if (s) return s;
      }
      return sanitizeChessUsername(this.extractCleanTextWithoutDecorations(el));
    }
    extractZonePlayer(zoneSelectors) {
      for (const zSel of zoneSelectors) {
        const zone = document.querySelector(zSel);
        if (!zone) continue;
        const candidateSelectors = [
          'a[href*="/member/"]',
          "cc-user-username-component",
          '[data-test-element="user-tagline-username"]',
          ".cc-user-username-component",
          ".user-username-component.user-tagline-username",
          ".user-tagline-username",
          ".user-tagline-compact-username",
          "[data-username]",
          "[data-player-username]",
          '[class*="username"]:not([class*="rating"]):not([class*="title"])'
        ];
        for (const sel of candidateSelectors) {
          const els = zone.querySelectorAll(sel);
          for (const el of Array.from(els)) {
            if (el.closest(".chess-sentinel-inline-pill")) continue;
            const name = this.extractNameFromElement(el);
            if (name) return name;
          }
        }
      }
      return null;
    }
    extractPlayers() {
      let topPlayer = this.extractZonePlayer(TOP_ZONE_SELECTORS);
      let bottomPlayer = this.extractZonePlayer(BOTTOM_ZONE_SELECTORS);
      if (!topPlayer || !bottomPlayer) {
        const candidates = Array.from(
          document.querySelectorAll(
            'cc-user-username-component, [data-test-element="user-tagline-username"], .cc-user-username-component, .user-tagline-username, .user-tagline-compact-username'
          )
        ).filter((el) => {
          if (el.closest(".chess-sentinel-inline-pill")) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 8 && rect.height > 6 && rect.top >= 0 && rect.top < window.innerHeight;
        }).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        const names = [];
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
    detectActiveFormat() {
      const url = window.location.href.toLowerCase();
      if (url.includes("/daily/")) return "daily";
      const glyphSelectors = [
        '[data-glyph*="bullet"]',
        ".icon-font-chess.bullet",
        '[class*="time-selector"] [class*="bullet"]'
      ];
      for (const s of glyphSelectors) {
        if (document.querySelector(s)) return "bullet";
      }
      if (document.querySelector(
        '[data-glyph*="blitz"], .icon-font-chess.blitz, [data-glyph*="lightning"]'
      )) {
        return "blitz";
      }
      if (document.querySelector('[data-glyph*="rapid"], .icon-font-chess.rapid')) {
        return "rapid";
      }
      const clockEl = document.querySelector(
        "#board-layout-player-top .clock-time-monospace, .board-layout-top .clock-time-monospace, .player-top .clock-time-monospace, .clock-component"
      );
      if (clockEl) {
        const txt = (clockEl.textContent || "").trim();
        const m = txt.match(/^(\d+):(\d{2})/);
        if (m) {
          const mins = Number(m[1]);
          if (mins < 3) return "bullet";
          if (mins < 10) return "blitz";
          return "rapid";
        }
      }
      return void 0;
    }
    detectAbortWindow() {
      const plies = document.querySelectorAll(
        "wc-simple-move-list [data-ply], .move-list [data-ply], .vertical-move-list .node, .main-line-row"
      );
      if (plies.length <= 1) {
        const hasLiveClock = !!document.querySelector(".clock-component, .clock-time-monospace");
        return hasLiveClock;
      }
      return false;
    }
    evaluateDom() {
      const currentUrl = window.location.href;
      const gameId = extractGameIdFromUrl(currentUrl);
      const memberProfile = !this.hasBoardOnPage() ? extractMemberProfileFromUrl(currentUrl) : null;
      if (!this.hasBoardOnPage() && !memberProfile) {
        if (this.lastSignature !== "") {
          this.lastSignature = "";
          this.onMatchLeft();
        }
        return;
      }
      const loggedIn = this.getLoggedInUsername()?.toLowerCase();
      if (memberProfile && !this.hasBoardOnPage()) {
        const isSelfProfile = Boolean(loggedIn && memberProfile.toLowerCase() === loggedIn);
        const sig2 = `profile|${memberProfile.toLowerCase()}|${isSelfProfile ? "1" : "0"}`;
        if (sig2 === this.lastSignature) return;
        this.lastSignature = sig2;
        this.onContextChange({
          topPlayer: memberProfile,
          bottomPlayer: loggedIn || null,
          opponent: memberProfile,
          opponentSide: "top",
          detectedFormat: void 0,
          isAbortWindowOpen: false,
          surface: "profile",
          gameId: null,
          isSelfProfile,
          url: currentUrl
        });
        return;
      }
      const { topPlayer, bottomPlayer } = this.extractPlayers();
      let opponent = topPlayer;
      let opponentSide = "top";
      if (loggedIn && topPlayer && bottomPlayer && topPlayer.toLowerCase() === loggedIn && bottomPlayer.toLowerCase() !== loggedIn) {
        opponent = bottomPlayer;
        opponentSide = "bottom";
      }
      if (!opponent) return;
      const detectedFormat = this.detectActiveFormat();
      const isAbortWindowOpen = this.detectAbortWindow();
      const hasActiveClock = !!document.querySelector(
        '.clock-player-turn, [class*="clock-player-turn"]'
      );
      const surface = hasActiveClock || /\/play\/online|\/live/i.test(currentUrl) ? "live" : "game";
      const sig = `${surface}|${opponent.toLowerCase()}|${opponentSide}|${(bottomPlayer || "").toLowerCase()}|${isAbortWindowOpen ? "1" : "0"}|${gameId || ""}`;
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
        url: currentUrl
      });
    }
  };

  // src/core/engine.ts
  function computeEffectiveLiveRisk(res, liveClock, selectedFormat) {
    if (res.isBannedFairPlay) {
      return { probability: 100, tier: "banned", liveEscalated: false };
    }
    const fmt = selectedFormat || res.primaryFormat;
    const fmtData = res.formats[fmt] || res.formats[res.primaryFormat];
    const baseProb = fmt === res.primaryFormat ? res.probability : fmtData.formatProbability;
    const belongsToTarget = liveClock && (liveClock.opponent.toLowerCase() === res.username.toLowerCase() || liveClock.opponent.toLowerCase() === res.displayName.toLowerCase());
    if (!belongsToTarget || !liveClock.isLiveSuspectPacing || res.title) {
      return {
        probability: baseProb,
        tier: probabilityToTier(baseProb, false),
        liveEscalated: false
      };
    }
    const streakBonus = Math.min(18, Math.max(0, liveClock.consecutiveRoboticMoves - 7) * 3);
    const liveFloor = liveClock.pauseMoveNumber !== null ? 68 + streakBonus : 60 + streakBonus;
    const combined = Math.min(94, Math.max(baseProb, Math.round(liveFloor + baseProb * 0.18)));
    return {
      probability: combined,
      tier: probabilityToTier(combined, false),
      liveEscalated: combined > baseProb
    };
  }
  function buildFairPlayEvidenceReport(res, lang, liveClock) {
    const pf = res.formats[res.primaryFormat];
    const eff = computeEffectiveLiveRisk(res, liveClock, res.primaryFormat);
    const lines = [];
    if (lang === "tr") {
      lines.push(`[Chess Sentinel v4.1 - Adil Oyun Kanit Ozeti]`);
      lines.push(
        `Oyuncu: @${res.displayName} (https://www.chess.com/member/${res.displayName}) | Hesap Yasi: ${res.accountAgeDays !== null ? `${res.accountAgeDays} gun` : "Bilinmiyor"}`
      );
      lines.push(
        `Format: ${res.primaryFormat.toUpperCase()} (${pf.currentRating ?? "-"} Elo) | Anomali Skoru: %${eff.probability}`
      );
      lines.push(
        `Son Performans: ${pf.recentWins}G / ${pf.recentLosses}M / ${pf.recentDraws}B (%${pf.recentWinPct} galibiyet, ${pf.eloZScore >= 0 ? "+" : ""}${pf.eloZScore}\u03C3 Z-Skoru${pf.performanceRating ? `, Perf: ${pf.performanceRating}` : ""})`
      );
      if (pf.avgAccuracy !== null) {
        lines.push(
          `Uzun Mac CAPS2 Dogruluk: %${pf.avgAccuracy} (Beklenen: %${pf.expectedAccuracy}, Incelenen tam mac: ${pf.reviewedGames})`
        );
      }
      if (res.pacing.gamesAnalyzed >= 4) {
        lines.push(
          `Hamle Suresi Analizi (%clk): Entropi ${res.pacing.meanEntropyBits ?? "-"} bit | Medyan QCD: ${res.pacing.medianQCD ?? "-"} | Medyan CV: ${res.pacing.medianCV ?? "-"} | Mekanik Mac Orani: %${Math.round(res.pacing.flatlineRate * 100)}`
        );
      }
      if (liveClock && liveClock.movesObserved >= 4) {
        const livePin = liveClock.pauseMoveNumber !== null && liveClock.roboticStartMove !== null ? ` | Nokta At\u0131\u015F\u0131: ${liveClock.pauseMoveNumber}. hamlede ${liveClock.detectedPauseSec}sn duraksama -> ${liveClock.roboticStartMove}.-${liveClock.roboticEndMove}. hamleler robotik (${liveClock.roboticMinSec}-${liveClock.roboticMaxSec}sn)` : liveClock.roboticStartMove !== null && liveClock.consecutiveRoboticMoves >= 6 ? ` | Nokta At\u0131\u015F\u0131: ${liveClock.roboticStartMove}.-${liveClock.roboticEndMove}. hamleler kesintisiz mekanik (${liveClock.roboticMinSec}-${liveClock.roboticMaxSec}sn)` : "";
        lines.push(
          `Aktif Mac Saat Verisi: ${liveClock.movesObserved} hamle | Ort: ${liveClock.liveMeanSec ?? "-"} sn | QCD: ${liveClock.liveQCD ?? "-"}${livePin}`
        );
      }
      if (res.suspectPinpoints && res.suspectPinpoints.length > 0) {
        lines.push(`\u015E\xFCpheli Ma\xE7 ve Hamle Aral\u0131klar\u0131:`);
        for (const p of res.suspectPinpoints) {
          const urlPart = p.gameUrl ? ` | ${p.gameUrl}` : "";
          const samples = p.sampleMoves.length > 0 ? ` [${p.sampleMoves.join(" ")}]` : "";
          if (p.kind === "midgame_toggle") {
            lines.push(
              `- vs @${p.opponentUsername}: ${p.pauseMoveNumber}. hamlede ${p.pauseSec}sn duraksama -> ${p.suspectStartMove}.-${p.suspectEndMove}. hamleler robotik tempo (${p.minBandSec}-${p.maxBandSec}sn)${samples}${urlPart}`
            );
          } else if (p.kind === "robotic_flatline") {
            lines.push(
              `- vs @${p.opponentUsername}: ${p.suspectStartMove}.-${p.suspectEndMove}. hamleler sabit mekanik tempo (${p.minBandSec}-${p.maxBandSec}sn)${p.accuracy !== null ? ` [%${p.accuracy}]` : ""}${samples}${urlPart}`
            );
          } else {
            lines.push(
              `- vs @${p.opponentUsername}: ${p.suspectEndMove} hamlelik tam ma\xE7ta %${p.accuracy} CAPS2 do\u011Fruluk${urlPart}`
            );
          }
        }
      } else {
        const topUrls = res.recentMatches.filter((m) => m.url && m.result === "W").slice(0, 3).map((m) => `${m.url}${m.accuracy !== null ? ` (%${m.accuracy})` : ""}`);
        if (topUrls.length > 0) {
          lines.push(`\u0130ncelenmesi \xD6nerilen Son Ma\xE7lar:
- ${topUrls.join("\n- ")}`);
        }
      }
    } else {
      lines.push(`[Chess Sentinel v4.1 - Fair-Play Evidence Summary]`);
      lines.push(
        `Player: @${res.displayName} (https://www.chess.com/member/${res.displayName}) | Account Age: ${res.accountAgeDays !== null ? `${res.accountAgeDays} days` : "Unknown"}`
      );
      lines.push(
        `Format: ${res.primaryFormat.toUpperCase()} (${pf.currentRating ?? "-"} Elo) | Statistical Anomaly Score: ${eff.probability}%`
      );
      lines.push(
        `Recent Performance: ${pf.recentWins}W / ${pf.recentLosses}L / ${pf.recentDraws}D (${pf.recentWinPct}% WR, ${pf.eloZScore >= 0 ? "+" : ""}${pf.eloZScore}\u03C3 Z-Score${pf.performanceRating ? `, Perf: ${pf.performanceRating}` : ""})`
      );
      if (pf.avgAccuracy !== null) {
        lines.push(
          `Long-Game CAPS2 Accuracy: ${pf.avgAccuracy}% (Expected: ${pf.expectedAccuracy}%, Full-length reviewed games: ${pf.reviewedGames})`
        );
      }
      if (res.pacing.gamesAnalyzed >= 4) {
        lines.push(
          `Move-Time [%clk] Profile: Entropy ${res.pacing.meanEntropyBits ?? "-"} bits | Median QCD: ${res.pacing.medianQCD ?? "-"} | Median CV: ${res.pacing.medianCV ?? "-"} | Flatline Rate: ${Math.round(res.pacing.flatlineRate * 100)}%`
        );
      }
      if (liveClock && liveClock.movesObserved >= 4) {
        const livePin = liveClock.pauseMoveNumber !== null && liveClock.roboticStartMove !== null ? ` | Pinpoint: Move #${liveClock.pauseMoveNumber} (${liveClock.detectedPauseSec}s pause) -> Moves #${liveClock.roboticStartMove}-#${liveClock.roboticEndMove} mechanical (${liveClock.roboticMinSec}-${liveClock.roboticMaxSec}s)` : liveClock.roboticStartMove !== null && liveClock.consecutiveRoboticMoves >= 6 ? ` | Pinpoint: Moves #${liveClock.roboticStartMove}-#${liveClock.roboticEndMove} continuous mechanical band (${liveClock.roboticMinSec}-${liveClock.roboticMaxSec}s)` : "";
        lines.push(
          `Match Clock Data: ${liveClock.movesObserved} moves | Mean: ${liveClock.liveMeanSec ?? "-"}s | QCD: ${liveClock.liveQCD ?? "-"}${livePin}`
        );
      }
      if (res.suspectPinpoints && res.suspectPinpoints.length > 0) {
        lines.push(`Pinpointed Suspect Games & Move Ranges:`);
        for (const p of res.suspectPinpoints) {
          const urlPart = p.gameUrl ? ` | ${p.gameUrl}` : "";
          const samples = p.sampleMoves.length > 0 ? ` [${p.sampleMoves.join(" ")}]` : "";
          if (p.kind === "midgame_toggle") {
            lines.push(
              `- vs @${p.opponentUsername}: Move #${p.pauseMoveNumber} (${p.pauseSec}s pause) -> Moves #${p.suspectStartMove}-#${p.suspectEndMove} mechanical band (${p.minBandSec}-${p.maxBandSec}s)${samples}${urlPart}`
            );
          } else if (p.kind === "robotic_flatline") {
            lines.push(
              `- vs @${p.opponentUsername}: Moves #${p.suspectStartMove}-#${p.suspectEndMove} zero-reflex mechanical pacing (${p.minBandSec}-${p.maxBandSec}s)${p.accuracy !== null ? ` [${p.accuracy}%]` : ""}${samples}${urlPart}`
            );
          } else {
            lines.push(
              `- vs @${p.opponentUsername}: ${p.accuracy}% CAPS2 accuracy over ${p.suspectEndMove} full moves${urlPart}`
            );
          }
        }
      } else {
        const topUrls = res.recentMatches.filter((m) => m.url && m.result === "W").slice(0, 3).map((m) => `${m.url}${m.accuracy !== null ? ` (${m.accuracy}%)` : ""}`);
        if (topUrls.length > 0) {
          lines.push(`Recent Games for Review:
- ${topUrls.join("\n- ")}`);
        }
      }
    }
    return lines.join("\n");
  }

  // src/i18n/translations.ts
  var TRANSLATIONS = {
    tr: {
      appName: "Chess Sentinel",
      appSubtitle: "Rakip Analizi ve Adil Oyun Kontrol\xFC",
      cheatProbability: "Risk Skoru",
      scanningOpponent: "Rakip ge\xE7mi\u015Fi inceleniyor...",
      waitingForMatch: "Rakip bekleniyor...",
      abortWindowActive: "\xDCcretsiz iptal (abort) s\xFCresi a\xE7\u0131k",
      safeToPlay: "Do\u011Fal insan profili, g\xFCvenle oynanabilir",
      cautionAdvised: "Ola\u011Fand\u0131\u015F\u0131 metrikler var, dikkatli oynay\u0131n",
      considerAborting: "Y\xFCksek risk sinyali, ma\xE7\u0131 iptal edebilirsiniz",
      bannedFairPlayBanner: "Bu hesap Chess.com taraf\u0131ndan adil oyun ihlalinden kapat\u0131ld\u0131",
      confidenceLabel: {
        low: "Az \xF6rneklem",
        medium: "Orta \xF6rneklem",
        high: "Y\xFCksek \xF6rneklem"
      },
      surfaceBadge: {
        live: "Canl\u0131",
        game: "Ma\xE7",
        profile: "Profil"
      },
      hudTabs: {
        overview: "\xD6zet",
        clock: "Ma\xE7 Saati",
        games: "Ge\xE7mi\u015F"
      },
      tiers: {
        low: { label: "Temiz", summary: "Do\u011Fal insan istatistikleri" },
        guarded: { label: "Normal+", summary: "Formda, normal s\u0131n\u0131rlar i\xE7inde" },
        elevated: { label: "\u015E\xFCpheli", summary: "Birden fazla ola\u011Fand\u0131\u015F\u0131 metrik" },
        high: { label: "Y\xFCksek Risk", summary: "G\xFC\xE7l\xFC motor veya d\u0131\u015F destek sinyali" },
        critical: { label: "Kritik Risk", summary: "\xC7oklu do\u011Frulanm\u0131\u015F motor imzas\u0131" },
        banned: { label: "Yasakl\u0131", summary: "Adil oyun ihlalinden kapat\u0131ld\u0131" }
      },
      signals: {
        sectionTitle: "Alt Sinyaller",
        recentWinrate: "Son Ma\xE7 Kazanma Sapmas\u0131",
        overallWinrate: "Genel Glicko Dengesi",
        accuracyAnomaly: "Uzun Ma\xE7 CAPS2 Sapmas\u0131",
        movePacing: "Hamle S\xFCresi Tutarl\u0131l\u0131\u011F\u0131 (%clk)",
        eloVelocity: "Puan Art\u0131\u015F H\u0131z\u0131",
        accountTrust: "Hesap Ya\u015F\u0131 ve Ge\xE7mi\u015F"
      },
      stats: {
        accountAge: "Hesap Ya\u015F\u0131",
        daysShort: "g\xFCn",
        monthsShort: "ay",
        yearsShort: "y\u0131l",
        recentRecord: "Son Form",
        performance: "Performans",
        avgAccuracy: "CAPS2 Ort.",
        expectedShort: "bek.",
        moveCV: "Hamle Ritmi",
        elo7d: "7 G\xFCnl\xFCk Elo",
        streak: "Seri",
        noReviewedGames: "\u0130ncelenen ma\xE7 yok",
        gamesAnalyzed: "{count} ma\xE7",
        lifetimeGames: "{count} ma\xE7"
      },
      actions: {
        swapTarget: "\xDCst / Alt oyuncuyu de\u011Fi\u015Ftir",
        watchSuspect: "Takip listesine ekle",
        watchingSuspect: "Takipte (ban kontrol\xFC aktif)",
        refresh: "Verileri yenile",
        minimize: "K\xFC\xE7\xFClt (Alt+S)",
        expand: "Paneli a\xE7",
        openProfile: "Chess.com profilini a\xE7",
        toggleDetails: "Alt sinyalleri g\xF6ster",
        hideDetails: "Alt sinyalleri gizle",
        copyReport: "Kan\u0131t Kopyala",
        copiedReport: "Kopyaland\u0131",
        reportFairPlay: "Bildir",
        soundOn: "Sesli uyar\u0131 a\xE7\u0131k",
        soundOff: "Sesli uyar\u0131 kapal\u0131"
      },
      v3: {
        liveClockTitle: "Canl\u0131 Ma\xE7 Hamle S\xFCreleri",
        finishedClockTitle: "Bu Ma\xE7\u0131n Hamle S\xFCreleri (0.1sn)",
        emptyLiveClock: "Canl\u0131 hamle s\xFCreleri 3. hamleden itibaren burada grafiklenir.",
        liveClockMoves: "{count} hamle \xB7 Ort {mean}sn \xB7 QCD {qcd}",
        liveClockSuspect: "Bu ma\xE7ta mekanik hamle temposu tespit edildi.",
        livePinpointToggle: "{pauseMove}. hamlede {pauseSec}sn duraksama -> {start}.-{end}. hamleler sabit ({min}-{max}sn)",
        livePinpointFlatline: "{start}.-{end}. hamleler aras\u0131 \xFCst \xFCste {count} hamle sabit aral\u0131kta ({min}-{max}sn)",
        pacingHistTitle: "Ge\xE7mi\u015F Hamle S\xFCresi Da\u011F\u0131l\u0131m\u0131",
        pacingEntropyTag: "Entropi {ent}b \xB7 QCD {qcd}",
        recentMatchesTitle: "Son Puanl\u0131 Ma\xE7lar",
        inspectMoves: "S\xFCreler",
        autoVerdictTitle: "Durum",
        verdictBanned: "Hesap Chess.com taraf\u0131ndan adil oyun ihlali nedeniyle kapat\u0131lm\u0131\u015F.",
        verdictLiveToggle: "Aktif ma\xE7 tespiti: {pauseMove}. hamlede {pauseSec}sn bekleyip {start}.-{end}. hamleleri sabit ritimde ({min}-{max}sn) oynad\u0131.",
        verdictLiveFlatline: "Aktif ma\xE7 tespiti: {start}.-{end}. hamleler boyunca \xFCst \xFCste {count} hamleyi sabit s\xFCrede ({min}-{max}sn) oynuyor.",
        verdictAbortNow: "Ge\xE7mi\u015Fte {pins} \u015F\xFCpheli ma\xE7 aral\u0131\u011F\u0131 bulundu. \u0130lk hamlelerdesiniz, puan kaybetmeden iptal (abort) edebilirsiniz.",
        verdictHighWatch: "Ge\xE7mi\u015F ma\xE7larda do\u011Frulanm\u0131\u015F motor imzas\u0131 var. Tam hamle aral\u0131klar\u0131 a\u015Fa\u011F\u0131da listelendi.",
        verdictElevatedWatch: "Hamle temposu veya do\u011Fruluk verilerinde sapma var. Canl\u0131 saat takibi aktif.",
        verdictSmurfHuman: "Kazanma oran\u0131 y\xFCksek fakat hamle s\xFCreleri do\u011Fal insan da\u011F\u0131l\u0131m\u0131nda (olas\u0131 smurf veya formda oyuncu).",
        verdictCleanSafe: "\u0130ncelenen ma\xE7larda robotik tempo veya oyun ortas\u0131 motor ge\xE7i\u015Fi g\xF6r\xFClmedi.",
        pinpointSectionTitle: "\u015E\xFCpheli Ma\xE7 ve Hamle Aral\u0131klar\u0131",
        pinpointOpenGame: "Ma\xE7\u0131 a\xE7",
        pinpointToggleRow: "{pauseMove}. hamlede {pauseSec}sn duraksama -> {start}.-{end}. hamleler sabit ({min}-{max}sn)",
        pinpointFlatlineRow: "{start}.-{end}. hamleler aras\u0131 {count} hamle sabit mekanik tempo ({min}-{max}sn)",
        pinpointCapsRow: "1.-{end}. hamleler boyunca %{acc} CAPS2 do\u011Fruluk"
      },
      popup: {
        tabScanner: "Sorgula",
        tabWatchlist: "Takip Listesi",
        tabSettings: "Ayarlar",
        activeMatchLabel: "A\xE7\u0131k sekmedeki rakip",
        searchPlaceholder: "Kullan\u0131c\u0131 ad\u0131 (\xF6rn. hikaru)",
        scanBtn: "\u0130ncele",
        recentScansTitle: "Son \u0130ncelenenler",
        emptyScans: "Hen\xFCz oyuncu incelenmedi. Chess.com'da ma\xE7a girin veya yukar\u0131dan arat\u0131n.",
        watchlistTitle: "Takip Edilen Hesaplar",
        checkBansBtn: "Ban Kontrol\xFC",
        checkingBans: "Kontrol ediliyor...",
        emptyWatchlist: "Takip listeniz bo\u015F. HUD \xFCzerindeki yer imi simgesiyle oyuncu ekleyebilirsiniz.",
        bannedTag: "Kapat\u0131ld\u0131",
        activeTag: "Aktif",
        addedOn: "\u0130lk skor: %{prob}",
        removeBtn: "Sil",
        settingsLanguage: "Dil / Language",
        settingsAutoHud: "Ma\xE7ta paneli otomatik a\xE7",
        settingsAutoHudDesc: "Rakip alg\u0131land\u0131\u011F\u0131nda sa\u011F \xFCstteki analiz panelini otomatik g\xF6sterir.",
        settingsInlineBadge: "Kullan\u0131c\u0131 ad\u0131 yan\u0131 rozeti",
        settingsInlineBadgeDesc: "Rakibin ad\u0131n\u0131n yan\u0131na sade y\xFCzdelik skor ve galibiyet etiketi ekler.",
        settingsCompact: "Daralt\u0131lm\u0131\u015F g\xF6r\xFCn\xFCm",
        settingsCompactDesc: "Alt sinyal \xE7ubuklar\u0131n\u0131 varsay\u0131lan olarak kapal\u0131 tutar.",
        settingsRatedOnly: "Yaln\u0131zca puanl\u0131 ma\xE7lar",
        settingsRatedOnlyDesc: "Puans\u0131z ma\xE7lar\u0131 hesaplamaya dahil etmez.",
        settingsSoundAlerts: "Y\xFCksek risk ses uyar\u0131s\u0131",
        settingsSoundAlertsDesc: "Y\xFCksek riskli veya takipteki rakip geldi\u011Finde k\u0131sa uyar\u0131 sesi \xE7alar.",
        settingsSensitivity: "Hassasiyet",
        sensitivityConservative: "Esnek",
        sensitivityBalanced: "Dengeli (\xD6nerilen)",
        sensitivityStrict: "S\u0131k\u0131",
        toggleInPageHud: "Sekmede Paneli G\xF6ster / Gizle",
        privacyNote: "Veri toplanmaz. Yaln\u0131zca herkese a\xE7\u0131k Chess.com verileri kullan\u0131l\u0131r."
      },
      flags: {
        banned_fair_play: "Chess.com taraf\u0131ndan adil oyun ihlalinden kapat\u0131ld\u0131",
        verified_title: "Onayl\u0131 FIDE unvanl\u0131 oyuncu ({title})",
        fresh_high_elo: "Yeni hesap ({days} g\xFCnl\xFCk), {rating} Elo seviyesinde",
        fresh_account: "Yeni a\xE7\u0131lm\u0131\u015F hesap ({days} g\xFCnl\xFCk)",
        extreme_recent_wr: "Son {games} ma\xE7ta %{wr} galibiyet (+{z}\u03C3 Elo \xFCst\xFC performans)",
        elevated_recent_wr: "Son {games} ma\xE7ta %{wr} galibiyet (+{z}\u03C3 beklenti \xFCst\xFC)",
        smurf_human_pacing: "Y\xFCksek kazanma oran\u0131, do\u011Fal insan hamle s\xFCreleri (olas\u0131 smurf)",
        accuracy_excess: "Uzun ma\xE7larda beklentinin +%{excess} \xFCzerinde do\u011Fruluk (%{avg})",
        accuracy_spikes: "{games} uzun ma\xE7\u0131n %{rate} kadar\u0131nda \u2265%{ceil} tavan do\u011Fruluk",
        robotic_pacing: "D\xFC\u015F\xFCk s\xFCre \xE7e\u015Fitlili\u011Fi ({ent} bit, QCD {qcd}, CV {cv})",
        midgame_toggle: "{count} ma\xE7ta uzun duraksama sonras\u0131 sabit s\xFCreli hamle serisi",
        elo_surge: "Son 7 g\xFCnde +{delta} Elo art\u0131\u015F",
        hot_streak: "\xDCst \xFCste {streak} puanl\u0131 galibiyet serisi",
        tactics_gap: "Canl\u0131 puan ({rating}) ile bulmaca puan\u0131 ({tactics}) fark\u0131 y\xFCksek",
        natural_human: "Do\u011Fal hamle s\xFCresi da\u011F\u0131l\u0131m\u0131 (CV {cv})",
        established_veteran: "K\xF6kl\xFC hesap ({years}+ y\u0131l, {total} ma\xE7)"
      }
    },
    en: {
      appName: "Chess Sentinel",
      appSubtitle: "Opponent Analysis & Fair-Play Monitor",
      cheatProbability: "Risk Score",
      scanningOpponent: "Loading opponent history...",
      waitingForMatch: "Waiting for opponent...",
      abortWindowActive: "Safe abort window open",
      safeToPlay: "Organic human profile, safe to play",
      cautionAdvised: "Unusual signals present, play with care",
      considerAborting: "High risk indicators, consider aborting",
      bannedFairPlayBanner: "Account closed by Chess.com for Fair Play violations",
      confidenceLabel: {
        low: "Low sample",
        medium: "Medium sample",
        high: "High sample"
      },
      surfaceBadge: {
        live: "Live",
        game: "Game",
        profile: "Profile"
      },
      hudTabs: {
        overview: "Summary",
        clock: "Match Clock",
        games: "Games"
      },
      tiers: {
        low: { label: "Clean", summary: "Organic human statistics" },
        guarded: { label: "Normal+", summary: "In form, within normal bounds" },
        elevated: { label: "Suspicious", summary: "Multiple elevated metrics" },
        high: { label: "High Risk", summary: "Strong engine or relay indicators" },
        critical: { label: "Critical", summary: "Corroborated multi-signal anomaly" },
        banned: { label: "Banned", summary: "Closed for Fair Play violation" }
      },
      signals: {
        sectionTitle: "Signal Breakdown",
        recentWinrate: "Recent Win-Rate Deviation",
        overallWinrate: "Lifetime Glicko Balance",
        accuracyAnomaly: "Long-Game CAPS2 Excess",
        movePacing: "Move-Time Consistency (%clk)",
        eloVelocity: "Rating Velocity",
        accountTrust: "Account Age & Provenance"
      },
      stats: {
        accountAge: "Account Age",
        daysShort: "d",
        monthsShort: "mo",
        yearsShort: "yr",
        recentRecord: "Recent Form",
        performance: "Performance",
        avgAccuracy: "CAPS2 Avg",
        expectedShort: "exp",
        moveCV: "Move Pace",
        elo7d: "7d Rating",
        streak: "Streak",
        noReviewedGames: "No reviewed games",
        gamesAnalyzed: "{count} games",
        lifetimeGames: "{count} games"
      },
      actions: {
        swapTarget: "Swap top / bottom player",
        watchSuspect: "Add to watchlist",
        watchingSuspect: "Bookmarked (ban check active)",
        refresh: "Refresh data",
        minimize: "Minimize (Alt+S)",
        expand: "Open panel",
        openProfile: "Open Chess.com profile",
        toggleDetails: "Show signal breakdown",
        hideDetails: "Hide signal breakdown",
        copyReport: "Copy Evidence",
        copiedReport: "Copied",
        reportFairPlay: "Report",
        soundOn: "Sound alert on",
        soundOff: "Sound alert off"
      },
      v3: {
        liveClockTitle: "Live Match Move Times",
        finishedClockTitle: "Match Move Times (0.1s)",
        emptyLiveClock: "Live move durations appear here starting from move 3.",
        liveClockMoves: "{count} moves \xB7 Avg {mean}s \xB7 QCD {qcd}",
        liveClockSuspect: "Mechanical move pacing detected in this game.",
        livePinpointToggle: "Move #{pauseMove} ({pauseSec}s pause) -> Moves #{start}-#{end} fixed ({min}-{max}s)",
        livePinpointFlatline: "Moves #{start}-#{end} ({count} straight moves) in narrow band ({min}-{max}s)",
        pacingHistTitle: "Historical Move-Time Distribution",
        pacingEntropyTag: "Entropy {ent}b \xB7 QCD {qcd}",
        recentMatchesTitle: "Recent Rated Games",
        inspectMoves: "Pacing",
        autoVerdictTitle: "Status",
        verdictBanned: "Account closed by Chess.com for Fair Play violations.",
        verdictLiveToggle: "Live match detection: paused {pauseSec}s on Move #{pauseMove}, then played Moves #{start}-#{end} at {min}-{max}s per move.",
        verdictLiveFlatline: "Live match detection: played {count} straight moves (#{start}-#{end}) within {min}-{max}s per move.",
        verdictAbortNow: "{pins} suspect game spans found in history. Safe abort window is open.",
        verdictHighWatch: "Corroborated engine patterns found in recent history. Exact move ranges are listed below.",
        verdictElevatedWatch: "Elevated pacing or accuracy metrics. Live move-clock tracking is active.",
        verdictSmurfHuman: "High win rate with natural human move-time variance (likely smurf or hot streak).",
        verdictCleanSafe: "No mechanical move spans or mid-game toggles found across analyzed games.",
        pinpointSectionTitle: "Suspect Games & Move Ranges",
        pinpointOpenGame: "Open",
        pinpointToggleRow: "Move #{pauseMove} ({pauseSec}s pause) -> Moves #{start}-#{end} fixed ({min}-{max}s)",
        pinpointFlatlineRow: "Moves #{start}-#{end} ({count} moves) narrow mechanical band ({min}-{max}s)",
        pinpointCapsRow: "Moves #1-#{end} played at {acc}% CAPS2 accuracy"
      },
      popup: {
        tabScanner: "Lookup",
        tabWatchlist: "Watchlist",
        tabSettings: "Settings",
        activeMatchLabel: "Active tab opponent",
        searchPlaceholder: "Username (e.g. hikaru)",
        scanBtn: "Inspect",
        recentScansTitle: "Recent Lookups",
        emptyScans: "No players inspected yet. Open a game on Chess.com or search above.",
        watchlistTitle: "Bookmarked Accounts",
        checkBansBtn: "Check Bans",
        checkingBans: "Checking...",
        emptyWatchlist: "Watchlist is empty. Use the bookmark icon on the panel to track accounts.",
        bannedTag: "Banned",
        activeTag: "Active",
        addedOn: "Initial: {prob}%",
        removeBtn: "Remove",
        settingsLanguage: "Language / Dil",
        settingsAutoHud: "Auto-open panel on match start",
        settingsAutoHudDesc: "Shows the analysis panel automatically when an opponent is detected.",
        settingsInlineBadge: "Inline username badge",
        settingsInlineBadgeDesc: "Places a compact percentage and record tag next to the username.",
        settingsCompact: "Collapsed breakdown by default",
        settingsCompactDesc: "Keeps individual signal bars collapsed until expanded.",
        settingsRatedOnly: "Rated games only",
        settingsRatedOnlyDesc: "Excludes unrated games from probability calculations.",
        settingsSoundAlerts: "High-risk audio alert",
        settingsSoundAlertsDesc: "Plays a short tone when matched with a high-risk or bookmarked account.",
        settingsSensitivity: "Sensitivity",
        sensitivityConservative: "Conservative",
        sensitivityBalanced: "Balanced (Default)",
        sensitivityStrict: "Strict",
        toggleInPageHud: "Show / Hide Panel on Tab",
        privacyNote: "Zero tracking. Uses public Chess.com API data only."
      },
      flags: {
        banned_fair_play: "Account closed by Chess.com for Fair Play violations",
        verified_title: "Verified FIDE titled player ({title})",
        fresh_high_elo: "New account ({days}d old) competing at {rating} Elo",
        fresh_account: "Recently created account ({days}d old)",
        extreme_recent_wr: "{wr}% win rate in last {games} games (+{z}\u03C3 above Elo expectation)",
        elevated_recent_wr: "{wr}% win rate in last {games} games (+{z}\u03C3 above expectation)",
        smurf_human_pacing: "High win rate with natural human move-time spread (likely smurf)",
        accuracy_excess: "+{excess}% long-game CAPS2 accuracy ({avg}%) above expected band",
        accuracy_spikes: "{rate}% of {games} long reviewed games reached \u2265{ceil}% accuracy",
        robotic_pacing: "Low move-time entropy ({ent}b, QCD {qcd}, CV {cv})",
        midgame_toggle: "Long pause followed by narrow-band move streak in {count} games",
        elo_surge: "+{delta} Elo gained over the last 7 days",
        hot_streak: "{streak} consecutive rated wins",
        tactics_gap: "Large gap between live rating ({rating}) and tactics ({tactics})",
        natural_human: "Natural human move-time dispersion (CV {cv})",
        established_veteran: "Established account ({years}+ yr, {total} games)"
      }
    }
  };
  function formatFlag(lang, flagId, params) {
    const template = TRANSLATIONS[lang].flags[flagId] || TRANSLATIONS.en.flags[flagId] || flagId;
    if (!params) return template;
    return template.replace(
      /\{(\w+)\}/g,
      (_, key) => params[key] !== void 0 ? String(params[key]) : `{${key}}`
    );
  }
  function formatAgeShort(days, lang) {
    if (days === null || days < 0) return "-";
    const s = TRANSLATIONS[lang].stats;
    if (days < 60) return `${Math.max(1, days)} ${s.daysShort}`;
    if (days < 365) return `${Math.round(days / 30)} ${s.monthsShort}`;
    const yrs = (days / 365).toFixed(days >= 1095 ? 0 : 1);
    return `${yrs} ${s.yearsShort}`;
  }

  // src/utils/icons.ts
  var ICONS = {
    mark: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.4L2.4 3.7v4.15c0 3.62 2.38 6.72 5.6 7.75 3.22-1.03 5.6-4.13 5.6-7.75V3.7L8 1.4z" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/>
    <path d="M5.65 8.15l1.55 1.55 3.15-3.25" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
    shieldCheck: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>`,
    alertTriangle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
  </svg>`,
    activity: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>`,
    swap: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M7 16V4m0 0L3 8m4-4l4 4"/>
    <path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
  </svg>`,
    refresh: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
    <path d="M21 3v6h-6"/>
  </svg>`,
    bookmark: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>`,
    bookmarkFilled: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>`,
    bellOn: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>`,
    bellOff: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    <path d="M18.63 13A17.89 17.89 0 0 1 18 8"/>
    <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/>
    <path d="M18 8a6 6 0 0 0-9.33-5"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>`,
    minimize: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>`,
    close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`,
    chevronDown: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9"/>
  </svg>`,
    chevronUp: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="18 15 12 9 6 15"/>
  </svg>`,
    copy: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>`,
    check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,
    external: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M7 17L17 7"/>
    <path d="M8 7h9v9"/>
  </svg>`,
    flag: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
    <line x1="4" y1="22" x2="4" y2="15"/>
  </svg>`,
    clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 7 12 12 15.5 14"/>
  </svg>`,
    search: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>`
  };

  // src/content/hud-styles.ts
  var HUD_SHADOW_CSS = `
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

  // src/content/hud-overlay.ts
  var HIST_LABELS = ["<0.9s", "1.8s", "3.2s", "5.5s", "9.5s", "18s", "18s+"];
  function barColor(score) {
    if (score < 25) return "#34d399";
    if (score < 45) return "#60a5fa";
    if (score < 68) return "#fbbf24";
    if (score < 82) return "#fb923c";
    return "#f43f5e";
  }
  function buildSmoothCurvePath(pts, minY, maxY) {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    const tau = 0.18;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) * tau;
      const cp1y = Math.max(minY, Math.min(maxY, p1.y + (p2.y - p0.y) * tau));
      const cp2x = p2.x - (p3.x - p1.x) * tau;
      const cp2y = Math.max(minY, Math.min(maxY, p2.y - (p3.y - p1.y) * tau));
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }
  function renderSvgMoveChronogram(lc) {
    const W = 304;
    const H = 82;
    const padL = 8;
    const padR = 8;
    const padT = 8;
    const padB = 18;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const baseLineY = padT + plotH;
    const times = lc.moveTimesSec;
    const n = times.length;
    const maxVal = Math.min(45, Math.max(12, ...times));
    const yOf = (sec) => {
      const clamped = Math.min(maxVal, Math.max(0, sec));
      return padT + plotH - clamped / maxVal * plotH;
    };
    const pts = times.map((sec, i) => ({
      x: n === 1 ? padL + plotW / 2 : padL + i / (n - 1) * plotW,
      y: yOf(sec),
      sec,
      moveNo: lc.moveNumbers?.[i] ?? i + 2,
      san: lc.moveSanLabels?.[i] || ""
    }));
    const linePath = buildSmoothCurvePath(pts, padT, baseLineY);
    const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${baseLineY} L ${pts[0].x.toFixed(1)} ${baseLineY} Z`;
    const strokeColor = lc.isLiveSuspectPacing ? "#f43f5e" : "#60a5fa";
    const gradId = lc.isLiveSuspectPacing ? "csGradDanger" : "csGradNormal";
    const bandTopY = yOf(Math.min(maxVal, 8.2));
    const bandBotY = yOf(2.6);
    const bandH = Math.max(2, bandBotY - bandTopY);
    const bandHtml = lc.isLiveSuspectPacing ? `<rect x="${padL}" y="${bandTopY.toFixed(1)}" width="${plotW}" height="${bandH.toFixed(1)}" rx="3" fill="rgba(244,63,94,0.09)" stroke="rgba(244,63,94,0.22)" stroke-dasharray="3 3" stroke-width="0.8"/>` : `<line x1="${padL}" y1="${(padT + plotH * 0.5).toFixed(1)}" x2="${padL + plotW}" y2="${(padT + plotH * 0.5).toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="2 3" stroke-width="1"/>`;
    const dotsHtml = pts.map((p, idx) => {
      const isPause = lc.pauseMoveNumber !== null && p.moveNo === lc.pauseMoveNumber;
      const isSus = lc.isLiveSuspectPacing && lc.roboticStartMove !== null && lc.roboticEndMove !== null && p.moveNo >= lc.roboticStartMove && p.moveNo <= lc.roboticEndMove;
      const dotCol = isPause ? "#fbbf24" : isSus ? "#f43f5e" : p.sec <= 1.8 ? "#34d399" : "#93c5fd";
      const r = isPause || isSus ? 3.1 : 2.3;
      const showTick = n <= 10 || idx === 0 || idx === n - 1 || idx % Math.ceil(n / 6) === 0 || isPause;
      const lblColor = isPause ? "#fbbf24" : isSus ? "#fda4af" : "#71717a";
      const tip = `#${p.moveNo}${p.san ? ` ${p.san}` : ""}: ${p.sec}s`;
      return `
        <g>
          <title>${escapeHtml(tip)}</title>
          ${isSus || isPause ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" fill="${dotCol}" fill-opacity="0.18"/>` : ""}
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${dotCol}" stroke="#141519" stroke-width="1"/>
          ${showTick ? `<text x="${p.x.toFixed(1)}" y="${H - 3}" text-anchor="middle" fill="${lblColor}" font-size="8.5" font-family="ui-monospace, Menlo, monospace">#${p.moveNo}</text>` : ""}
        </g>
      `;
    }).join("");
    return `
    <div class="chrono-svg-wrap">
      <svg class="chrono-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        ${bandHtml}
        <line x1="${padL}" y1="${baseLineY}" x2="${padL + plotW}" y2="${baseLineY}" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
        <path d="${areaPath}" fill="url(#${gradId})"/>
        <path d="${linePath}" fill="none" stroke="${strokeColor}" stroke-width="1.85" stroke-linecap="round"/>
        ${dotsHtml}
      </svg>
    </div>
  `;
  }
  function renderMiniMatchSvgSparkline(times, isSuspect, idx) {
    const W = 296;
    const H = 34;
    const padX = 4;
    const padY = 4;
    const plotW = W - padX * 2;
    const plotH = H - padY * 2;
    const maxVal = Math.min(35, Math.max(10, ...times));
    const pts = times.map((sec, i) => ({
      x: times.length === 1 ? W / 2 : padX + i / (times.length - 1) * plotW,
      y: padY + plotH - Math.min(maxVal, sec) / maxVal * plotH
    }));
    const line = buildSmoothCurvePath(pts, padY, padY + plotH);
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${padY + plotH} L ${pts[0].x.toFixed(1)} ${padY + plotH} Z`;
    const col = isSuspect ? "#f43f5e" : "#34d399";
    const gid = `csMiniGrad_${idx}`;
    return `
    <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${col}" stop-opacity="0.26"/>
          <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${line}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `;
  }
  var SentinelHudOverlay = class {
    host = null;
    shadow = null;
    cardEl = null;
    minPillEl = null;
    settings;
    callbacks;
    currentResult = null;
    liveClock = null;
    surface = "live";
    selectedFormat = "blitz";
    activeTab = "overview";
    expandedMatchIdx = null;
    isMinimized = false;
    isHidden = true;
    detailsExpanded = false;
    isAbortWindowOpen = false;
    isWatched = false;
    copiedFeedback = false;
    loadingUsername = null;
    // Drag state
    dragging = false;
    dragStartX = 0;
    dragStartY = 0;
    startRight = 18;
    startTop = 64;
    constructor(settings, callbacks) {
      this.settings = settings;
      this.callbacks = callbacks;
      this.detailsExpanded = !settings.compactMode;
      if (settings.hudPosition) {
        this.startRight = settings.hudPosition.right;
        this.startTop = settings.hudPosition.top;
      }
    }
    mount() {
      if (this.host && document.body.contains(this.host)) return;
      this.host = document.createElement("div");
      this.host.id = "chess-sentinel-hud-root";
      this.shadow = this.host.attachShadow({ mode: "open" });
      const styleEl = document.createElement("style");
      styleEl.textContent = HUD_SHADOW_CSS;
      this.cardEl = document.createElement("div");
      this.cardEl.className = "sentinel-card hidden";
      this.minPillEl = document.createElement("div");
      this.minPillEl.className = "minimized-pill hidden";
      this.minPillEl.addEventListener("click", () => {
        this.isMinimized = false;
        this.syncVisibility();
      });
      this.shadow.append(styleEl, this.cardEl, this.minPillEl);
      document.body.appendChild(this.host);
      this.applyPosition();
      this.setupGlobalDragListeners();
    }
    unmount() {
      if (this.host) {
        this.host.remove();
        this.host = null;
        this.shadow = null;
        this.cardEl = null;
        this.minPillEl = null;
      }
    }
    updateSettings(next) {
      const prevLang = this.settings.language;
      const prevSound = this.settings.soundAlerts;
      this.settings = next;
      if (prevLang !== next.language || prevSound !== next.soundAlerts) {
        this.render();
      }
    }
    updateLiveClock(telemetry) {
      const wasSuspect = Boolean(this.liveClock?.isLiveSuspectPacing);
      this.liveClock = telemetry;
      if (telemetry?.isLiveSuspectPacing && !wasSuspect) {
        this.activeTab = "clock";
      }
      if (this.currentResult && !this.isHidden) {
        this.render();
      }
    }
    setSurface(surface) {
      if (this.surface !== surface) {
        this.surface = surface;
        if (this.currentResult && !this.isHidden) this.render();
      }
    }
    setWatchedState(watched) {
      this.isWatched = watched;
      this.render();
    }
    setAbortWindow(open) {
      if (this.isAbortWindowOpen !== open) {
        this.isAbortWindowOpen = open;
        if (this.currentResult) this.render();
      }
    }
    showLoading(username) {
      this.mount();
      this.loadingUsername = username;
      this.currentResult = null;
      this.liveClock = null;
      this.expandedMatchIdx = null;
      this.isHidden = false;
      this.render();
      this.syncVisibility();
    }
    showResult(result, watched, isAbortWindowOpen, surface = "live") {
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
        this.activeTab = "overview";
        this.expandedMatchIdx = null;
      }
      this.isHidden = false;
      this.render();
      this.syncVisibility();
    }
    showError(username, message) {
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
    hide() {
      this.isHidden = true;
      this.syncVisibility();
    }
    toggleVisibility() {
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
    expandFromBadge() {
      this.mount();
      this.isHidden = false;
      this.isMinimized = false;
      this.syncVisibility();
    }
    syncVisibility() {
      if (!this.cardEl || !this.minPillEl) return;
      if (this.isHidden) {
        this.cardEl.classList.add("hidden");
        this.minPillEl.classList.add("hidden");
        return;
      }
      if (this.isMinimized) {
        this.cardEl.classList.add("hidden");
        this.minPillEl.classList.remove("hidden");
      } else {
        this.cardEl.classList.remove("hidden");
        this.minPillEl.classList.add("hidden");
      }
    }
    applyPosition() {
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
    setupGlobalDragListeners() {
      window.addEventListener("pointermove", (e) => {
        if (!this.dragging) return;
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.startRight = Math.max(8, Math.min(window.innerWidth - 220, this.startRight - dx));
        this.startTop = Math.max(8, Math.min(window.innerHeight - 60, this.startTop + dy));
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.applyPosition();
      });
      window.addEventListener("pointerup", () => {
        if (this.dragging) {
          this.dragging = false;
          this.callbacks.onSavePosition({ right: this.startRight, top: this.startTop });
        }
      });
    }
    getTargetLiveClock(res) {
      if (!this.liveClock) return null;
      const lcUser = this.liveClock.opponent.toLowerCase();
      if (lcUser === res.username.toLowerCase() || lcUser === res.displayName.toLowerCase()) {
        return this.liveClock;
      }
      return null;
    }
    renderHeaderHtml(lang) {
      const t = TRANSLATIONS[lang];
      const nextLang = lang === "tr" ? "EN" : "TR";
      const surfLabel = t.surfaceBadge[this.surface];
      const isLive = this.surface === "live";
      return `
      <div class="hud-header" data-drag-handle="1">
        <div class="brand">
          <span class="brand-mark">${ICONS.mark}</span>
          <span class="brand-title">Chess Sentinel</span>
          <span class="surface-tag ${isLive ? "live" : ""}">
            ${isLive ? '<span class="live-pulse"></span>' : ""}
            <span>${escapeHtml(surfLabel)}</span>
          </span>
        </div>
        <div class="header-actions">
          <button class="icon-btn lang-btn" data-action="lang" title="TR / EN">${nextLang}</button>
          ${this.surface !== "profile" ? `<button class="icon-btn" data-action="swap" title="${escapeHtml(t.actions.swapTarget)}">${ICONS.swap}</button>` : ""}
          ${this.currentResult ? `<button class="icon-btn ${this.isWatched ? "active" : ""}" data-action="watch" title="${escapeHtml(
        this.isWatched ? t.actions.watchingSuspect : t.actions.watchSuspect
      )}">${this.isWatched ? ICONS.bookmarkFilled : ICONS.bookmark}</button>` : ""}
          <button class="icon-btn" data-action="refresh" title="${escapeHtml(t.actions.refresh)}">${ICONS.refresh}</button>
          <button class="icon-btn" data-action="minimize" title="${escapeHtml(t.actions.minimize)}">${ICONS.minimize}</button>
          <button class="icon-btn" data-action="close" title="Close">${ICONS.close}</button>
        </div>
      </div>
    `;
    }
    bindHeaderEvents() {
      if (!this.cardEl) return;
      const header = this.cardEl.querySelector('[data-drag-handle="1"]');
      if (header) {
        header.addEventListener("pointerdown", (e) => {
          const target = e.target;
          if (target.closest("button")) return;
          this.dragging = true;
          this.dragStartX = e.clientX;
          this.dragStartY = e.clientY;
        });
      }
      this.cardEl.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const act = btn.dataset.action;
          if (act === "lang") {
            const next = this.settings.language === "tr" ? "en" : "tr";
            this.settings = { ...this.settings, language: next };
            this.render();
            this.callbacks.onToggleLanguage(next);
          } else if (act === "sound") {
            const nextSound = !this.settings.soundAlerts;
            this.settings = { ...this.settings, soundAlerts: nextSound };
            this.render();
            this.callbacks.onToggleSound(nextSound);
          } else if (act === "swap") {
            this.callbacks.onSwapTarget();
          } else if (act === "watch" && this.currentResult) {
            this.callbacks.onToggleWatchlist(this.currentResult);
          } else if (act === "refresh") {
            this.callbacks.onRefresh();
          } else if (act === "minimize") {
            this.isMinimized = true;
            this.syncVisibility();
          } else if (act === "close") {
            this.hide();
          }
        });
      });
    }
    resolveStatusLine(res, displayProb, lang) {
      const t = TRANSLATIONS[lang].v3;
      const lc = this.getTargetLiveClock(res);
      if (res.isBannedFairPlay) {
        return { cls: "danger", icon: ICONS.alertTriangle, message: t.verdictBanned };
      }
      if (lc && lc.isLiveSuspectPacing && lc.roboticStartMove !== null && lc.roboticEndMove !== null) {
        if (lc.pauseMoveNumber !== null && lc.detectedPauseSec !== null) {
          return {
            cls: "danger",
            icon: ICONS.activity,
            message: t.verdictLiveToggle.replace("{pauseMove}", String(lc.pauseMoveNumber)).replace("{pauseSec}", String(lc.detectedPauseSec)).replace("{start}", String(lc.roboticStartMove)).replace("{end}", String(lc.roboticEndMove)).replace("{min}", String(lc.roboticMinSec ?? "-")).replace("{max}", String(lc.roboticMaxSec ?? "-"))
          };
        }
        return {
          cls: "danger",
          icon: ICONS.activity,
          message: t.verdictLiveFlatline.replace("{start}", String(lc.roboticStartMove)).replace("{end}", String(lc.roboticEndMove)).replace("{count}", String(lc.consecutiveRoboticMoves)).replace("{min}", String(lc.roboticMinSec ?? "-")).replace("{max}", String(lc.roboticMaxSec ?? "-"))
        };
      }
      if (displayProb >= 75) {
        return {
          cls: "danger",
          icon: ICONS.alertTriangle,
          message: this.isAbortWindowOpen ? t.verdictAbortNow.replace("{pins}", String(Math.max(1, res.suspectPinpoints.length))) : t.verdictHighWatch
        };
      }
      if (displayProb >= 55) {
        return { cls: "warn", icon: ICONS.alertTriangle, message: t.verdictElevatedWatch };
      }
      if (res.flags.some((f) => f.id === "smurf_human_pacing")) {
        return { cls: "", icon: ICONS.activity, message: t.verdictSmurfHuman };
      }
      return { cls: "", icon: ICONS.shieldCheck, message: t.verdictCleanSafe };
    }
    renderSuspectPinpointsHtml(res, lang) {
      if (!res.suspectPinpoints || res.suspectPinpoints.length === 0) return "";
      const t = TRANSLATIONS[lang].v3;
      const itemsHtml = res.suspectPinpoints.map((p) => {
        const href = p.gameUrl || `https://www.chess.com/member/${encodeURIComponent(res.displayName)}`;
        let desc = "";
        if (p.kind === "midgame_toggle") {
          desc = t.pinpointToggleRow.replace("{pauseMove}", String(p.pauseMoveNumber ?? "?")).replace("{pauseSec}", String(p.pauseSec ?? "?")).replace("{start}", String(p.suspectStartMove)).replace("{end}", String(p.suspectEndMove)).replace("{min}", String(p.minBandSec ?? "-")).replace("{max}", String(p.maxBandSec ?? "-"));
        } else if (p.kind === "robotic_flatline") {
          desc = t.pinpointFlatlineRow.replace("{start}", String(p.suspectStartMove)).replace("{end}", String(p.suspectEndMove)).replace("{count}", String(p.roboticMoveCount)).replace("{min}", String(p.minBandSec ?? "-")).replace("{max}", String(p.maxBandSec ?? "-"));
        } else {
          desc = t.pinpointCapsRow.replace("{end}", String(p.suspectEndMove)).replace("{acc}", String(p.accuracy ?? "-"));
        }
        const sanHtml = p.sampleMoves && p.sampleMoves.length > 0 ? `<div class="pinpoint-san">${escapeHtml(p.sampleMoves.join("  "))}${p.accuracy !== null ? ` \xB7 %${p.accuracy}` : ""}</div>` : p.accuracy !== null && p.kind !== "caps2_spike" ? `<div class="pinpoint-san">CAPS2 %${p.accuracy}</div>` : "";
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
      }).join("");
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
    renderOverviewTabHtml(res, lang) {
      const t = TRANSLATIONS[lang];
      const fmtData = res.formats[this.selectedFormat] || res.formats[res.primaryFormat];
      const formatTabsHtml = LIVE_FORMATS.map((fmt) => {
        const f = res.formats[fmt];
        const active = fmt === this.selectedFormat ? "active" : "";
        const elo = f.currentRating ? String(f.currentRating) : "-";
        return `
        <button class="fmt-tab ${active}" data-fmt="${fmt}">
          <span>${fmt}</span>
          <span class="fmt-elo">${elo}</span>
        </button>
      `;
      }).join("");
      const formDotsHtml = res.recentForm.slice(0, 6).map((r) => `<span class="form-dot ${r}"></span>`).join("");
      const wldVal = fmtData.recentTotal > 0 ? lang === "tr" ? `${fmtData.recentWins}G ${fmtData.recentLosses}M ${fmtData.recentDraws}B` : `${fmtData.recentWins}W ${fmtData.recentLosses}L ${fmtData.recentDraws}D` : lang === "tr" ? `%${fmtData.overallWinPct}` : `${fmtData.overallWinPct}%`;
      const wldSub = fmtData.recentTotal > 0 ? `%${fmtData.recentWinPct}` : `${fmtData.overallTotal}`;
      const perfStr = fmtData.performanceRating ? String(fmtData.performanceRating) : "-";
      const zSign = fmtData.eloZScore >= 0 ? "+" : "";
      const zClass = fmtData.eloZScore >= 2.8 ? "warn" : "";
      const accStr = fmtData.avgAccuracy !== null ? `${fmtData.avgAccuracy}%` : "-";
      const accClass = fmtData.avgAccuracy !== null && fmtData.avgAccuracy - fmtData.expectedAccuracy >= 4 ? "neg" : fmtData.avgAccuracy !== null ? "pos" : "";
      const cvVal = res.pacing.medianCV;
      const qcdVal = res.pacing.medianQCD;
      const paceStr = cvVal !== null ? `CV ${cvVal}` : "-";
      const paceSub = qcdVal !== null ? `QCD ${qcdVal}` : "";
      const cvClass = cvVal !== null && cvVal < 0.45 ? "neg" : cvVal !== null && cvVal < 0.6 ? "warn" : "pos";
      const d7 = fmtData.eloDelta7d;
      const d7Str = d7 === null ? "0" : d7 > 0 ? `+${d7}` : `${d7}`;
      const d7Class = d7 !== null && d7 >= 100 ? "warn" : d7 !== null && d7 > 0 ? "pos" : "";
      const streakSub = res.winStreak >= 2 ? lang === "tr" ? `${res.winStreak}G seri` : `${res.winStreak}W` : "";
      const ageStr = formatAgeShort(res.accountAgeDays, lang);
      const totalGames = res.formats.rapid.overallTotal + res.formats.blitz.overallTotal + res.formats.bullet.overallTotal + res.formats.daily.overallTotal;
      const gamesSub = t.stats.lifetimeGames.replace("{count}", String(totalGames));
      const flagsHtml = res.flags.map(
        (f) => `
        <div class="flag-line">
          <span class="flag-dot ${f.severity}"></span>
          <span>${escapeHtml(formatFlag(lang, f.id, f.params))}</span>
        </div>
      `
      ).join("");
      const signalRows = [
        { label: t.signals.recentWinrate, score: res.signals.recentWinrate },
        { label: t.signals.overallWinrate, score: res.signals.overallWinrate },
        { label: t.signals.accuracyAnomaly, score: res.signals.accuracyAnomaly },
        { label: t.signals.movePacing, score: res.signals.movePacing },
        { label: t.signals.eloVelocity, score: res.signals.eloVelocity },
        { label: t.signals.accountTrust, score: res.signals.accountTrust }
      ];
      const signalsHtml = signalRows.map(
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
      ).join("");
      return `
      <div class="tab-pane">
        <div class="format-tabs">${formatTabsHtml}</div>

        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-lbl">
              <span>${escapeHtml(t.stats.recentRecord)}</span>
              <span class="form-dots">${formDotsHtml}</span>
            </div>
            <div class="metric-val-row">
              <span class="metric-val">${escapeHtml(wldVal)}</span>
              <span class="metric-sub">${escapeHtml(wldSub)}</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-lbl"><span>${escapeHtml(t.stats.performance)}</span></div>
            <div class="metric-val-row">
              <span class="metric-val ${zClass}">${escapeHtml(perfStr)}</span>
              <span class="metric-sub">${zSign}${fmtData.eloZScore}\u03C3</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-lbl"><span>${escapeHtml(t.stats.avgAccuracy)}</span></div>
            <div class="metric-val-row">
              <span class="metric-val ${accClass}">${escapeHtml(accStr)}</span>
              <span class="metric-sub">${escapeHtml(t.stats.expectedShort)} ${fmtData.expectedAccuracy}%</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-lbl"><span>${escapeHtml(t.stats.moveCV)}</span></div>
            <div class="metric-val-row">
              <span class="metric-val ${cvClass}">${escapeHtml(paceStr)}</span>
              <span class="metric-sub">${escapeHtml(paceSub)}</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-lbl"><span>${escapeHtml(t.stats.elo7d)}</span></div>
            <div class="metric-val-row">
              <span class="metric-val ${d7Class}">${escapeHtml(d7Str)}</span>
              <span class="metric-sub">${escapeHtml(streakSub)}</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-lbl"><span>${escapeHtml(t.stats.accountAge)}</span></div>
            <div class="metric-val-row">
              <span class="metric-val">${escapeHtml(ageStr)}</span>
              <span class="metric-sub">${escapeHtml(gamesSub)}</span>
            </div>
          </div>
        </div>

        ${this.renderSuspectPinpointsHtml(res, lang)}
        ${flagsHtml ? `<div class="flags-list">${flagsHtml}</div>` : ""}

        <button class="details-toggle" data-toggle-details="1">
          <span>${escapeHtml(this.detailsExpanded ? t.actions.hideDetails : t.actions.toggleDetails)}</span>
          ${this.detailsExpanded ? ICONS.chevronUp : ICONS.chevronDown}
        </button>

        <div class="signals-panel ${this.detailsExpanded ? "" : "collapsed"}">
          ${signalsHtml}
        </div>
      </div>
    `;
    }
    renderClockTabHtml(res, lang) {
      const t = TRANSLATIONS[lang];
      const lc = this.getTargetLiveClock(res);
      let liveBoxHtml = "";
      if (!lc || lc.movesObserved < 2) {
        liveBoxHtml = `
        <div class="chart-box">
          <div class="sec-head"><span>${escapeHtml(t.v3.liveClockTitle)}</span></div>
          <div class="empty-note">${escapeHtml(t.v3.emptyLiveClock)}</div>
        </div>
      `;
      } else {
        const chronoSvg = renderSvgMoveChronogram(lc);
        const recentChipsHtml = lc.moveTimesSec.slice(-6).map((sec, idx, arr) => {
          const globalIdx = lc.moveTimesSec.length - arr.length + idx;
          const moveNo = lc.moveNumbers?.[globalIdx] ?? globalIdx + 2;
          const san = lc.moveSanLabels?.[globalIdx] || "";
          const isSus = lc.isLiveSuspectPacing && lc.roboticStartMove !== null && lc.roboticEndMove !== null && moveNo >= lc.roboticStartMove && moveNo <= lc.roboticEndMove;
          return `<span class="move-chip ${isSus ? "suspect" : ""}">#${moveNo}${san ? ` ${escapeHtml(san)}` : ""} ${sec}s</span>`;
        }).join("");
        const statsText = t.v3.liveClockMoves.replace("{count}", String(lc.movesObserved)).replace("{mean}", String(lc.liveMeanSec ?? "-")).replace("{qcd}", String(lc.liveQCD ?? "-"));
        let pinpointMsg = "";
        if (lc.isLiveSuspectPacing && lc.roboticStartMove !== null && lc.roboticEndMove !== null) {
          if (lc.pauseMoveNumber !== null && lc.detectedPauseSec !== null) {
            pinpointMsg = t.v3.livePinpointToggle.replace("{pauseMove}", String(lc.pauseMoveNumber)).replace("{pauseSec}", String(lc.detectedPauseSec)).replace("{start}", String(lc.roboticStartMove)).replace("{end}", String(lc.roboticEndMove)).replace("{min}", String(lc.roboticMinSec ?? "-")).replace("{max}", String(lc.roboticMaxSec ?? "-"));
          } else {
            pinpointMsg = t.v3.livePinpointFlatline.replace("{start}", String(lc.roboticStartMove)).replace("{end}", String(lc.roboticEndMove)).replace("{count}", String(lc.consecutiveRoboticMoves)).replace("{min}", String(lc.roboticMinSec ?? "-")).replace("{max}", String(lc.roboticMaxSec ?? "-"));
          }
        } else if (lc.isLiveSuspectPacing) {
          pinpointMsg = t.v3.liveClockSuspect;
        }
        const headTitle = lc.isFinishedGame ? t.v3.finishedClockTitle : t.v3.liveClockTitle;
        liveBoxHtml = `
        <div class="chart-box ${lc.isLiveSuspectPacing ? "suspect" : ""}">
          <div class="sec-head">
            <span>${escapeHtml(headTitle)}</span>
            <span>${escapeHtml(statsText)}</span>
          </div>
          ${chronoSvg}
          <div class="move-chips">${recentChipsHtml}</div>
          ${pinpointMsg ? `<div class="live-suspect-msg">${escapeHtml(pinpointMsg)}</div>` : ""}
        </div>
      `;
      }
      let histHtml = "";
      if (res.pacing.gamesAnalyzed >= 4 && res.pacing.bucketDistribution.length >= 7) {
        const dist = res.pacing.bucketDistribution;
        const maxRatio = Math.max(0.25, ...dist);
        const colsHtml = dist.map((ratio, idx) => {
          const hPct = Math.max(6, Math.round(ratio / maxRatio * 100));
          const isRoboticZone = (idx === 3 || idx === 4) && res.signals.movePacing >= 55;
          const color = isRoboticZone ? "linear-gradient(180deg, #fb7185, #e11d48)" : idx <= 1 ? "linear-gradient(180deg, #6ee7b7, #10b981)" : "linear-gradient(180deg, #93c5fd, #3b82f6)";
          const pct = Math.round(ratio * 100);
          return `
            <div class="hist-col-wrap" title="${HIST_LABELS[idx]}: ${pct}%">
              <div class="hist-track">
                <div class="hist-bar" style="height:${hPct}%;background:${color}"></div>
              </div>
              <span class="hist-lbl">${HIST_LABELS[idx]}</span>
            </div>
          `;
        }).join("");
        const entTag = t.v3.pacingEntropyTag.replace("{ent}", String(res.pacing.meanEntropyBits ?? "-")).replace("{qcd}", String(res.pacing.medianQCD ?? "-"));
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
    renderGamesTabHtml(res, lang) {
      const t = TRANSLATIONS[lang];
      if (!res.recentMatches || res.recentMatches.length === 0) {
        return `<div class="tab-pane"><div class="empty-note">${escapeHtml(t.stats.noReviewedGames)}</div></div>`;
      }
      const bandCeiling = res.formats[res.primaryFormat]?.highAccCeiling ?? 92;
      const rowsHtml = res.recentMatches.slice(0, 8).map((m, idx) => {
        const resLbl = lang === "tr" ? m.result === "W" ? "G" : m.result === "L" ? "M" : "B" : m.result;
        const movesCount = Math.max(1, Math.round(m.plies / 2));
        const accHtml = m.accuracy !== null ? `<span class="match-acc ${m.accuracy >= bandCeiling ? "high" : ""}">${m.accuracy}%</span>` : "";
        const pinHtml = m.pinpointMoveRange ? `<span class="match-pin-tag">${escapeHtml(m.pinpointMoveRange)}</span>` : "";
        const href = m.url || `https://www.chess.com/member/${encodeURIComponent(res.displayName)}`;
        const hasSpark = Array.isArray(m.moveTimesSec) && m.moveTimesSec.length >= 4;
        const isExpanded = this.expandedMatchIdx === idx && hasSpark;
        const drawerHtml = isExpanded && m.moveTimesSec ? `<div class="match-drawer">${renderMiniMatchSvgSparkline(
          m.moveTimesSec,
          Boolean(m.pinpointKind),
          idx
        )}</div>` : "";
        return `
          <div class="match-block">
            <div class="match-row">
              <div class="match-left">
                <span class="match-res ${m.result}">${resLbl}</span>
                <span class="match-opp">@${escapeHtml(m.opponentUsername)}</span>
                <span class="match-opp-elo">${m.opponentRating}</span>
              </div>
              <div class="match-right">
                ${pinHtml}
                ${accHtml}
                <span>${movesCount}m</span>
                ${hasSpark ? `<button class="mini-link-btn ${isExpanded ? "active" : ""}" data-expand-match="${idx}" title="${escapeHtml(t.v3.inspectMoves)}">${ICONS.clock}</button>` : ""}
                <a class="mini-link-btn" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(t.v3.pinpointOpenGame)}">${ICONS.external}</a>
              </div>
            </div>
            ${drawerHtml}
          </div>
        `;
      }).join("");
      return `
      <div class="tab-pane">
        <div class="sec-head">
          <span>${escapeHtml(t.v3.recentMatchesTitle)}</span>
          <span>${escapeHtml(t.stats.gamesAnalyzed.replace("{count}", String(res.analyzedGamesCount)))}</span>
        </div>
        <div class="matches-list">${rowsHtml}</div>
      </div>
    `;
    }
    render() {
      if (!this.cardEl || !this.minPillEl) return;
      const lang = this.settings.language;
      const t = TRANSLATIONS[lang];
      if (this.loadingUsername && !this.currentResult) {
        this.cardEl.style.setProperty("--tier-color", "#34d399");
        this.cardEl.style.setProperty("--tier-rgb", "52, 211, 153");
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
      this.cardEl.style.setProperty("--tier-color", theme.color);
      this.cardEl.style.setProperty("--tier-rgb", theme.rgb);
      this.minPillEl.style.setProperty("--tier-color", theme.color);
      this.minPillEl.style.setProperty("--tier-rgb", theme.rgb);
      const fmtData = res.formats[this.selectedFormat] || res.formats[res.primaryFormat];
      const displayProb = eff.probability;
      const arcMax = 108.91;
      const arcFill = Math.max(2.5, Math.min(100, Math.max(0, displayProb)) / 100 * arcMax);
      let alertHtml = "";
      if (res.isBannedFairPlay) {
        alertHtml = `<div class="alert-banner">${ICONS.alertTriangle}<span>${escapeHtml(t.bannedFairPlayBanner)}</span></div>`;
      } else if (this.isAbortWindowOpen && displayProb >= 75) {
        alertHtml = `<div class="alert-banner">${ICONS.alertTriangle}<span>${escapeHtml(t.abortWindowActive)}: ${escapeHtml(
          t.considerAborting
        )}</span></div>`;
      }
      const avatarHtml = res.avatarUrl ? `<img class="avatar" src="${escapeHtml(res.avatarUrl)}" alt="" />` : `<div class="avatar">${escapeHtml(res.displayName.slice(0, 1).toUpperCase())}</div>`;
      const titleBadgeHtml = res.title ? `<span class="title-pill">${escapeHtml(res.title.toUpperCase())}</span>` : "";
      const isoHtml = res.countryCode && res.countryCode.length === 2 ? `<span class="iso-tag">${escapeHtml(res.countryCode.toUpperCase())}</span>` : "";
      const fmtRatingLabel = `${this.selectedFormat.charAt(0).toUpperCase() + this.selectedFormat.slice(1)} ${fmtData.currentRating ?? "-"}`;
      const dialNumHtml = lang === "tr" ? `<small>%</small>${displayProb}` : `${displayProb}<small>%</small>`;
      const minPctText = lang === "tr" ? `%${displayProb}` : `${displayProb}%`;
      const statusLine = this.resolveStatusLine(res, displayProb, lang);
      const clockCountBadge = lc && lc.movesObserved >= 2 ? `<span class="tab-count ${lc.isLiveSuspectPacing ? "alert" : ""}">${lc.movesObserved}</span>` : "";
      const gamesCountBadge = res.suspectPinpoints.length > 0 ? `<span class="tab-count alert">${res.suspectPinpoints.length}</span>` : `<span class="tab-count">${res.recentMatches.length}</span>`;
      const tabContentHtml = this.activeTab === "overview" ? this.renderOverviewTabHtml(res, lang) : this.activeTab === "clock" ? this.renderClockTabHtml(res, lang) : this.renderGamesTabHtml(res, lang);
      const soundIcon = this.settings.soundAlerts ? ICONS.bellOn : ICONS.bellOff;
      const soundTitle = this.settings.soundAlerts ? t.actions.soundOn : t.actions.soundOff;
      setSafeHtml(
        this.cardEl,
        `
      ${this.renderHeaderHtml(lang)}
      <div class="hud-scroll-body">
        ${alertHtml}
        <div class="hero">
          <div class="hero-top">
            <div class="identity">
              <div class="avatar-wrap">
                ${avatarHtml}
                <span class="avatar-dot"></span>
              </div>
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
                  <span class="tier-chip">${escapeHtml(t.tiers[eff.tier].label)}</span>
                  <span>${escapeHtml(fmtRatingLabel)}</span>
                </div>
              </div>
            </div>

            <div class="dial-wrap">
              <svg class="dial-svg" viewBox="0 0 70 62">
                <circle
                  class="dial-track"
                  cx="35"
                  cy="34"
                  r="26"
                  stroke-dasharray="${arcMax.toFixed(2)} 200"
                  transform="rotate(150 35 34)"
                />
                <circle
                  class="dial-fill"
                  cx="35"
                  cy="34"
                  r="26"
                  stroke-dasharray="${arcFill.toFixed(2)} 200"
                  transform="rotate(150 35 34)"
                />
              </svg>
              <div class="dial-center">
                <div class="dial-num">${dialNumHtml}</div>
                <div class="dial-lbl">${escapeHtml(t.cheatProbability)}</div>
              </div>
            </div>
          </div>

          <div class="verdict-callout ${statusLine.cls}">
            <span class="verdict-icon">${statusLine.icon}</span>
            <span>${escapeHtml(statusLine.message)}</span>
          </div>
        </div>

        <div class="view-tabs-shell">
          <div class="view-tabs">
            <button class="view-tab ${this.activeTab === "overview" ? "active" : ""}" data-view-tab="overview">
              <span>${escapeHtml(t.hudTabs.overview)}</span>
            </button>
            <button class="view-tab ${this.activeTab === "clock" ? "active" : ""}" data-view-tab="clock">
              <span>${escapeHtml(t.hudTabs.clock)}</span>
              ${clockCountBadge}
            </button>
            <button class="view-tab ${this.activeTab === "games" ? "active" : ""}" data-view-tab="games">
              <span>${escapeHtml(t.hudTabs.games)}</span>
              ${gamesCountBadge}
            </button>
          </div>
        </div>

        ${tabContentHtml}
      </div>

      <div class="hud-footer">
        <div class="footer-left">
          <button class="footer-btn ${this.copiedFeedback ? "copied" : ""}" data-copy-report="1">
            ${this.copiedFeedback ? ICONS.check : ICONS.copy}
            <span>${escapeHtml(this.copiedFeedback ? t.actions.copiedReport : t.actions.copyReport)}</span>
          </button>
          <button class="footer-btn ${displayProb >= 45 ? "report-warn" : ""}" data-open-report="1" title="${escapeHtml(t.actions.openProfile)}">
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
      <span class="min-pct">${minPctText}</span>
      <span class="min-user">@${escapeHtml(res.displayName)}</span>
    `
      );
      this.bindHeaderEvents();
      this.cardEl.querySelectorAll("button[data-view-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.dataset.viewTab;
          if (tab && tab !== this.activeTab) {
            this.activeTab = tab;
            this.render();
          }
        });
      });
      this.cardEl.querySelectorAll("button[data-fmt]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const fmt = btn.dataset.fmt;
          if (fmt) {
            this.selectedFormat = fmt;
            this.render();
          }
        });
      });
      const toggleBtn = this.cardEl.querySelector('[data-toggle-details="1"]');
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          this.detailsExpanded = !this.detailsExpanded;
          this.render();
        });
      }
      this.cardEl.querySelectorAll("button[data-expand-match]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.expandMatch);
          this.expandedMatchIdx = this.expandedMatchIdx === idx ? null : idx;
          this.render();
        });
      });
      const copyBtn = this.cardEl.querySelector('[data-copy-report="1"]');
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          const text = buildFairPlayEvidenceReport(res, lang, lc);
          void navigator.clipboard?.writeText(text).catch(() => {
          });
          this.copiedFeedback = true;
          this.render();
          setTimeout(() => {
            this.copiedFeedback = false;
            if (!this.isHidden) this.render();
          }, 2e3);
        });
      }
      const reportBtn = this.cardEl.querySelector('[data-open-report="1"]');
      if (reportBtn) {
        reportBtn.addEventListener("click", () => {
          const text = buildFairPlayEvidenceReport(res, lang, lc);
          void navigator.clipboard?.writeText(text).catch(() => {
          });
          window.open(
            `https://www.chess.com/member/${encodeURIComponent(res.displayName)}`,
            "_blank",
            "noopener,noreferrer"
          );
        });
      }
    }
  };

  // src/content/inline-badge.ts
  var BADGE_CLASS = "chess-sentinel-inline-pill";
  var STYLE_ID = "chess-sentinel-inline-style";
  function ensureInlineStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    .${BADGE_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-left: 7px;
      padding: 2px 8px 2px 7px;
      border-radius: 7px;
      background: linear-gradient(180deg, rgba(28, 30, 36, 0.94) 0%, rgba(19, 20, 25, 0.96) 100%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 11px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      line-height: 1.35;
      color: #f4f4f5;
      cursor: pointer;
      user-select: none;
      vertical-align: middle;
      white-space: nowrap;
      transition: transform 0.15s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.15s ease, background 0.15s ease;
      z-index: 20;
    }
    .${BADGE_CLASS}:hover {
      transform: translateY(-0.5px);
      border-color: rgba(255, 255, 255, 0.24);
    }
    .${BADGE_CLASS} .cs-pill-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .${BADGE_CLASS} .cs-pill-prob {
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .${BADGE_CLASS} .cs-pill-wld {
      color: #a1a1aa;
      font-weight: 500;
      font-size: 10.5px;
      padding-left: 6px;
      border-left: 1px solid rgba(255, 255, 255, 0.1);
    }
  `;
    document.head.appendChild(style);
  }
  function findProfileHeaderAnchor() {
    const selectors = [
      ".profile-card-username",
      '[data-cy="profile-header-username"]',
      ".profile-header-details-username",
      ".v5-section-content-wide .profile-card-info h1"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el.parentElement || el;
    }
    return null;
  }
  function findPlayerAnchorContainer(targetSide, surface = "live") {
    if (surface === "profile") {
      return findProfileHeaderAnchor();
    }
    const selectors = targetSide === "top" ? [
      "#board-layout-player-top .user-tagline-component",
      "#board-layout-top .user-tagline-component",
      ".board-layout-top .user-tagline-component",
      ".player-component.player-top .user-tagline-component",
      ".player-top .user-tagline-component",
      "#board-layout-player-top .cc-user-block",
      ".player-top .cc-user-block",
      "#board-layout-player-top .user-tagline-compact-row",
      ".board-layout-top cc-user-username-component",
      "#board-layout-player-top cc-user-username-component",
      ".player-top cc-user-username-component"
    ] : [
      "#board-layout-player-bottom .user-tagline-component",
      "#board-layout-bottom .user-tagline-component",
      ".board-layout-bottom .user-tagline-component",
      ".player-component.player-bottom .user-tagline-component",
      ".player-bottom .user-tagline-component",
      "#board-layout-player-bottom .cc-user-block",
      ".player-bottom .cc-user-block",
      "#board-layout-player-bottom .user-tagline-compact-row",
      ".board-layout-bottom cc-user-username-component",
      "#board-layout-player-bottom cc-user-username-component",
      ".player-bottom cc-user-username-component"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        if (el.tagName.toLowerCase() === "cc-user-username-component" || el.classList.contains("cc-user-username-component") || el.classList.contains("user-tagline-username")) {
          return el.parentElement || el;
        }
        return el;
      }
    }
    return null;
  }
  function renderInlineUsernameBadge(result, targetSide, lang, onClick, options) {
    ensureInlineStyles();
    removeInlineUsernameBadges();
    const container = findPlayerAnchorContainer(targetSide, options?.surface ?? "live");
    if (!container) return;
    const eff = computeEffectiveLiveRisk(result, options?.liveClock);
    const theme = TIER_THEMES[eff.tier];
    const pf = result.formats[result.primaryFormat];
    const probText = lang === "tr" ? `%${eff.probability}` : `${eff.probability}%`;
    const wldText = pf.recentTotal > 0 ? lang === "tr" ? `${pf.recentWins}G ${pf.recentLosses}M` : `${pf.recentWins}W ${pf.recentLosses}L` : lang === "tr" ? `${pf.overallWins}G ${pf.overallLosses}M` : `${pf.overallWins}W ${pf.overallLosses}L`;
    const pill = document.createElement("span");
    pill.className = BADGE_CLASS;
    pill.style.borderColor = theme.border;
    pill.title = lang === "tr" ? `Chess Sentinel: %${eff.probability} (Paneli a\xE7)` : `Chess Sentinel: ${eff.probability}% (Open panel)`;
    const dot = document.createElement("span");
    dot.className = "cs-pill-dot";
    dot.style.background = theme.color;
    dot.style.boxShadow = `0 0 6px rgba(${theme.rgb}, 0.55)`;
    const probSpan = document.createElement("span");
    probSpan.className = "cs-pill-prob";
    probSpan.style.color = theme.color;
    probSpan.textContent = probText;
    const wldSpan = document.createElement("span");
    wldSpan.className = "cs-pill-wld";
    wldSpan.textContent = wldText;
    pill.append(dot, probSpan, wldSpan);
    pill.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    container.appendChild(pill);
  }
  function removeInlineUsernameBadges() {
    document.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
  }

  // src/content/live-clock-monitor.ts
  var TOP_SELECTORS = [
    "#board-layout-player-top",
    "#board-layout-top",
    ".board-layout-player-top",
    ".board-layout-top",
    ".player-component.player-top",
    ".player-top"
  ];
  var BOTTOM_SELECTORS = [
    "#board-layout-player-bottom",
    "#board-layout-bottom",
    ".board-layout-player-bottom",
    ".board-layout-bottom",
    ".player-component.player-bottom",
    ".player-bottom"
  ];
  function quantileSorted(sorted, q) {
    if (sorted.length === 0) return 0;
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== void 0) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  }
  function summarizeLiveMoveTimes(opponent, allMoveTimesSec, allMoveNumbers, allSanLabels, meta) {
    const n = allMoveTimesSec.length;
    const resolvedMoveNums = allMoveNumbers && allMoveNumbers.length === n ? allMoveNumbers : Array.from({ length: n }, (_, idx) => idx + 2);
    const resolvedSan = allSanLabels && allSanLabels.length === n ? allSanLabels : Array.from({ length: n }, () => "");
    const recentTimes = allMoveTimesSec.slice(-24);
    const recentNums = resolvedMoveNums.slice(-24);
    const recentSan = resolvedSan.slice(-24);
    if (n < 4) {
      return {
        opponent,
        movesObserved: n,
        moveTimesSec: recentTimes,
        moveNumbers: recentNums,
        moveSanLabels: recentSan,
        liveMeanSec: null,
        liveQCD: null,
        consecutiveRoboticMoves: 0,
        detectedPauseSec: null,
        pauseMoveNumber: null,
        roboticStartMove: null,
        roboticEndMove: null,
        roboticMinSec: null,
        roboticMaxSec: null,
        isLiveSuspectPacing: false,
        source: meta?.source,
        isFinishedGame: meta?.isFinishedGame,
        gameId: meta?.gameId ?? null
      };
    }
    const evalMoves = n >= 6 ? allMoveTimesSec.slice(3) : allMoveTimesSec;
    const mean = evalMoves.reduce((s, v) => s + v, 0) / evalMoves.length;
    const sorted = [...evalMoves].sort((a, b) => a - b);
    const q1 = quantileSorted(sorted, 0.25);
    const q3 = quantileSorted(sorted, 0.75);
    const liveQCD = q3 + q1 > 0 ? Number(((q3 - q1) / (q3 + q1)).toFixed(2)) : 0;
    let consecutiveRoboticMoves = 0;
    const streakSlice = [];
    for (let i = n - 1; i >= 0; i--) {
      const t = allMoveTimesSec[i];
      if (t >= 2.6 && t <= 8.2) {
        consecutiveRoboticMoves++;
        streakSlice.push(t);
      } else {
        break;
      }
    }
    const roboticStartIdx = consecutiveRoboticMoves > 0 ? n - consecutiveRoboticMoves : -1;
    const roboticStartMove = roboticStartIdx >= 0 ? resolvedMoveNums[roboticStartIdx] : null;
    const roboticEndMove = consecutiveRoboticMoves > 0 ? resolvedMoveNums[n - 1] : null;
    const roboticMinSec = streakSlice.length > 0 ? Number(Math.min(...streakSlice).toFixed(1)) : null;
    const roboticMaxSec = streakSlice.length > 0 ? Number(Math.max(...streakSlice).toFixed(1)) : null;
    let detectedPauseSec = null;
    let pauseMoveNumber = null;
    if (n >= 10) {
      for (let i = 1; i <= n - 8; i++) {
        const t = allMoveTimesSec[i];
        if (t >= 25 && t <= 115) {
          const after = allMoveTimesSec.slice(i + 1);
          const roboticAfter = after.filter((x) => x >= 2.6 && x <= 8.2).length / after.length;
          if (after.length >= 7 && roboticAfter >= 0.88) {
            detectedPauseSec = Number(t.toFixed(1));
            pauseMoveNumber = resolvedMoveNums[i];
            break;
          }
        }
      }
    }
    const hasFastInstinctMove = evalMoves.some((t) => t <= 1.85);
    const hasDeepHumanThink = evalMoves.some((t) => t >= 15);
    const isLiveSuspectPacing = n >= 10 && liveQCD <= 0.17 && consecutiveRoboticMoves >= 8 && !hasFastInstinctMove && !hasDeepHumanThink && mean >= 2.8 && mean <= 8.5 || detectedPauseSec !== null && consecutiveRoboticMoves >= 7 && liveQCD <= 0.18;
    return {
      opponent,
      movesObserved: n,
      moveTimesSec: recentTimes,
      moveNumbers: recentNums,
      moveSanLabels: recentSan,
      liveMeanSec: Number(mean.toFixed(1)),
      liveQCD,
      consecutiveRoboticMoves,
      detectedPauseSec,
      pauseMoveNumber,
      roboticStartMove,
      roboticEndMove,
      roboticMinSec,
      roboticMaxSec,
      isLiveSuspectPacing,
      source: meta?.source,
      isFinishedGame: meta?.isFinishedGame,
      gameId: meta?.gameId ?? null
    };
  }
  var LiveMatchClockMonitor = class {
    onUpdate;
    timer = null;
    targetOpponent = null;
    targetSide = "top";
    moveTimesSec = [];
    moveNumbers = [];
    moveSanLabels = [];
    source = "live_dom";
    isFinishedGame = false;
    gameId = null;
    wasTargetTurn = false;
    turnStartMs = 0;
    lastKnownPlyCount = 0;
    constructor(onUpdate) {
      this.onUpdate = onUpdate;
    }
    setTarget(opponent, side, gameId = null) {
      const normalized = opponent.toLowerCase();
      if (this.targetOpponent?.toLowerCase() !== normalized || this.targetSide !== side || gameId && this.gameId && gameId !== this.gameId) {
        this.targetOpponent = opponent;
        this.targetSide = side;
        this.gameId = gameId;
        this.moveTimesSec = [];
        this.moveNumbers = [];
        this.moveSanLabels = [];
        this.source = "live_dom";
        this.isFinishedGame = false;
        this.wasTargetTurn = false;
        this.turnStartMs = 0;
        this.lastKnownPlyCount = this.countDomPlies();
      } else if (gameId) {
        this.gameId = gameId;
      }
      this.ensureRunning();
    }
    hydrateServerMoves(opponent, timesSec, moveNumbers, isFinished, gameId) {
      if (!this.targetOpponent || this.targetOpponent.toLowerCase() !== opponent.toLowerCase()) {
        return;
      }
      if (timesSec.length === 0 || timesSec.length < this.moveTimesSec.length) {
        return;
      }
      this.moveTimesSec = [...timesSec];
      this.moveNumbers = moveNumbers.length === timesSec.length ? [...moveNumbers] : Array.from({ length: timesSec.length }, (_, idx) => idx + 2);
      this.moveSanLabels = Array.from({ length: timesSec.length }, () => "");
      this.source = "server_callback";
      this.isFinishedGame = isFinished;
      this.gameId = gameId;
      const snap = this.getLatestTelemetry();
      if (snap) this.onUpdate(snap);
    }
    stop() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      this.targetOpponent = null;
      this.moveTimesSec = [];
      this.moveNumbers = [];
      this.moveSanLabels = [];
      this.isFinishedGame = false;
      this.gameId = null;
      this.wasTargetTurn = false;
    }
    getLatestTelemetry() {
      if (!this.targetOpponent || this.moveTimesSec.length === 0) return null;
      return summarizeLiveMoveTimes(
        this.targetOpponent,
        this.moveTimesSec,
        this.moveNumbers,
        this.moveSanLabels,
        {
          source: this.source,
          isFinishedGame: this.isFinishedGame,
          gameId: this.gameId
        }
      );
    }
    ensureRunning() {
      if (this.timer) return;
      this.timer = setInterval(() => this.sampleClock(), 250);
    }
    findZone(side) {
      const selectors = side === "top" ? TOP_SELECTORS : BOTTOM_SELECTORS;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    }
    getMoveNodes() {
      return document.querySelectorAll("[data-ply], .move .node, wc-simple-move-list .node");
    }
    countDomPlies() {
      return this.getMoveNodes().length;
    }
    readLatestPlayedSan() {
      const nodes = this.getMoveNodes();
      if (nodes.length === 0) return "";
      const last = nodes[nodes.length - 1];
      const txt = (last.textContent || "").replace(/\s+/g, "").trim();
      return txt.slice(0, 10);
    }
    isZoneTurnActive(zone) {
      if (zone.querySelector(
        '.clock-player-turn, .clock-component.clock-player-turn, [class*="clock-player-turn"]'
      )) {
        return true;
      }
      const clockComp = zone.querySelector('.clock-component, [data-cy="clock-time"]');
      if (clockComp && clockComp.className && String(clockComp.className).includes("player-turn")) {
        return true;
      }
      return false;
    }
    sampleClock() {
      if (!this.targetOpponent) return;
      if (document.querySelector(
        '.game-over-modal-content, [data-cy="game-over-modal"], .board-modal-container-container'
      )) {
        this.wasTargetTurn = false;
        return;
      }
      const targetZone = this.findZone(this.targetSide);
      const otherZone = this.findZone(this.targetSide === "top" ? "bottom" : "top");
      if (!targetZone || !otherZone) return;
      const isTargetTurn = this.isZoneTurnActive(targetZone);
      const isOtherTurn = this.isZoneTurnActive(otherZone);
      const currentPlies = this.countDomPlies();
      if (currentPlies <= 2 && this.lastKnownPlyCount >= 8) {
        this.moveTimesSec = [];
        this.moveNumbers = [];
        this.moveSanLabels = [];
        this.wasTargetTurn = false;
        this.turnStartMs = 0;
      }
      this.lastKnownPlyCount = currentPlies;
      const nowMs = performance.now();
      if (isTargetTurn && !this.wasTargetTurn) {
        this.wasTargetTurn = true;
        this.turnStartMs = nowMs;
      } else if (!isTargetTurn && this.wasTargetTurn && isOtherTurn) {
        this.wasTargetTurn = false;
        const elapsedSec = Number(((nowMs - this.turnStartMs) / 1e3).toFixed(2));
        if (elapsedSec >= 0.15 && elapsedSec <= 180 && currentPlies >= 3) {
          const fullMoveNo = Math.max(
            (this.moveNumbers[this.moveNumbers.length - 1] ?? 1) + 1,
            Math.ceil(currentPlies / 2)
          );
          const san = this.readLatestPlayedSan();
          this.moveTimesSec.push(elapsedSec);
          this.moveNumbers.push(fullMoveNo);
          this.moveSanLabels.push(san);
          if (this.moveTimesSec.length > 60) {
            this.moveTimesSec.shift();
            this.moveNumbers.shift();
            this.moveSanLabels.shift();
          }
          this.onUpdate(
            summarizeLiveMoveTimes(
              this.targetOpponent,
              this.moveTimesSec,
              this.moveNumbers,
              this.moveSanLabels,
              {
                source: this.source,
                isFinishedGame: false,
                gameId: this.gameId
              }
            )
          );
        }
      }
    }
  };

  // src/content/index.ts
  var SentinelContentController = class {
    settings = { ...DEFAULT_SETTINGS };
    hud = null;
    detector = null;
    clockMonitor = null;
    lastCtx = null;
    cachedCallback = null;
    targetSide = "top";
    activeUsername = null;
    latestResult = null;
    alertedUsernames = /* @__PURE__ */ new Set();
    liveAlertedUsernames = /* @__PURE__ */ new Set();
    async init() {
      this.settings = await getSettings();
      this.hud = new SentinelHudOverlay(this.settings, {
        onSwapTarget: () => this.swapTargetSide(),
        onRefresh: () => {
          if (this.activeUsername) {
            void this.analyzeTarget(this.activeUsername, this.lastCtx?.detectedFormat, true);
          } else {
            this.detector?.forceRecheck();
          }
        },
        onToggleLanguage: (nextLang) => {
          void this.persistSettings({ language: nextLang });
        },
        onToggleSound: (enabled) => {
          void this.persistSettings({ soundAlerts: enabled });
        },
        onToggleWatchlist: (result) => {
          void this.handleWatchlistToggle(result);
        },
        onSavePosition: (pos) => {
          void this.persistSettings({ hudPosition: pos });
        }
      });
      this.clockMonitor = new LiveMatchClockMonitor((telemetry) => {
        this.handleLiveClockUpdate(telemetry);
      });
      this.detector = new ChessComOpponentDetector(
        (ctx) => this.handleMatchContext(ctx),
        () => this.handleMatchLeft()
      );
      this.detector.start();
      this.setupKeyboardShortcut();
      this.setupStorageSync();
      this.setupRuntimeMessages();
    }
    handleLiveClockUpdate(telemetry) {
      this.hud?.updateLiveClock(telemetry);
      if (this.latestResult && this.settings.showInlineBadge) {
        renderInlineUsernameBadge(
          this.latestResult,
          this.targetSide,
          this.settings.language,
          () => this.hud?.expandFromBadge(),
          {
            liveClock: telemetry,
            surface: this.lastCtx?.surface ?? "live"
          }
        );
      }
      const userKey = telemetry.opponent.toLowerCase();
      if (telemetry.isLiveSuspectPacing && !telemetry.isFinishedGame && this.settings.soundAlerts && !this.liveAlertedUsernames.has(userKey)) {
        this.liveAlertedUsernames.add(userKey);
        playRiskAlertChime(true);
      }
    }
    async persistSettings(patch) {
      this.settings = await updateSettings(patch);
      this.hud?.updateSettings(this.settings);
      if (this.latestResult && this.settings.showInlineBadge) {
        renderInlineUsernameBadge(
          this.latestResult,
          this.targetSide,
          this.settings.language,
          () => this.hud?.expandFromBadge(),
          {
            liveClock: this.clockMonitor?.getLatestTelemetry(),
            surface: this.lastCtx?.surface ?? "live"
          }
        );
      }
    }
    applyCallbackHydrationToSide(target, side) {
      if (!this.cachedCallback || !this.clockMonitor) return;
      const cb = this.cachedCallback;
      const matchTop = cb.topPlayer?.toLowerCase() === target.toLowerCase();
      const matchBottom = cb.bottomPlayer?.toLowerCase() === target.toLowerCase();
      if (matchTop) {
        this.clockMonitor.hydrateServerMoves(
          target,
          cb.topTimesSec,
          cb.topMoveNumbers,
          cb.isFinished,
          cb.gameId
        );
      } else if (matchBottom) {
        this.clockMonitor.hydrateServerMoves(
          target,
          cb.bottomTimesSec,
          cb.bottomMoveNumbers,
          cb.isFinished,
          cb.gameId
        );
      } else if (side === "top" && cb.topTimesSec.length > 0) {
        this.clockMonitor.hydrateServerMoves(
          target,
          cb.topTimesSec,
          cb.topMoveNumbers,
          cb.isFinished,
          cb.gameId
        );
      } else if (side === "bottom" && cb.bottomTimesSec.length > 0) {
        this.clockMonitor.hydrateServerMoves(
          target,
          cb.bottomTimesSec,
          cb.bottomMoveNumbers,
          cb.isFinished,
          cb.gameId
        );
      }
    }
    async fetchAndHydrateGameCallback(gameId, target) {
      if (this.cachedCallback?.gameId === gameId) {
        this.applyCallbackHydrationToSide(target, this.targetSide);
        return;
      }
      try {
        const resp = await chrome.runtime.sendMessage({
          type: "FETCH_GAME_CALLBACK",
          gameId
        });
        if (!resp?.ok || !resp.data) return;
        this.cachedCallback = resp.data;
        if (this.lastCtx?.gameId === gameId) {
          this.hud?.setAbortWindow(resp.data.isAbortable);
          this.hud?.setSurface(resp.data.isFinished ? "game" : "live");
          if (this.activeUsername) {
            this.applyCallbackHydrationToSide(this.activeUsername, this.targetSide);
          }
        }
      } catch {
      }
    }
    swapTargetSide() {
      if (!this.lastCtx || this.lastCtx.surface === "profile") return;
      const nextSide = this.targetSide === "top" ? "bottom" : "top";
      const candidate = nextSide === "top" ? this.lastCtx.topPlayer || this.cachedCallback?.topPlayer || null : this.lastCtx.bottomPlayer || this.cachedCallback?.bottomPlayer || null;
      if (!candidate) return;
      this.targetSide = nextSide;
      this.clockMonitor?.setTarget(candidate, nextSide, this.lastCtx.gameId);
      this.applyCallbackHydrationToSide(candidate, nextSide);
      void this.analyzeTarget(candidate, this.lastCtx.detectedFormat, false);
    }
    handleMatchContext(ctx) {
      const prevOpponent = this.lastCtx?.opponent?.toLowerCase();
      const prevGameId = this.lastCtx?.gameId;
      this.lastCtx = ctx;
      if (ctx.gameId !== prevGameId) {
        this.cachedCallback = null;
      }
      if (ctx.opponent.toLowerCase() !== prevOpponent) {
        this.targetSide = ctx.opponentSide;
      }
      const target = ctx.surface === "profile" ? ctx.opponent : this.targetSide === "bottom" ? ctx.bottomPlayer || ctx.opponent : ctx.topPlayer || ctx.opponent;
      if (ctx.surface === "profile") {
        this.clockMonitor?.stop();
      } else {
        this.clockMonitor?.setTarget(target, this.targetSide, ctx.gameId);
        if (ctx.gameId) {
          void this.fetchAndHydrateGameCallback(ctx.gameId, target);
        }
      }
      this.hud?.setAbortWindow(ctx.isAbortWindowOpen);
      this.hud?.setSurface(ctx.surface);
      if (target.toLowerCase() !== this.activeUsername?.toLowerCase()) {
        void this.analyzeTarget(target, ctx.detectedFormat, false);
      }
    }
    handleMatchLeft() {
      this.activeUsername = null;
      this.latestResult = null;
      this.lastCtx = null;
      this.cachedCallback = null;
      this.clockMonitor?.stop();
      removeInlineUsernameBadges();
      this.hud?.hide();
    }
    async analyzeTarget(username, preferredFormat, forceRefresh) {
      this.activeUsername = username;
      const isSelfProfile = Boolean(
        this.lastCtx?.surface === "profile" && this.lastCtx.isSelfProfile
      );
      const shouldAutoOpenHud = this.settings.autoShowHud && !isSelfProfile || forceRefresh;
      if (shouldAutoOpenHud) {
        this.hud?.showLoading(username);
      }
      try {
        const msg = {
          type: "ANALYZE_PLAYER",
          username,
          preferredFormat: preferredFormat || this.cachedCallback?.detectedFormat,
          forceRefresh
        };
        const response = await chrome.runtime.sendMessage(msg);
        if (this.activeUsername?.toLowerCase() !== username.toLowerCase()) return;
        if (!response || !response.ok || !response.result) {
          if (shouldAutoOpenHud) {
            this.hud?.showError(username, response?.error || "Could not load Chess.com data");
          }
          return;
        }
        const result = response.result;
        this.latestResult = result;
        const watchlist = await getWatchlist();
        const isWatched = watchlist.some(
          (w) => w.username.toLowerCase() === result.username.toLowerCase()
        );
        if (this.settings.soundAlerts && !isSelfProfile && !this.alertedUsernames.has(result.username.toLowerCase()) && (result.probability >= 75 || result.isBannedFairPlay || isWatched)) {
          this.alertedUsernames.add(result.username.toLowerCase());
          playRiskAlertChime(result.probability >= 88 || result.isBannedFairPlay);
        }
        const surface = this.lastCtx?.surface ?? "live";
        const liveSnap = this.clockMonitor?.getLatestTelemetry() ?? null;
        if (shouldAutoOpenHud) {
          this.hud?.showResult(
            result,
            isWatched,
            this.lastCtx?.isAbortWindowOpen ?? false,
            surface
          );
          if (liveSnap) this.hud?.updateLiveClock(liveSnap);
        }
        if (this.settings.showInlineBadge) {
          renderInlineUsernameBadge(
            result,
            this.targetSide,
            this.settings.language,
            () => {
              this.hud?.showResult(
                result,
                isWatched,
                this.lastCtx?.isAbortWindowOpen ?? false,
                surface
              );
              const snap = this.clockMonitor?.getLatestTelemetry() ?? null;
              if (snap) this.hud?.updateLiveClock(snap);
              this.hud?.expandFromBadge();
            },
            { liveClock: liveSnap, surface }
          );
        } else {
          removeInlineUsernameBadges();
        }
      } catch {
      }
    }
    async handleWatchlistToggle(result) {
      try {
        const pf = result.formats[result.primaryFormat];
        const msg = {
          type: "TOGGLE_WATCHLIST",
          entry: {
            username: result.username,
            initialProbability: result.probability,
            ratingAtSave: pf.currentRating,
            format: result.primaryFormat,
            avatarUrl: result.avatarUrl,
            isBannedFairPlay: result.isBannedFairPlay,
            accountStatus: result.accountStatus
          }
        };
        const resp = await chrome.runtime.sendMessage(msg);
        if (resp && resp.ok) {
          this.hud?.setWatchedState(Boolean(resp.added));
        }
      } catch {
      }
    }
    setupKeyboardShortcut() {
      window.addEventListener("keydown", (e) => {
        if (e.altKey && (e.key === "s" || e.key === "S")) {
          e.preventDefault();
          if (!this.latestResult && this.lastCtx?.opponent) {
            void this.analyzeTarget(this.lastCtx.opponent, this.lastCtx.detectedFormat, true);
          } else {
            this.hud?.toggleVisibility();
          }
        }
      });
    }
    setupStorageSync() {
      if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
      chrome.storage.onChanged.addListener(() => {
        void (async () => {
          this.settings = await getSettings();
          this.hud?.updateSettings(this.settings);
          if (!this.settings.showInlineBadge) {
            removeInlineUsernameBadges();
          } else if (this.latestResult) {
            renderInlineUsernameBadge(
              this.latestResult,
              this.targetSide,
              this.settings.language,
              () => this.hud?.expandFromBadge(),
              {
                liveClock: this.clockMonitor?.getLatestTelemetry(),
                surface: this.lastCtx?.surface ?? "live"
              }
            );
          }
        })();
      });
    }
    setupRuntimeMessages() {
      if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return;
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg.type === "TOGGLE_HUD_FROM_POPUP") {
          if (!this.latestResult && this.lastCtx?.opponent) {
            void this.analyzeTarget(this.lastCtx.opponent, this.lastCtx.detectedFormat, true);
          } else {
            this.hud?.toggleVisibility();
          }
          sendResponse({ ok: true });
        } else if (msg.type === "GET_ACTIVE_MATCH_STATE") {
          sendResponse({
            ok: true,
            activeUsername: this.activeUsername,
            result: this.latestResult,
            liveClock: this.clockMonitor?.getLatestTelemetry() ?? null
          });
        }
        return false;
      });
    }
  };
  var controller = new SentinelContentController();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void controller.init());
  } else {
    void controller.init();
  }
})();
