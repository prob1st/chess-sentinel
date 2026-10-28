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
    color: "#81b64c",
    accentBg: "rgba(129, 182, 76, 0.14)",
    glow: "transparent",
    border: "rgba(129, 182, 76, 0.34)"
  },
  guarded: {
    id: "guarded",
    color: "#6ba4d9",
    accentBg: "rgba(107, 164, 217, 0.14)",
    glow: "transparent",
    border: "rgba(107, 164, 217, 0.34)"
  },
  elevated: {
    id: "elevated",
    color: "#e59934",
    accentBg: "rgba(229, 153, 52, 0.15)",
    glow: "transparent",
    border: "rgba(229, 153, 52, 0.38)"
  },
  high: {
    id: "high",
    color: "#e06c35",
    accentBg: "rgba(224, 108, 53, 0.16)",
    glow: "transparent",
    border: "rgba(224, 108, 53, 0.44)"
  },
  critical: {
    id: "critical",
    color: "#e04644",
    accentBg: "rgba(224, 70, 68, 0.18)",
    glow: "transparent",
    border: "rgba(224, 70, 68, 0.52)"
  },
  banned: {
    id: "banned",
    color: "#e04644",
    accentBg: "rgba(224, 70, 68, 0.22)",
    glow: "transparent",
    border: "rgba(224, 70, 68, 0.62)"
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
    lines.push(`[Chess Sentinel v4.0 - Adil Oyun Kanit Ozeti]`);
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
    lines.push(`[Chess Sentinel v4.0 - Fair-Play Evidence Summary]`);
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
  mark: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.5L2.5 3.8v4.1c0 3.55 2.34 6.58 5.5 7.6 3.16-1.02 5.5-4.05 5.5-7.6V3.8L8 1.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M5.8 8.1l1.5 1.5 3-3.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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
  if (score < 25) return "#81b64c";
  if (score < 45) return "#6ba4d9";
  if (score < 68) return "#e59934";
  if (score < 82) return "#e06c35";
  return "#e04644";
}
var PopupController = class {
  root;
  tab = "scanner";
  settings = { ...DEFAULT_SETTINGS };
  recentScans = [];
  watchlist = [];
  activeResult = null;
  activeTabLiveClock = null;
  activeTabUsername = null;
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
    await this.trySyncActiveTabOpponent();
    if (!this.activeResult && this.recentScans.length > 0) {
      this.activeResult = this.recentScans[0];
    }
    this.render();
  }
  async send(msg) {
    return await chrome.runtime.sendMessage(msg);
  }
  async trySyncActiveTabOpponent() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) return;
      const state = await chrome.tabs.sendMessage(activeTab.id, {
        type: "GET_ACTIVE_MATCH_STATE"
      });
      if (state?.ok && state.result) {
        this.activeResult = state.result;
        this.activeTabUsername = state.activeUsername || state.result.username;
        this.activeTabLiveClock = state.liveClock || null;
      }
    } catch {
    }
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
        this.activeTabLiveClock = null;
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
    const isFromLiveTab = this.activeTabUsername && this.activeTabUsername.toLowerCase() === r.username.toLowerCase();
    const lc = isFromLiveTab ? this.activeTabLiveClock : null;
    const eff = computeEffectiveLiveRisk(r, lc);
    const theme = TIER_THEMES[eff.tier];
    const pf = r.formats[r.primaryFormat];
    const pctText = lang === "tr" ? `%${eff.probability}` : `${eff.probability}%`;
    const bars = [
      { lbl: t.signals.recentWinrate, val: r.signals.recentWinrate },
      { lbl: t.signals.overallWinrate, val: r.signals.overallWinrate },
      { lbl: t.signals.accuracyAnomaly, val: r.signals.accuracyAnomaly },
      { lbl: t.signals.movePacing, val: r.signals.movePacing },
      { lbl: t.signals.eloVelocity, val: r.signals.eloVelocity },
      { lbl: t.signals.accountTrust, val: r.signals.accountTrust }
    ];
    const flagsHtml = r.flags.slice(0, 3).map(
      (f) => `
          <div class="popup-flag-row">
            <span class="flag-dot ${f.severity}"></span>
            <span>${escapeHtml(formatFlag(lang, f.id, f.params))}</span>
          </div>
        `
    ).join("");
    return `
      <div class="scan-result-card">
        ${isFromLiveTab ? `<div class="active-tag">${escapeHtml(t.popup.activeMatchLabel)}</div>` : ""}
        <div class="scan-top">
          <div class="scan-user">
            ${r.avatarUrl ? `<img class="scan-avatar" src="${escapeHtml(r.avatarUrl)}" alt="" />` : `<div class="scan-avatar">${escapeHtml(r.displayName[0]?.toUpperCase() || "?")}</div>`}
            <div>
              <div>
                ${r.title ? `<span class="title-tag">${escapeHtml(r.title)}</span>` : ""}
                <a class="scan-name" href="https://www.chess.com/member/${encodeURIComponent(
      r.displayName
    )}" target="_blank" rel="noopener noreferrer">@${escapeHtml(r.displayName)}</a>
              </div>
              <div class="scan-meta">
                ${escapeHtml(r.primaryFormat.toUpperCase())} ${pf.currentRating ?? "-"} \xB7
                ${escapeHtml(formatAgeShort(r.accountAgeDays, lang))}
              </div>
            </div>
          </div>
          <div class="prob-readout" style="border-left-color:${theme.color}">
            <div class="prob-num" style="color:${theme.color}">${pctText}</div>
            <div class="prob-lbl">${escapeHtml(t.tiers[eff.tier].label)}</div>
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

        ${flagsHtml ? `<div class="popup-flags">${flagsHtml}</div>` : ""}
        <button id="popup-copy-report-btn" class="pill-btn ${this.copiedReport ? "copied" : ""}" style="width:100%">
          ${this.copiedReport ? ICONS.check : ICONS.copy}
          <span>${escapeHtml(this.copiedReport ? t.actions.copiedReport : t.actions.copyReport)}</span>
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
                        <div class="row-sub">${escapeHtml(item.primaryFormat.toUpperCase())} \xB7 ${escapeHtml(
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
          ${this.scanning ? "..." : escapeHtml(t.popup.scanBtn)}
        </button>
      </form>
      ${this.errorMsg ? `<div class="error-msg">${escapeHtml(this.errorMsg)}</div>` : ""}
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
                        <div class="row-sub">${escapeHtml(initText)} \xB7 ${w.ratingAtSave ?? "-"} Elo</div>
                      </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px">
                      ${w.isBannedFairPlay ? `<span class="banned-pill">${escapeHtml(t.popup.bannedTag)}</span>` : `<span class="active-pill">${escapeHtml(t.popup.activeTag)}</span>`}
                      <button class="pill-btn" data-remove-watch="${escapeHtml(w.username)}" title="${escapeHtml(
        t.popup.removeBtn
      )}">${ICONS.close}</button>
                    </div>
                  </div>
                `;
    }).join("")}
          </div>`;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div class="sec-title">${escapeHtml(t.popup.watchlistTitle)} (${bannedCount}/${this.watchlist.length})</div>
        <button class="primary-btn" id="refresh-bans-btn" style="height:26px;padding:0 10px" ${this.checkingBans || this.watchlist.length === 0 ? "disabled" : ""}>
          ${escapeHtml(this.checkingBans ? t.popup.checkingBans : t.popup.checkBansBtn)}
        </button>
      </div>
      ${listHtml}
    `;
  }
  renderSwitchRow(key, checked, title, desc) {
    return `
      <div class="setting-item">
        <div>
          <div class="setting-title">${escapeHtml(title)}</div>
          <div class="setting-desc">${escapeHtml(desc)}</div>
        </div>
        <label class="switch">
          <input type="checkbox" data-setting-check="${key}" ${checked ? "checked" : ""} />
          <span class="switch-slider"></span>
        </label>
      </div>
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

      ${this.renderSwitchRow("autoShowHud", s.autoShowHud, t.popup.settingsAutoHud, t.popup.settingsAutoHudDesc)}
      ${this.renderSwitchRow("showInlineBadge", s.showInlineBadge, t.popup.settingsInlineBadge, t.popup.settingsInlineBadgeDesc)}
      ${this.renderSwitchRow("compactMode", s.compactMode, t.popup.settingsCompact, t.popup.settingsCompactDesc)}
      ${this.renderSwitchRow("ratedOnly", s.ratedOnly, t.popup.settingsRatedOnly, t.popup.settingsRatedOnlyDesc)}
      ${this.renderSwitchRow("soundAlerts", s.soundAlerts, t.popup.settingsSoundAlerts, t.popup.settingsSoundAlertsDesc)}
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
            <div class="brand-icon">${ICONS.mark}</div>
            <div>
              <div class="brand-name">${escapeHtml(t.appName)}</div>
              <div class="brand-sub">${escapeHtml(t.appSubtitle)}</div>
            </div>
          </div>
          <div class="top-controls">
            <button class="pill-btn mono" id="quick-lang-btn">${lang === "tr" ? "EN" : "TR"}</button>
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
      const isFromLiveTab = this.activeTabUsername && this.activeTabUsername.toLowerCase() === this.activeResult.username.toLowerCase();
      const report = buildFairPlayEvidenceReport(
        this.activeResult,
        this.settings.language,
        isFromLiveTab ? this.activeTabLiveClock : null
      );
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
