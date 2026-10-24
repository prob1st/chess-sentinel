"use strict";
(() => {
  // src/core/calibration.ts
  var TIER_THEMES = {
    low: {
      id: "low",
      color: "#10b981",
      accentBg: "rgba(16, 185, 129, 0.14)",
      glow: "rgba(16, 185, 129, 0.38)",
      border: "rgba(16, 185, 129, 0.35)"
    },
    guarded: {
      id: "guarded",
      color: "#38bdf8",
      accentBg: "rgba(56, 189, 248, 0.14)",
      glow: "rgba(56, 189, 248, 0.35)",
      border: "rgba(56, 189, 248, 0.35)"
    },
    elevated: {
      id: "elevated",
      color: "#f59e0b",
      accentBg: "rgba(245, 158, 11, 0.15)",
      glow: "rgba(245, 158, 11, 0.42)",
      border: "rgba(245, 158, 11, 0.40)"
    },
    high: {
      id: "high",
      color: "#f97316",
      accentBg: "rgba(249, 115, 22, 0.16)",
      glow: "rgba(249, 115, 22, 0.46)",
      border: "rgba(249, 115, 22, 0.45)"
    },
    critical: {
      id: "critical",
      color: "#ef4444",
      accentBg: "rgba(239, 68, 68, 0.18)",
      glow: "rgba(239, 68, 68, 0.55)",
      border: "rgba(239, 68, 68, 0.55)"
    },
    banned: {
      id: "banned",
      color: "#f43f5e",
      accentBg: "rgba(244, 63, 94, 0.22)",
      glow: "rgba(244, 63, 94, 0.65)",
      border: "rgba(244, 63, 94, 0.70)"
    }
  };
  var DEFAULT_SETTINGS = {
    language: "tr",
    autoShowHud: true,
    compactMode: false,
    showInlineBadge: true,
    ratedOnly: true,
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
  var VALID_USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,25}$/;
  function sanitizeChessUsername(raw) {
    if (!raw) return null;
    const cleaned = raw.replace(/\(?\d{3,4}\)?/g, " ").replace(/\b(GM|WGM|IM|WIM|FM|WFM|NM|WNM|CM|WCM)\b/g, " ").trim().split(/\s+/)[0]?.trim();
    if (!cleaned) return null;
    const lower = cleaned.toLowerCase();
    if (INVALID_NAMES.has(lower)) return null;
    if (lower.startsWith("guest") && /^guest\d+$/i.test(lower)) return null;
    if (!VALID_USERNAME_REGEX.test(cleaned)) return null;
    return cleaned;
  }
  function isChessComBoardUrl(url) {
    return /chess\.com\/(game|play\/online|live|analysis\/game|events)/i.test(url);
  }
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
      }, 650);
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
        "wc-chess-board, chess-board, #board-layout-main, .board-layout-main, #board-layout-player-top, .board-layout-top"
      );
    }
    extractNameFromElement(el) {
      if (!el) return null;
      if (el.shadowRoot) {
        const shadowLink = el.shadowRoot.querySelector('a[href*="/member/"]');
        if (shadowLink) {
          const m = (shadowLink.getAttribute("href") || "").match(/\/member\/([^/?#]+)/i);
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
      if (el.tagName === "A") {
        const m = (el.getAttribute("href") || "").match(/\/member\/([^/?#]+)/i);
        const s = sanitizeChessUsername(m?.[1]);
        if (s) return s;
      }
      const nestedMemberLink = el.querySelector('a[href*="/member/"]');
      if (nestedMemberLink) {
        const m = (nestedMemberLink.getAttribute("href") || "").match(/\/member\/([^/?#]+)/i);
        const s = sanitizeChessUsername(m?.[1]);
        if (s) return s;
      }
      const attrName = el.getAttribute("username") || el.getAttribute("data-username") || el.getAttribute("data-player-username");
      if (attrName) {
        const s = sanitizeChessUsername(attrName);
        if (s) return s;
      }
      const nestedUser = el.querySelector(
        '[data-test-element="user-tagline-username"], .cc-user-username-component, .user-tagline-username, .user-tagline-compact-username, [class*="username"]'
      );
      if (nestedUser) {
        const s = sanitizeChessUsername(nestedUser.textContent);
        if (s) return s;
      }
      return sanitizeChessUsername(el.textContent);
    }
    extractZonePlayer(zoneSelector) {
      const zone = document.querySelector(zoneSelector);
      if (!zone) return null;
      const candidateSelectors = [
        "cc-user-username-component",
        '[data-test-element="user-tagline-username"]',
        ".cc-user-username-component",
        ".user-tagline-username",
        ".user-tagline-compact-username",
        'a[href*="/member/"]',
        '[class*="username"]'
      ];
      for (const sel of candidateSelectors) {
        const el = zone.querySelector(sel);
        const name = this.extractNameFromElement(el);
        if (name) return name;
      }
      return null;
    }
    extractPlayers() {
      let topPlayer = this.extractZonePlayer("#board-layout-player-top") || this.extractZonePlayer("#board-layout-top") || this.extractZonePlayer(".board-layout-player-top") || this.extractZonePlayer(".board-layout-top");
      let bottomPlayer = this.extractZonePlayer("#board-layout-player-bottom") || this.extractZonePlayer("#board-layout-bottom") || this.extractZonePlayer(".board-layout-player-bottom") || this.extractZonePlayer(".board-layout-bottom");
      if (!topPlayer || !bottomPlayer) {
        const candidates = Array.from(
          document.querySelectorAll(
            'cc-user-username-component, [data-test-element="user-tagline-username"], .user-tagline-username, .user-tagline-compact-username'
          )
        ).filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 10 && rect.height > 6 && rect.top >= 0 && rect.top < window.innerHeight;
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
        "#board-layout-player-top .clock-time-monospace, .board-layout-top .clock-time-monospace, .clock-component"
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
      if (!this.hasBoardOnPage()) {
        if (this.lastSignature !== "") {
          this.lastSignature = "";
          this.onMatchLeft();
        }
        return;
      }
      const { topPlayer, bottomPlayer } = this.extractPlayers();
      const opponent = topPlayer;
      if (!opponent) return;
      const detectedFormat = this.detectActiveFormat();
      const isAbortWindowOpen = this.detectAbortWindow();
      const sig = `${opponent.toLowerCase()}|${(bottomPlayer || "").toLowerCase()}|${isAbortWindowOpen ? "1" : "0"}`;
      if (sig === this.lastSignature) return;
      this.lastSignature = sig;
      this.onContextChange({
        topPlayer,
        bottomPlayer,
        opponent,
        detectedFormat,
        isAbortWindowOpen,
        url: window.location.href
      });
    }
  };

  // src/i18n/translations.ts
  var TRANSLATIONS = {
    tr: {
      appName: "Chess Sentinel",
      appSubtitle: "Canl\u0131 Hile Olas\u0131l\u0131\u011F\u0131 & Adil Oyun Radar\u0131",
      cheatProbability: "H\u0130LE OLASILI\u011EI",
      scanningOpponent: "Rakip telemetrisi analiz ediliyor\u2026",
      waitingForMatch: "Rakip bekleniyor\u2026",
      abortWindowActive: "G\xFCvenli \u0130ptal (Abort) Penceresi A\xE7\u0131k",
      safeToPlay: "Normal oyuncu profili \u2014 g\xFCvenle oynanabilir",
      cautionAdvised: "Ola\u011Fand\u0131\u015F\u0131 sinyaller var \u2014 dikkatli oynay\u0131n",
      considerAborting: "Y\xFCksek hile / smurf riski \u2014 iptal (abort) d\xFC\u015F\xFCn\xFCn",
      bannedFairPlayBanner: "CHESS.COM TARAFINDAN H\u0130LEDEN KAPATILDI",
      confidenceLabel: {
        low: "D\xFC\u015F\xFCk Veri G\xFCveni",
        medium: "Orta Veri G\xFCveni",
        high: "Y\xFCksek Veri G\xFCveni"
      },
      tiers: {
        low: { label: "D\xDC\u015E\xDCK R\u0130SK", summary: "Do\u011Fal insan istatistikleri" },
        guarded: { label: "NORMAL / \u0130ZLE", summary: "Hafif form art\u0131\u015F\u0131, normal s\u0131n\u0131rda" },
        elevated: { label: "\u015E\xDCPHEL\u0130", summary: "Birden fazla ola\u011Fand\u0131\u015F\u0131 metrik" },
        high: { label: "Y\xDCKSEK R\u0130SK", summary: "G\xFC\xE7l\xFC motor veya smurf sinyalleri" },
        critical: { label: "KR\u0130T\u0130K H\u0130LE R\u0130SK\u0130", summary: "A\u015F\u0131r\u0131 istatistiksel anomali!" },
        banned: { label: "YASAKLANDI (%100)", summary: "Adil Oyun (Fair Play) ihlali" }
      },
      signals: {
        sectionTitle: "6-S\u0130NYALL\u0130 ADL\u0130 TELEMETR\u0130",
        recentWinrate: "Son Ma\xE7 Kazanma Anomalisi",
        overallWinrate: "Genel Glicko Sapmas\u0131",
        accuracyAnomaly: "CAPS2 Do\u011Fruluk Sapmas\u0131",
        movePacing: "Motor Hamle Ritmi (%clk)",
        eloVelocity: "Elo S\u0131\xE7rama H\u0131z\u0131",
        accountTrust: "Hesap Ya\u015F\u0131 & G\xFCven Riski"
      },
      stats: {
        accountAge: "Hesap Ya\u015F\u0131",
        daysShort: "g\xFCn",
        monthsShort: "ay",
        yearsShort: "y\u0131l",
        recentRecord: "Son Form",
        avgAccuracy: "Ort. Do\u011Fruluk",
        expectedShort: "beklenen",
        moveCV: "Hamle Ritmi CV",
        elo7d: "7G Elo Fark\u0131",
        streak: "Seri",
        noReviewedGames: "Analizli ma\xE7 yok",
        gamesAnalyzed: "{count} ma\xE7 incelendi"
      },
      actions: {
        swapTarget: "\xDCst / Alt Oyuncu De\u011Fi\u015Ftir",
        watchSuspect: "\u015E\xFCpheliyi Takibe Al",
        watchingSuspect: "Takipte (Ban \u0130zleniyor)",
        refresh: "Yeniden Analiz Et",
        minimize: "K\xFC\xE7\xFClt (Alt+S)",
        expand: "B\xFCy\xFCt",
        openProfile: "Chess.com Profilini A\xE7",
        toggleDetails: "Detayl\u0131 Telemetriyi G\xF6ster",
        hideDetails: "Detaylar\u0131 Gizle"
      },
      popup: {
        tabScanner: "Oyuncu Tara",
        tabWatchlist: "Ban Takibi",
        tabSettings: "Ayarlar",
        searchPlaceholder: "Chess.com kullan\u0131c\u0131 ad\u0131 yaz\u0131n (\xF6rn. hikaru)\u2026",
        scanBtn: "Analiz Et",
        recentScansTitle: "SON \u0130NCELENEN RAK\u0130PLER",
        emptyScans: "Hen\xFCz incelenen rakip yok. Chess.com'da ma\xE7a girin veya yukar\u0131dan arat\u0131n.",
        watchlistTitle: "\u015E\xDCPHEL\u0130 & BAN TAK\u0130P L\u0130STES\u0130",
        checkBansBtn: "Ban Durumlar\u0131n\u0131 Kontrol Et",
        checkingBans: "Kontrol ediliyor\u2026",
        emptyWatchlist: "Takip listeniz bo\u015F. \u015E\xFCpheli rakipleri HUD \xFCzerindeki g\xF6z ikonuyla ekleyin.",
        bannedTag: "BANLANDI (H\u0130LE)",
        activeTag: "Aktif Hesap",
        addedOn: "\u0130lk skor: %{prob}",
        removeBtn: "Kald\u0131r",
        settingsLanguage: "Aray\xFCz Dili / Language",
        settingsAutoHud: "Ma\xE7 Ba\u015Flad\u0131\u011F\u0131nda HUD Pop-up A\xE7",
        settingsAutoHudDesc: "Yeni rakip bulundu\u011Funda Chess.com ekran\u0131nda y\xFCzen analiz kart\u0131n\u0131 otomatik a\xE7ar.",
        settingsInlineBadge: "\u0130sim Yan\u0131 Mini % Rozeti",
        settingsInlineBadgeDesc: "Rakibin kullan\u0131c\u0131 ad\u0131n\u0131n hemen yan\u0131na renkli hile olas\u0131l\u0131\u011F\u0131 ve G/M/B rozeti ekler.",
        settingsCompact: "Kompakt Pop-up Modu",
        settingsCompactDesc: "HUD kart\u0131n\u0131 varsay\u0131lan olarak daralt\u0131lm\u0131\u015F g\xF6r\xFCn\xFCmde ba\u015Flat\u0131r.",
        settingsRatedOnly: "Sadece Puanl\u0131 (Rated) Ma\xE7lar",
        settingsRatedOnlyDesc: "Arkada\u015Fl\u0131k / puans\u0131z ma\xE7lar\u0131 olas\u0131l\u0131k hesab\u0131ndan hari\xE7 tutar.",
        settingsSensitivity: "Alg\u0131lama Hassasiyeti",
        sensitivityConservative: "Esnek",
        sensitivityBalanced: "Dengeli (\xD6nerilen)",
        sensitivityStrict: "S\u0131k\u0131",
        toggleInPageHud: "Aktif Sekmede HUD G\xF6ster/Gizle",
        privacyNote: "100% Gizli \u2022 S\u0131f\u0131r veri toplama \u2022 Yaln\u0131zca resmi Chess.com PubAPI kullan\u0131l\u0131r."
      },
      flags: {
        banned_fair_play: "Hesap Chess.com Adil Oyun (Hile) ihlali nedeniyle kapat\u0131lm\u0131\u015F!",
        verified_title: "Do\u011Frulanm\u0131\u015F FIDE unvanl\u0131 usta ({title}) \u2014 elit istatistik kalibrasyonu uyguland\u0131",
        fresh_high_elo: "\xC7ok yeni hesap ({days} g\xFCnl\xFCk) olmas\u0131na ra\u011Fmen {rating} Elo seviyesinde",
        fresh_account: "Yeni a\xE7\u0131lm\u0131\u015F hesap ({days} g\xFCnl\xFCk) \u2014 smurf veya yeni hile hesab\u0131 riski",
        extreme_recent_wr: "Son {games} puanl\u0131 ma\xE7ta %{wr} kazanma oran\u0131 (ola\u011Fand\u0131\u015F\u0131 \xFCst\xFCnl\xFCk)",
        elevated_recent_wr: "Son {games} ma\xE7ta %{wr} kazanma oran\u0131 (Glicko dengesinin \xFCzerinde)",
        accuracy_excess: "Elo band\u0131 beklentisinin (+%{excess}) \xFCzerinde ortalama do\u011Fruluk (%{avg})",
        accuracy_spikes: "\u0130ncelenen {games} ma\xE7\u0131n %{rate} kadar\u0131nda tavan do\u011Fruluk (\u2265%{ceil})",
        robotic_pacing: "Robotik hamle s\xFCresi da\u011F\u0131l\u0131m\u0131 tespit edildi (Medyan CV: {cv}, s\u0131f\u0131ra yak\u0131n anl\u0131k hamle)",
        midgame_toggle: "{count} ma\xE7ta oyun ortas\u0131 uzun duraksama sonras\u0131 mekanik seri (motor a\xE7ma imzas\u0131)",
        elo_surge: "Son 7 g\xFCnde +{delta} Elo dikey puan s\u0131\xE7ramas\u0131",
        hot_streak: "\xDCst \xFCste {streak} puanl\u0131 galibiyet serisinde",
        tactics_gap: "Canl\u0131 puan ({rating}) ile bulmaca puan\u0131 ({tactics}) aras\u0131nda u\xE7urum var",
        natural_human: "Do\u011Fal insan hamle s\xFCresi varyans\u0131 (CV: {cv}) ve dengeli kazanma oran\u0131",
        established_veteran: "K\xF6kl\xFC hesap ({years}+ y\u0131ll\u0131k ge\xE7mi\u015F, {total} toplam ma\xE7)"
      }
    },
    en: {
      appName: "Chess Sentinel",
      appSubtitle: "Live Cheat Probability & Fair-Play Radar",
      cheatProbability: "CHEAT PROBABILITY",
      scanningOpponent: "Analyzing opponent telemetry\u2026",
      waitingForMatch: "Waiting for opponent\u2026",
      abortWindowActive: "Safe Abort Window Open",
      safeToPlay: "Normal player patterns \u2014 safe to play",
      cautionAdvised: "Elevated anomaly signals \u2014 play with caution",
      considerAborting: "High engine / smurf probability \u2014 consider aborting",
      bannedFairPlayBanner: "CLOSED BY CHESS.COM FOR FAIR PLAY VIOLATIONS",
      confidenceLabel: {
        low: "Low Sample Confidence",
        medium: "Medium Confidence",
        high: "High Telemetry Confidence"
      },
      tiers: {
        low: { label: "LOW RISK", summary: "Organic human patterns" },
        guarded: { label: "GUARDED", summary: "Slight hot streak, within normal bounds" },
        elevated: { label: "SUSPICIOUS", summary: "Multiple elevated statistical anomalies" },
        high: { label: "HIGH RISK", summary: "Strong engine assistance or smurf signals" },
        critical: { label: "CRITICAL CHEAT RISK", summary: "Extreme multi-signal anomaly!" },
        banned: { label: "BANNED (100%)", summary: "Confirmed Fair Play violation" }
      },
      signals: {
        sectionTitle: "6-SIGNAL FORENSIC TELEMETRY",
        recentWinrate: "Recent Win-Rate Anomaly",
        overallWinrate: "Lifetime Glicko Deviation",
        accuracyAnomaly: "CAPS2 Accuracy Excess",
        movePacing: "Engine Move Pacing (%clk)",
        eloVelocity: "Elo Surge Velocity",
        accountTrust: "Account Age & Trust Risk"
      },
      stats: {
        accountAge: "Account Age",
        daysShort: "d",
        monthsShort: "mo",
        yearsShort: "yr",
        recentRecord: "Recent Form",
        avgAccuracy: "Avg Accuracy",
        expectedShort: "exp",
        moveCV: "Move Pace CV",
        elo7d: "7d Elo Delta",
        streak: "Streak",
        noReviewedGames: "No reviewed games",
        gamesAnalyzed: "{count} games analyzed"
      },
      actions: {
        swapTarget: "Swap Top / Bottom Player",
        watchSuspect: "Add to Suspect Watchlist",
        watchingSuspect: "Watching (Ban Monitor Active)",
        refresh: "Re-scan Opponent",
        minimize: "Minimize (Alt+S)",
        expand: "Expand HUD",
        openProfile: "Open Chess.com Profile",
        toggleDetails: "Show Forensic Breakdown",
        hideDetails: "Hide Breakdown"
      },
      popup: {
        tabScanner: "Live Scanner",
        tabWatchlist: "Ban Watchlist",
        tabSettings: "Settings",
        searchPlaceholder: "Enter Chess.com username (e.g. hikaru)\u2026",
        scanBtn: "Analyze",
        recentScansTitle: "RECENTLY SCANNED OPPONENTS",
        emptyScans: "No opponents scanned yet. Start a game on Chess.com or search above.",
        watchlistTitle: "SUSPECT & BAN TRACKER",
        checkBansBtn: "Check Ban Status Now",
        checkingBans: "Checking API\u2026",
        emptyWatchlist: "Watchlist is empty. Click the eye icon on the HUD to track suspicious opponents.",
        bannedTag: "BANNED (FAIR PLAY)",
        activeTag: "Active Account",
        addedOn: "Initial risk: {prob}%",
        removeBtn: "Remove",
        settingsLanguage: "Interface Language / Dil",
        settingsAutoHud: "Auto-Open Floating HUD on Match Start",
        settingsAutoHudDesc: "Automatically opens the glassmorphic HUD overlay on Chess.com when an opponent is detected.",
        settingsInlineBadge: "Inline Username % Risk Badge",
        settingsInlineBadgeDesc: "Injects a compact risk percentage and W/L/D pill right next to the opponent username.",
        settingsCompact: "Compact HUD Mode",
        settingsCompactDesc: "Starts the in-page HUD popup with telemetry bars collapsed by default.",
        settingsRatedOnly: "Rated Games Only",
        settingsRatedOnlyDesc: "Excludes casual / unrated games when computing cheat probability.",
        settingsSensitivity: "Detection Sensitivity",
        sensitivityConservative: "Conservative",
        sensitivityBalanced: "Balanced (Default)",
        sensitivityStrict: "Strict",
        toggleInPageHud: "Toggle HUD on Active Chess.com Tab",
        privacyNote: "100% Private \u2022 Zero data collection \u2022 Powered strictly by official Chess.com PubAPI."
      },
      flags: {
        banned_fair_play: "Account closed by Chess.com for Fair Play (Cheating) violations!",
        verified_title: "Verified FIDE titled player ({title}) \u2014 elite outlier calibration applied",
        fresh_high_elo: "Brand-new account ({days} days old) already competing at {rating} Elo",
        fresh_account: "Recently created account ({days} days old) \u2014 elevated smurf / burner risk",
        extreme_recent_wr: "{wr}% win rate across last {games} rated games (extreme statistical outlier)",
        elevated_recent_wr: "{wr}% win rate across last {games} games (above Glicko equilibrium)",
        accuracy_excess: "+{excess}% average CAPS2 accuracy ({avg}%) above Elo band expectation",
        accuracy_spikes: "{rate}% of {games} reviewed games hit ceiling accuracy (\u2265{ceil}%)",
        robotic_pacing: "Robotic move-time pacing detected (Median CV: {cv}, near-zero instinctive recaptures)",
        midgame_toggle: "Mid-game pause followed by flatline mechanical moves in {count} games (toggle signature)",
        elo_surge: "+{delta} Elo vertical rating surge over the last 7 days",
        hot_streak: "Currently on a {streak}-game consecutive rated win streak",
        tactics_gap: "Massive gap between live rating ({rating}) and tactics rating ({tactics})",
        natural_human: "Organic human move-time variance (CV: {cv}) and balanced win distribution",
        established_veteran: "Established veteran account ({years}+ years old, {total} lifetime games)"
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
    if (days === null || days < 0) return "\u2014";
    const s = TRANSLATIONS[lang].stats;
    if (days < 60) return `${Math.max(1, days)} ${s.daysShort}`;
    if (days < 365) return `${Math.round(days / 30)} ${s.monthsShort}`;
    const yrs = (days / 365).toFixed(days >= 1095 ? 0 : 1);
    return `${yrs} ${s.yearsShort}`;
  }

  // src/content/hud-styles.ts
  var HUD_SHADOW_CSS = `
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
    width: 344px;
    background: linear-gradient(165deg, rgba(13, 18, 30, 0.93) 0%, rgba(8, 11, 20, 0.96) 100%);
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

  // src/content/hud-overlay.ts
  function countryToFlagEmoji(code) {
    if (!code || code.length !== 2) return "";
    const upper = code.toUpperCase();
    const A = 127462;
    const first = upper.charCodeAt(0) - 65;
    const second = upper.charCodeAt(1) - 65;
    if (first < 0 || first > 25 || second < 0 || second > 25) return "";
    return String.fromCodePoint(A + first, A + second);
  }
  function barColor(score) {
    if (score < 25) return "#10b981";
    if (score < 45) return "#38bdf8";
    if (score < 68) return "#f59e0b";
    if (score < 82) return "#f97316";
    return "#ef4444";
  }
  function escapeHtml(raw) {
    return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  var SentinelHudOverlay = class {
    host = null;
    shadow = null;
    cardEl = null;
    minPillEl = null;
    settings;
    callbacks;
    currentResult = null;
    selectedFormat = "blitz";
    isMinimized = false;
    isHidden = true;
    detailsExpanded = true;
    isAbortWindowOpen = false;
    isWatched = false;
    loadingUsername = null;
    // Drag state
    dragging = false;
    dragStartX = 0;
    dragStartY = 0;
    startRight = 20;
    startTop = 72;
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
      this.settings = next;
      if (prevLang !== next.language) {
        this.render();
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
      this.isHidden = false;
      this.render();
      this.syncVisibility();
    }
    showResult(result, watched, isAbortWindowOpen) {
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
    showError(username, message) {
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
    renderHeaderHtml(lang) {
      const t = TRANSLATIONS[lang];
      const nextLang = lang === "tr" ? "EN" : "TR";
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
          <button class="icon-btn lang-btn" data-action="lang" title="Switch Language / Dil De\u011Fi\u015Ftir">${nextLang}</button>
          <button class="icon-btn" data-action="swap" title="${escapeHtml(t.actions.swapTarget)}">\u21C5</button>
          ${this.currentResult ? `<button class="icon-btn ${this.isWatched ? "active" : ""}" data-action="watch" title="${escapeHtml(
        this.isWatched ? t.actions.watchingSuspect : t.actions.watchSuspect
      )}">\u{1F441}</button>` : ""}
          <button class="icon-btn" data-action="refresh" title="${escapeHtml(t.actions.refresh)}">\u21BB</button>
          <button class="icon-btn" data-action="minimize" title="${escapeHtml(t.actions.minimize)}">\u2014</button>
          <button class="icon-btn" data-action="close" title="Close">\u2715</button>
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
    render() {
      if (!this.cardEl || !this.minPillEl) return;
      const lang = this.settings.language;
      const t = TRANSLATIONS[lang];
      if (this.loadingUsername && !this.currentResult) {
        this.cardEl.style.setProperty("--tier-color", "#38bdf8");
        this.cardEl.style.setProperty("--tier-border", "rgba(56, 189, 248, 0.3)");
        this.cardEl.style.setProperty("--tier-glow", "rgba(56, 189, 248, 0.25)");
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
        this.minPillEl.innerHTML = `<span class="min-pct">\u2026</span><span class="min-user">@${escapeHtml(
          this.loadingUsername
        )}</span>`;
        this.bindHeaderEvents();
        return;
      }
      const res = this.currentResult;
      if (!res) return;
      const theme = TIER_THEMES[res.tier];
      this.cardEl.style.setProperty("--tier-color", theme.color);
      this.cardEl.style.setProperty("--tier-bg", theme.accentBg);
      this.cardEl.style.setProperty("--tier-border", theme.border);
      this.cardEl.style.setProperty("--tier-glow", theme.glow);
      this.minPillEl.style.setProperty("--tier-color", theme.color);
      this.minPillEl.style.setProperty("--tier-border", theme.border);
      this.minPillEl.style.setProperty("--tier-glow", theme.glow);
      const fmtData = res.formats[this.selectedFormat] || res.formats[res.primaryFormat];
      const displayProb = res.isBannedFairPlay ? 100 : this.selectedFormat === res.primaryFormat ? res.probability : fmtData.formatProbability;
      const radius = 35;
      const circ = 2 * Math.PI * radius;
      const offset = circ - Math.min(100, Math.max(0, displayProb)) / 100 * circ;
      let alertHtml = "";
      if (res.isBannedFairPlay) {
        alertHtml = `<div class="alert-banner banned">\u{1F6A8} ${escapeHtml(t.bannedFairPlayBanner)}</div>`;
      } else if (this.isAbortWindowOpen && displayProb >= 55) {
        alertHtml = `<div class="alert-banner abort-warn">\u26A0\uFE0F ${escapeHtml(t.abortWindowActive)} \u2014 ${escapeHtml(
          t.considerAborting
        )}</div>`;
      } else if (this.isAbortWindowOpen && displayProb < 30) {
        alertHtml = `<div class="alert-banner abort-safe">\u{1F6E1}\uFE0F ${escapeHtml(t.safeToPlay)}</div>`;
      }
      const flagEmoji = countryToFlagEmoji(res.countryCode);
      const avatarHtml = res.avatarUrl ? `<img class="avatar" src="${escapeHtml(res.avatarUrl)}" alt="" />` : `<div class="avatar">${escapeHtml(res.displayName.slice(0, 1).toUpperCase())}</div>`;
      const titleBadgeHtml = res.title ? `<span class="title-pill">${escapeHtml(res.title.toUpperCase())}</span>` : "";
      const verdictText = res.isBannedFairPlay ? t.tiers.banned.summary : displayProb >= 60 ? t.considerAborting : displayProb >= 35 ? t.cautionAdvised : t.safeToPlay;
      const ageStr = formatAgeShort(res.accountAgeDays, lang);
      const accStr = fmtData.avgAccuracy !== null ? `${fmtData.avgAccuracy}%` : "\u2014";
      const accClass = fmtData.avgAccuracy !== null && fmtData.avgAccuracy - fmtData.expectedAccuracy >= 4 ? "neg" : fmtData.avgAccuracy !== null ? "pos" : "";
      const cvVal = res.pacing.medianCV;
      const cvStr = cvVal !== null ? String(cvVal) : "\u2014";
      const cvClass = cvVal !== null && cvVal < 0.48 ? "neg" : cvVal !== null && cvVal < 0.62 ? "warn" : "pos";
      const d7 = fmtData.eloDelta7d;
      const d7Str = d7 === null ? "0" : d7 > 0 ? `+${d7}` : `${d7}`;
      const d7Class = d7 !== null && d7 >= 90 ? "warn" : d7 !== null && d7 > 0 ? "pos" : "";
      const formDotsHtml = res.recentForm.map((r) => {
        const lbl = lang === "tr" ? r === "W" ? "G" : r === "L" ? "M" : "B" : r;
        return `<span class="form-dot ${r}">${lbl}</span>`;
      }).join("");
      const wldLabel = fmtData.recentTotal > 0 ? lang === "tr" ? `Son: ${fmtData.recentWins}G ${fmtData.recentLosses}M ${fmtData.recentDraws}B (%${fmtData.recentWinPct})` : `Recent: ${fmtData.recentWins}W ${fmtData.recentLosses}L ${fmtData.recentDraws}D (${fmtData.recentWinPct}%)` : lang === "tr" ? `Genel: %${fmtData.overallWinPct} (${fmtData.overallTotal})` : `All: ${fmtData.overallWinPct}% (${fmtData.overallTotal})`;
      const flagsHtml = res.flags.map(
        (f) => `
        <div class="flag-chip ${f.severity}">
          <span>${f.icon}</span>
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
            <span class="sig-score">${s.score}/100</span>
          </div>
          <div class="sig-bar-bg">
            <div class="sig-bar-fill" style="width:${s.score}%;background:${barColor(s.score)}"></div>
          </div>
        </div>
      `
      ).join("");
      const formatTabsHtml = LIVE_FORMATS.map((fmt) => {
        const f = res.formats[fmt];
        const active = fmt === this.selectedFormat ? "active" : "";
        const elo = f.currentRating ? String(f.currentRating) : "\u2014";
        return `
        <button class="fmt-tab ${active}" data-fmt="${fmt}">
          <span>${fmt}</span>
          <span class="fmt-elo">${elo}</span>
        </button>
      `;
      }).join("");
      const pctDisplay = lang === "tr" ? `<span>%</span>${displayProb}` : `${displayProb}<span>%</span>`;
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
            ${flagEmoji ? `<span>${flagEmoji}</span>` : ""}
          </div>
          <div class="tier-badge-row">
            <span class="tier-pill">${escapeHtml(t.tiers[res.tier].label)}</span>
            <span class="conf-tag">\u2022 ${escapeHtml(t.confidenceLabel[res.confidence])}</span>
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

      ${res.recentForm.length > 0 ? `<div class="form-strip">
              <div class="form-dots">${formDotsHtml}</div>
              <div class="wld-summary">${escapeHtml(wldLabel)}</div>
            </div>` : ""}

      ${flagsHtml ? `<div class="flags-list">${flagsHtml}</div>` : ""}

      <button class="details-toggle" data-toggle-details="1">
        <span>${escapeHtml(this.detailsExpanded ? t.actions.hideDetails : t.actions.toggleDetails)}</span>
        <span>${this.detailsExpanded ? "\u25B4" : "\u25BE"}</span>
      </button>

      <div class="signals-panel ${this.detailsExpanded ? "" : "collapsed"}">
        ${signalsHtml}
      </div>
    `;
      const minPctText = lang === "tr" ? `%${displayProb}` : `${displayProb}%`;
      this.minPillEl.innerHTML = `
      <span>\u{1F6E1}\uFE0F</span>
      <span class="min-pct">${minPctText}</span>
      <span class="min-user">@${escapeHtml(res.displayName)}</span>
    `;
      this.bindHeaderEvents();
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
  function findPlayerAnchorContainer(targetSide) {
    const selectors = targetSide === "top" ? [
      "#board-layout-player-top .user-tagline-component",
      "#board-layout-top .user-tagline-component",
      ".board-layout-top .user-tagline-component",
      "#board-layout-player-top .user-tagline-compact-row",
      ".board-layout-top cc-user-username-component",
      "#board-layout-player-top cc-user-username-component"
    ] : [
      "#board-layout-player-bottom .user-tagline-component",
      "#board-layout-bottom .user-tagline-component",
      ".board-layout-bottom .user-tagline-component",
      "#board-layout-player-bottom .user-tagline-compact-row",
      ".board-layout-bottom cc-user-username-component",
      "#board-layout-player-bottom cc-user-username-component"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        return el.tagName.toLowerCase() === "cc-user-username-component" ? el.parentElement || el : el;
      }
    }
    return null;
  }
  function renderInlineUsernameBadge(result, targetSide, lang, onClick) {
    ensureInlineStyles();
    removeInlineUsernameBadges();
    const container = findPlayerAnchorContainer(targetSide);
    if (!container) return;
    const theme = TIER_THEMES[result.tier];
    const pf = result.formats[result.primaryFormat];
    const probText = lang === "tr" ? `%${result.probability}` : `${result.probability}%`;
    const wldText = pf.recentTotal > 0 ? lang === "tr" ? `${pf.recentWins}G/${pf.recentLosses}M` : `${pf.recentWins}W/${pf.recentLosses}L` : lang === "tr" ? `${pf.overallWins}G/${pf.overallLosses}M` : `${pf.overallWins}W/${pf.overallLosses}L`;
    const pill = document.createElement("span");
    pill.className = BADGE_CLASS;
    pill.style.background = theme.accentBg;
    pill.style.border = `1px solid ${theme.border}`;
    pill.style.color = theme.color;
    pill.style.boxShadow = `0 2px 10px ${theme.glow}`;
    pill.title = lang === "tr" ? `Chess Sentinel \u2014 Hile Olas\u0131l\u0131\u011F\u0131: %${result.probability} (Detaylar i\xE7in t\u0131kla)` : `Chess Sentinel \u2014 Cheat Probability: ${result.probability}% (Click for HUD)`;
    const dot = document.createElement("span");
    dot.className = "cs-pill-dot";
    dot.style.background = theme.color;
    dot.style.boxShadow = `0 0 6px ${theme.color}`;
    const probSpan = document.createElement("span");
    probSpan.textContent = probText;
    const wldSpan = document.createElement("span");
    wldSpan.className = "cs-pill-wld";
    wldSpan.style.color = "#e2e8f0";
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

  // src/content/index.ts
  var SentinelContentController = class {
    settings = { ...DEFAULT_SETTINGS };
    hud = null;
    detector = null;
    lastCtx = null;
    targetSide = "top";
    activeUsername = null;
    latestResult = null;
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
        onToggleWatchlist: (result) => {
          void this.handleWatchlistToggle(result);
        },
        onSavePosition: (pos) => {
          void this.persistSettings({ hudPosition: pos });
        }
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
    async persistSettings(patch) {
      this.settings = await updateSettings(patch);
      this.hud?.updateSettings(this.settings);
      if (this.latestResult && this.settings.showInlineBadge) {
        renderInlineUsernameBadge(
          this.latestResult,
          this.targetSide,
          this.settings.language,
          () => this.hud?.expandFromBadge()
        );
      }
    }
    swapTargetSide() {
      if (!this.lastCtx) return;
      const nextSide = this.targetSide === "top" ? "bottom" : "top";
      const candidate = nextSide === "top" ? this.lastCtx.topPlayer : this.lastCtx.bottomPlayer;
      if (!candidate) return;
      this.targetSide = nextSide;
      void this.analyzeTarget(candidate, this.lastCtx.detectedFormat, false);
    }
    handleMatchContext(ctx) {
      const prevTop = this.lastCtx?.topPlayer?.toLowerCase();
      this.lastCtx = ctx;
      if (ctx.topPlayer && ctx.topPlayer.toLowerCase() !== prevTop) {
        this.targetSide = "top";
      }
      const target = this.targetSide === "bottom" && ctx.bottomPlayer ? ctx.bottomPlayer : ctx.opponent;
      this.hud?.setAbortWindow(ctx.isAbortWindowOpen);
      if (target.toLowerCase() !== this.activeUsername?.toLowerCase()) {
        void this.analyzeTarget(target, ctx.detectedFormat, false);
      }
    }
    handleMatchLeft() {
      this.activeUsername = null;
      this.latestResult = null;
      this.lastCtx = null;
      removeInlineUsernameBadges();
      this.hud?.hide();
    }
    async analyzeTarget(username, preferredFormat, forceRefresh) {
      this.activeUsername = username;
      if (this.settings.autoShowHud || forceRefresh) {
        this.hud?.showLoading(username);
      }
      try {
        const msg = {
          type: "ANALYZE_PLAYER",
          username,
          preferredFormat,
          forceRefresh
        };
        const response = await chrome.runtime.sendMessage(msg);
        if (this.activeUsername?.toLowerCase() !== username.toLowerCase()) return;
        if (!response || !response.ok || !response.result) {
          this.hud?.showError(username, response?.error || "Could not retrieve Chess.com telemetry");
          return;
        }
        const result = response.result;
        this.latestResult = result;
        const watchlist = await getWatchlist();
        const isWatched = watchlist.some(
          (w) => w.username.toLowerCase() === result.username.toLowerCase()
        );
        if (this.settings.autoShowHud || forceRefresh) {
          this.hud?.showResult(result, isWatched, this.lastCtx?.isAbortWindowOpen ?? false);
        }
        if (this.settings.showInlineBadge) {
          renderInlineUsernameBadge(result, this.targetSide, this.settings.language, () => {
            this.hud?.showResult(result, isWatched, this.lastCtx?.isAbortWindowOpen ?? false);
            this.hud?.expandFromBadge();
          });
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
              () => this.hud?.expandFromBadge()
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
