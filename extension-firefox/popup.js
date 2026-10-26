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
  soundAlerts: true,
  sensitivity: "balanced",
  hudPosition: null
};

// src/core/engine.ts
function buildFairPlayEvidenceReport(res, lang, liveClock) {
  const pf = res.formats[res.primaryFormat];
  const lines = [];
  if (lang === "tr") {
    lines.push(`[Chess Sentinel v3.0 \u2014 Adil Oyun Telemetri \xD6zeti]`);
    lines.push(
      `Oyuncu: @${res.displayName} (https://www.chess.com/member/${res.displayName}) | Hesap Ya\u015F\u0131: ${res.accountAgeDays !== null ? `${res.accountAgeDays} g\xFCn` : "Bilinmiyor"}`
    );
    lines.push(
      `Birincil Format: ${res.primaryFormat.toUpperCase()} (${pf.currentRating ?? "\u2014"} Elo) | \u0130statistiksel Anomali Olas\u0131l\u0131\u011F\u0131: %${res.probability}`
    );
    lines.push(
      `Son Performans: ${pf.recentWins}G / ${pf.recentLosses}M / ${pf.recentDraws}B (%${pf.recentWinPct} galibiyet, Rakip Elo beklentisine g\xF6re ${pf.eloZScore >= 0 ? "+" : ""}${pf.eloZScore}\u03C3 Z-Skoru)`
    );
    if (pf.avgAccuracy !== null) {
      lines.push(
        `Uzun Ma\xE7 CAPS2 Do\u011Fruluk: %${pf.avgAccuracy} (Elo band\u0131 beklentisi: %${pf.expectedAccuracy}, \u0130ncelenen tam ma\xE7: ${pf.reviewedGames})`
      );
    }
    if (res.pacing.gamesAnalyzed >= 4) {
      lines.push(
        `Kronometrik Saat Analizi (%clk): Entropi ${res.pacing.meanEntropyBits ?? "\u2014"} bit | Medyan QCD: ${res.pacing.medianQCD ?? "\u2014"} | Medyan CV: ${res.pacing.medianCV ?? "\u2014"} | Mekanik Ma\xE7 Oran\u0131: %${Math.round(res.pacing.flatlineRate * 100)}`
      );
    }
    if (liveClock && liveClock.movesObserved >= 4) {
      lines.push(
        `Canl\u0131 Ma\xE7 Saat Verisi: ${liveClock.movesObserved} hamle izlendi | Ort: ${liveClock.liveMeanSec ?? "\u2014"} sn | Canl\u0131 QCD: ${liveClock.liveQCD ?? "\u2014"} | Ard\u0131\u015F\u0131k mekanik hamle: ${liveClock.consecutiveRoboticMoves}`
      );
    }
    const topUrls = res.recentMatches.filter((m) => m.url && m.result === "W").slice(0, 3).map((m) => `${m.url}${m.accuracy !== null ? ` (%${m.accuracy})` : ""}`);
    if (topUrls.length > 0) {
      lines.push(`\u0130ncelenmesi \xD6nerilen Son Ma\xE7lar:
- ${topUrls.join("\n- ")}`);
    }
  } else {
    lines.push(`[Chess Sentinel v3.0 \u2014 Fair-Play Telemetry Summary]`);
    lines.push(
      `Player: @${res.displayName} (https://www.chess.com/member/${res.displayName}) | Account Age: ${res.accountAgeDays !== null ? `${res.accountAgeDays} days` : "Unknown"}`
    );
    lines.push(
      `Primary Format: ${res.primaryFormat.toUpperCase()} (${pf.currentRating ?? "\u2014"} Elo) | Statistical Anomaly Probability: ${res.probability}%`
    );
    lines.push(
      `Recent Performance: ${pf.recentWins}W / ${pf.recentLosses}L / ${pf.recentDraws}D (${pf.recentWinPct}% WR, ${pf.eloZScore >= 0 ? "+" : ""}${pf.eloZScore}\u03C3 Elo-adjusted Z-Score)`
    );
    if (pf.avgAccuracy !== null) {
      lines.push(
        `Long-Game CAPS2 Accuracy: ${pf.avgAccuracy}% (Band expected: ${pf.expectedAccuracy}%, Full-length reviewed games: ${pf.reviewedGames})`
      );
    }
    if (res.pacing.gamesAnalyzed >= 4) {
      lines.push(
        `Chronometric PGN [%clk] Profile: Entropy ${res.pacing.meanEntropyBits ?? "\u2014"} bits | Median QCD: ${res.pacing.medianQCD ?? "\u2014"} | Median CV: ${res.pacing.medianCV ?? "\u2014"} | Flatline Rate: ${Math.round(res.pacing.flatlineRate * 100)}%`
      );
    }
    if (liveClock && liveClock.movesObserved >= 4) {
      lines.push(
        `Live Match Clock Radar: ${liveClock.movesObserved} moves | Mean: ${liveClock.liveMeanSec ?? "\u2014"}s | Live QCD: ${liveClock.liveQCD ?? "\u2014"} | Consecutive flatline moves: ${liveClock.consecutiveRoboticMoves}`
      );
    }
    const topUrls = res.recentMatches.filter((m) => m.url && m.result === "W").slice(0, 3).map((m) => `${m.url}${m.accuracy !== null ? ` (${m.accuracy}%)` : ""}`);
    if (topUrls.length > 0) {
      lines.push(`Recent Games for Review:
- ${topUrls.join("\n- ")}`);
    }
  }
  return lines.join("\n");
}

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
      toggleDetails: "Adli Detaylar\u0131 & Grafikleri G\xF6ster",
      hideDetails: "Detaylar\u0131 Gizle",
      copyReport: "\u{1F4CB} Kan\u0131t Raporunu Kopyala",
      copiedReport: "\u2713 Rapor Panoya Kopyaland\u0131!",
      soundOn: "Sesli Risk Uyar\u0131s\u0131: A\xE7\u0131k",
      soundOff: "Sesli Risk Uyar\u0131s\u0131: Kapal\u0131"
    },
    v3: {
      liveClockTitle: "CANLI MA\xC7 HAMLE RADARI",
      liveClockMoves: "{count} hamle \u2022 Ort {mean}s \u2022 QCD {qcd}",
      liveClockSuspect: "\u26A1 Canl\u0131 ma\xE7ta mekanik hamle temposu alg\u0131land\u0131!",
      pacingHistTitle: "HAMLE S\xDCRES\u0130 DA\u011EILIMI (%clk)",
      pacingEntropyTag: "Entropi: {ent}b \u2022 QCD: {qcd}",
      recentMatchesTitle: "SON PUANLI MA\xC7LAR"
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
      settingsSoundAlerts: "Kritik Risk Sesli Uyar\u0131s\u0131",
      settingsSoundAlertsDesc: "Y\xFCksek/Kritik riskli (%68+) veya takipteki rakip geldi\u011Finde hafif radar sesi \xE7alar.",
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
      extreme_recent_wr: "Son {games} puanl\u0131 ma\xE7ta %{wr} galibiyet (Rakip Elo g\xF6re +{z}\u03C3 sapma)",
      elevated_recent_wr: "Son {games} ma\xE7ta %{wr} galibiyet (+{z}\u03C3 Elo \xFCst\xFC performans)",
      smurf_human_pacing: "Y\xFCksek kazanma oran\u0131 ancak hamle ritmi do\u011Fal insan da\u011F\u0131l\u0131m\u0131nda (olas\u0131 smurf / formda oyuncu)",
      accuracy_excess: "Uzun ma\xE7larda Elo band\u0131 beklentisinin (+%{excess}) \xFCzerinde do\u011Fruluk (%{avg})",
      accuracy_spikes: "\u0130ncelenen {games} uzun ma\xE7\u0131n %{rate} kadar\u0131nda tavan do\u011Fruluk (\u2265%{ceil})",
      robotic_pacing: "D\xFC\u015F\xFCk zaman entropisi ({ent} bit) ve mekanik hamle da\u011F\u0131l\u0131m\u0131 (QCD: {qcd}, CV: {cv})",
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
      toggleDetails: "Show Forensic Charts & Breakdown",
      hideDetails: "Hide Breakdown",
      copyReport: "\u{1F4CB} Copy Fair-Play Report",
      copiedReport: "\u2713 Evidence Copied!",
      soundOn: "Critical Risk Audio Alert: ON",
      soundOff: "Critical Risk Audio Alert: OFF"
    },
    v3: {
      liveClockTitle: "LIVE MATCH CLOCK RADAR",
      liveClockMoves: "{count} moves \u2022 Avg {mean}s \u2022 QCD {qcd}",
      liveClockSuspect: "\u26A1 Mechanical move pacing detected in live game!",
      pacingHistTitle: "MOVE-TIME HISTOGRAM (%clk)",
      pacingEntropyTag: "Entropy: {ent}b \u2022 QCD: {qcd}",
      recentMatchesTitle: "RECENT RATED MATCHES"
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
      settingsSoundAlerts: "Critical Risk Audio Chime",
      settingsSoundAlertsDesc: "Plays a subtle radar tone when matched against a High/Critical (\u226568%) or watched opponent.",
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
      extreme_recent_wr: "{wr}% win rate across last {games} rated games (+{z}\u03C3 above opponent Elo expectation)",
      elevated_recent_wr: "{wr}% win rate across last {games} games (+{z}\u03C3 Elo-adjusted outperformance)",
      smurf_human_pacing: "Elevated win rate accompanied by organic human move-time entropy (likely smurf / hot streak)",
      accuracy_excess: "+{excess}% long-game CAPS2 accuracy ({avg}%) above bias-adjusted Elo expectation",
      accuracy_spikes: "{rate}% of {games} full-length reviewed games hit ceiling accuracy (\u2265{ceil}%)",
      robotic_pacing: "Collapsed chronometric entropy ({ent} bits) & mechanical move dispersion (QCD: {qcd}, CV: {cv})",
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

// src/popup/index.ts
function barColor(score) {
  if (score < 25) return "#10b981";
  if (score < 45) return "#38bdf8";
  if (score < 68) return "#f59e0b";
  if (score < 82) return "#f97316";
  return "#ef4444";
}
var PopupController = class {
  root;
  tab = "scanner";
  settings = { ...DEFAULT_SETTINGS };
  recentScans = [];
  watchlist = [];
  activeResult = null;
  scanning = false;
  checkingBans = false;
  copiedReport = false;
  errorMsg = null;
  searchQuery = "";
  constructor(root) {
    this.root = root;
  }
  async init() {
    await this.loadAll();
    if (this.recentScans.length > 0) {
      this.activeResult = this.recentScans[0];
    }
    this.render();
  }
  async send(msg) {
    return await chrome.runtime.sendMessage(msg);
  }
  async loadAll() {
    try {
      const [sResp, rResp, wResp] = await Promise.all([
        this.send({ type: "GET_SETTINGS" }),
        this.send({ type: "GET_RECENT_SCANS" }),
        this.send({ type: "GET_WATCHLIST" })
      ]);
      if (sResp?.ok) this.settings = sResp.settings;
      if (rResp?.ok) this.recentScans = rResp.scans;
      if (wResp?.ok) this.watchlist = wResp.list;
    } catch {
    }
  }
  async runPlayerScan(username) {
    const clean = username.trim();
    if (!clean) return;
    this.scanning = true;
    this.errorMsg = null;
    this.render();
    try {
      const resp = await this.send({
        type: "ANALYZE_PLAYER",
        username: clean,
        forceRefresh: true
      });
      if (!resp.ok || !resp.result) {
        this.errorMsg = resp.error === "PLAYER_NOT_FOUND" ? this.settings.language === "tr" ? "Oyuncu bulunamad\u0131." : "Player not found." : resp.error || "API Error";
      } else {
        this.activeResult = resp.result;
        const scansResp = await this.send({
          type: "GET_RECENT_SCANS"
        });
        if (scansResp?.ok) this.recentScans = scansResp.scans;
      }
    } catch (e) {
      this.errorMsg = e instanceof Error ? e.message : "Scan failed";
    } finally {
      this.scanning = false;
      this.render();
    }
  }
  renderActiveResultCard(lang) {
    if (!this.activeResult) return "";
    const r = this.activeResult;
    const t = TRANSLATIONS[lang];
    const theme = TIER_THEMES[r.tier];
    const pf = r.formats[r.primaryFormat];
    const pctText = lang === "tr" ? `%${r.probability}` : `${r.probability}%`;
    const bars = [
      { lbl: t.signals.recentWinrate, val: r.signals.recentWinrate },
      { lbl: t.signals.overallWinrate, val: r.signals.overallWinrate },
      { lbl: t.signals.accuracyAnomaly, val: r.signals.accuracyAnomaly },
      { lbl: t.signals.movePacing, val: r.signals.movePacing },
      { lbl: t.signals.eloVelocity, val: r.signals.eloVelocity },
      { lbl: t.signals.accountTrust, val: r.signals.accountTrust }
    ];
    const flagsHtml = r.flags.slice(0, 3).map(
      (f) => `<div style="font-size:10.5px;color:#cbd5e1;line-height:1.3">${f.icon} ${escapeHtml(
        formatFlag(lang, f.id, f.params)
      )}</div>`
    ).join("");
    return `
      <div class="scan-result-card" style="border-color:${theme.border}">
        <div class="scan-top">
          <div class="scan-user">
            ${r.avatarUrl ? `<img class="scan-avatar" src="${escapeHtml(r.avatarUrl)}" alt="" />` : `<div class="scan-avatar">${escapeHtml(r.displayName[0]?.toUpperCase() || "?")}</div>`}
            <div>
              <div>
                ${r.title ? `<span style="background:#dc2626;color:#fff;font-size:9px;font-weight:800;padding:1px 4px;border-radius:4px;margin-right:4px">${escapeHtml(r.title)}</span>` : ""}
                <a class="scan-name" href="https://www.chess.com/member/${encodeURIComponent(
      r.displayName
    )}" target="_blank" rel="noopener noreferrer">@${escapeHtml(r.displayName)}</a>
              </div>
              <div class="scan-meta">
                ${escapeHtml(r.primaryFormat.toUpperCase())} ${pf.currentRating ?? "\u2014"} \u2022
                ${escapeHtml(formatAgeShort(r.accountAgeDays, lang))} \u2022
                ${escapeHtml(t.tiers[r.tier].label)}
              </div>
            </div>
          </div>
          <div class="prob-badge-lg" style="background:${theme.accentBg};color:${theme.color};border:1px solid ${theme.border}">
            ${pctText}
          </div>
        </div>

        <div class="mini-bars">
          ${bars.map(
      (b) => `
            <div class="mini-bar-item">
              <div class="mini-bar-lbl">
                <span>${escapeHtml(b.lbl)}</span>
                <strong>${b.val}</strong>
              </div>
              <div class="mini-bar-track">
                <div class="mini-bar-fill" style="width:${b.val}%;background:${barColor(b.val)}"></div>
              </div>
            </div>
          `
    ).join("")}
        </div>

        ${flagsHtml ? `<div style="display:flex;flex-direction:column;gap:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.06)">${flagsHtml}</div>` : ""}
        <button id="popup-copy-report-btn" class="pill-btn" style="margin-top:8px;width:100%;justify-content:center;padding:6px 10px;border-color:${this.copiedReport ? "rgba(16,185,129,0.5)" : "rgba(56,189,248,0.3)"};color:${this.copiedReport ? "#6ee7b7" : "#bae6fd"}">
          ${escapeHtml(this.copiedReport ? t.actions.copiedReport : t.actions.copyReport)}
        </button>
      </div>
    `;
  }
  renderScannerTab(lang) {
    const t = TRANSLATIONS[lang];
    const recentHtml = this.recentScans.length === 0 ? `<div class="empty-state">${escapeHtml(t.popup.emptyScans)}</div>` : `<div class="item-list">
            ${this.recentScans.slice(0, 8).map((item) => {
      const th = TIER_THEMES[item.tier];
      const pStr = lang === "tr" ? `%${item.probability}` : `${item.probability}%`;
      return `
                  <div class="list-row" data-select-scan="${escapeHtml(item.username)}">
                    <div class="row-left">
                      <div>
                        <div class="row-name">@${escapeHtml(item.displayName)}</div>
                        <div class="row-sub">${escapeHtml(item.primaryFormat.toUpperCase())} \u2022 ${escapeHtml(
        t.tiers[item.tier].label
      )}</div>
                      </div>
                    </div>
                    <span class="row-prob" style="background:${th.accentBg};color:${th.color};border:1px solid ${th.border}">${pStr}</span>
                  </div>
                `;
    }).join("")}
          </div>`;
    return `
      <form class="search-bar" id="scan-form">
        <input
          class="search-input"
          id="scan-input"
          type="text"
          value="${escapeHtml(this.searchQuery)}"
          placeholder="${escapeHtml(t.popup.searchPlaceholder)}"
          autocomplete="off"
        />
        <button class="primary-btn" type="submit" ${this.scanning ? "disabled" : ""}>
          ${this.scanning ? "\u2026" : escapeHtml(t.popup.scanBtn)}
        </button>
      </form>
      ${this.errorMsg ? `<div style="color:#f87171;font-size:11.5px;font-weight:600">${escapeHtml(this.errorMsg)}</div>` : ""}
      ${this.renderActiveResultCard(lang)}
      <div class="sec-title">${escapeHtml(t.popup.recentScansTitle)}</div>
      ${recentHtml}
    `;
  }
  renderWatchlistTab(lang) {
    const t = TRANSLATIONS[lang];
    const bannedCount = this.watchlist.filter((w) => w.isBannedFairPlay).length;
    const listHtml = this.watchlist.length === 0 ? `<div class="empty-state">${escapeHtml(t.popup.emptyWatchlist)}</div>` : `<div class="item-list">
            ${this.watchlist.map((w) => {
      const initText = t.popup.addedOn.replace("{prob}", String(w.initialProbability));
      return `
                  <div class="list-row">
                    <div class="row-left">
                      <div>
                        <a class="row-name" style="text-decoration:none" href="https://www.chess.com/member/${encodeURIComponent(
        w.username
      )}" target="_blank" rel="noopener noreferrer">@${escapeHtml(w.username)}</a>
                        <div class="row-sub">${escapeHtml(initText)} \u2022 ${w.ratingAtSave ?? "\u2014"} Elo</div>
                      </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px">
                      ${w.isBannedFairPlay ? `<span class="banned-pill">\u{1F6A8} ${escapeHtml(t.popup.bannedTag)}</span>` : `<span class="active-pill">${escapeHtml(t.popup.activeTag)}</span>`}
                      <button class="pill-btn" data-remove-watch="${escapeHtml(w.username)}" title="${escapeHtml(
        t.popup.removeBtn
      )}">\u2715</button>
                    </div>
                  </div>
                `;
    }).join("")}
          </div>`;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div class="sec-title">${escapeHtml(t.popup.watchlistTitle)} (${bannedCount}/${this.watchlist.length})</div>
        <button class="primary-btn" id="refresh-bans-btn" style="padding:6px 10px" ${this.checkingBans || this.watchlist.length === 0 ? "disabled" : ""}>
          ${escapeHtml(this.checkingBans ? t.popup.checkingBans : t.popup.checkBansBtn)}
        </button>
      </div>
      ${listHtml}
    `;
  }
  renderSettingsTab(lang) {
    const t = TRANSLATIONS[lang];
    const s = this.settings;
    return `
      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsLanguage)}</div>
        </div>
        <select class="select-input" data-setting-select="language">
          <option value="tr" ${s.language === "tr" ? "selected" : ""}>T\xFCrk\xE7e (TR)</option>
          <option value="en" ${s.language === "en" ? "selected" : ""}>English (EN)</option>
        </select>
      </div>

      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsSensitivity)}</div>
        </div>
        <select class="select-input" data-setting-select="sensitivity">
          <option value="conservative" ${s.sensitivity === "conservative" ? "selected" : ""}>${escapeHtml(
      t.popup.sensitivityConservative
    )}</option>
          <option value="balanced" ${s.sensitivity === "balanced" ? "selected" : ""}>${escapeHtml(
      t.popup.sensitivityBalanced
    )}</option>
          <option value="strict" ${s.sensitivity === "strict" ? "selected" : ""}>${escapeHtml(
      t.popup.sensitivityStrict
    )}</option>
        </select>
      </div>

      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsAutoHud)}</div>
          <div class="setting-desc">${escapeHtml(t.popup.settingsAutoHudDesc)}</div>
        </div>
        <input class="toggle-input" type="checkbox" data-setting-check="autoShowHud" ${s.autoShowHud ? "checked" : ""} />
      </div>

      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsInlineBadge)}</div>
          <div class="setting-desc">${escapeHtml(t.popup.settingsInlineBadgeDesc)}</div>
        </div>
        <input class="toggle-input" type="checkbox" data-setting-check="showInlineBadge" ${s.showInlineBadge ? "checked" : ""} />
      </div>

      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsCompact)}</div>
          <div class="setting-desc">${escapeHtml(t.popup.settingsCompactDesc)}</div>
        </div>
        <input class="toggle-input" type="checkbox" data-setting-check="compactMode" ${s.compactMode ? "checked" : ""} />
      </div>

      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsRatedOnly)}</div>
          <div class="setting-desc">${escapeHtml(t.popup.settingsRatedOnlyDesc)}</div>
        </div>
        <input class="toggle-input" type="checkbox" data-setting-check="ratedOnly" ${s.ratedOnly ? "checked" : ""} />
      </div>

      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(t.popup.settingsSoundAlerts)}</div>
          <div class="setting-desc">${escapeHtml(t.popup.settingsSoundAlertsDesc)}</div>
        </div>
        <input class="toggle-input" type="checkbox" data-setting-check="soundAlerts" ${s.soundAlerts ? "checked" : ""} />
      </div>
    `;
  }
  render() {
    const lang = this.settings.language;
    const t = TRANSLATIONS[lang];
    const bodyHtml = this.tab === "scanner" ? this.renderScannerTab(lang) : this.tab === "watchlist" ? this.renderWatchlistTab(lang) : this.renderSettingsTab(lang);
    setSafeHtml(
      this.root,
      `
      <div class="popup-shell">
        <div class="top-bar">
          <div class="brand-group">
            <div class="brand-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                <path d="M12 2L4 5.5v6.2c0 5.3 3.4 9.9 8 11.3 4.6-1.4 8-6 8-11.3V5.5L12 2z"/>
                <path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div>
              <div class="brand-name">${escapeHtml(t.appName)}</div>
              <div class="brand-sub">${escapeHtml(t.appSubtitle)}</div>
            </div>
          </div>
          <div class="top-controls">
            <button class="pill-btn" id="quick-lang-btn">${lang === "tr" ? "EN" : "TR"}</button>
            <button class="pill-btn" id="toggle-hud-btn" title="${escapeHtml(t.popup.toggleInPageHud)}">HUD</button>
          </div>
        </div>

        <div class="nav-tabs">
          <button class="nav-tab ${this.tab === "scanner" ? "active" : ""}" data-tab="scanner">
            ${escapeHtml(t.popup.tabScanner)}
          </button>
          <button class="nav-tab ${this.tab === "watchlist" ? "active" : ""}" data-tab="watchlist">
            ${escapeHtml(t.popup.tabWatchlist)} (${this.watchlist.length})
          </button>
          <button class="nav-tab ${this.tab === "settings" ? "active" : ""}" data-tab="settings">
            ${escapeHtml(t.popup.tabSettings)}
          </button>
        </div>

        <div class="tab-body">${bodyHtml}</div>

        <div class="footer-note">${escapeHtml(t.popup.privacyNote)}</div>
      </div>
    `
    );
    this.bindEvents();
  }
  bindEvents() {
    this.root.querySelectorAll("button[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.tab = btn.dataset.tab;
        this.render();
      });
    });
    const quickLang = this.root.querySelector("#quick-lang-btn");
    quickLang?.addEventListener("click", () => {
      void (async () => {
        const next = this.settings.language === "tr" ? "en" : "tr";
        const resp = await this.send({
          type: "UPDATE_SETTINGS",
          patch: { language: next }
        });
        if (resp?.ok) this.settings = resp.settings;
        this.render();
      })();
    });
    const toggleHudBtn = this.root.querySelector("#toggle-hud-btn");
    toggleHudBtn?.addEventListener("click", () => {
      void (async () => {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab?.id) {
            await chrome.tabs.sendMessage(activeTab.id, { type: "TOGGLE_HUD_FROM_POPUP" });
          }
        } catch {
        }
      })();
    });
    const form = this.root.querySelector("#scan-form");
    const input = this.root.querySelector("#scan-input");
    if (input) {
      input.addEventListener("input", () => {
        this.searchQuery = input.value;
      });
    }
    if (form && input) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        void this.runPlayerScan(input.value);
      });
    }
    const copyReportBtn = this.root.querySelector("#popup-copy-report-btn");
    copyReportBtn?.addEventListener("click", () => {
      if (!this.activeResult) return;
      const report = buildFairPlayEvidenceReport(this.activeResult, this.settings.language, null);
      void navigator.clipboard?.writeText(report).catch(() => {
      });
      this.copiedReport = true;
      this.render();
      setTimeout(() => {
        this.copiedReport = false;
        this.render();
      }, 2e3);
    });
    this.root.querySelectorAll("[data-select-scan]").forEach((row) => {
      row.addEventListener("click", () => {
        const u = row.dataset.selectScan;
        const found = this.recentScans.find((s) => s.username.toLowerCase() === u?.toLowerCase());
        if (found) {
          this.activeResult = found;
          this.render();
        }
      });
    });
    const refreshBansBtn = this.root.querySelector("#refresh-bans-btn");
    refreshBansBtn?.addEventListener("click", () => {
      void (async () => {
        this.checkingBans = true;
        this.render();
        const resp = await this.send({
          type: "REFRESH_WATCHLIST_BANS"
        });
        if (resp?.ok) this.watchlist = resp.list;
        this.checkingBans = false;
        this.render();
      })();
    });
    this.root.querySelectorAll("button[data-remove-watch]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const u = btn.dataset.removeWatch;
        if (!u) return;
        void (async () => {
          const resp = await this.send({
            type: "REMOVE_WATCHLIST",
            username: u
          });
          if (resp?.ok) this.watchlist = resp.list;
          this.render();
        })();
      });
    });
    this.root.querySelectorAll("input[data-setting-check]").forEach((el) => {
      el.addEventListener("change", () => {
        const inputEl = el;
        const key = inputEl.dataset.settingCheck;
        void (async () => {
          const resp = await this.send({
            type: "UPDATE_SETTINGS",
            patch: { [key]: inputEl.checked }
          });
          if (resp?.ok) this.settings = resp.settings;
        })();
      });
    });
    this.root.querySelectorAll("select[data-setting-select]").forEach((el) => {
      el.addEventListener("change", () => {
        const selEl = el;
        const key = selEl.dataset.settingSelect;
        void (async () => {
          const patch = key === "language" ? { language: selEl.value } : { sensitivity: selEl.value };
          const resp = await this.send({
            type: "UPDATE_SETTINGS",
            patch
          });
          if (resp?.ok) this.settings = resp.settings;
          this.render();
        })();
      });
    });
  }
};
var appEl = document.getElementById("app");
if (appEl) {
  const popup = new PopupController(appEl);
  void popup.init();
}
