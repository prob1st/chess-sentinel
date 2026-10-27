import { Language, RiskTierId, ConfidenceLevel } from '../types';

export interface Dictionary {
  appName: string;
  appSubtitle: string;
  cheatProbability: string;
  scanningOpponent: string;
  waitingForMatch: string;
  abortWindowActive: string;
  safeToPlay: string;
  cautionAdvised: string;
  considerAborting: string;
  bannedFairPlayBanner: string;
  confidenceLabel: Record<ConfidenceLevel, string>;
  tiers: Record<RiskTierId, { label: string; summary: string }>;
  signals: {
    sectionTitle: string;
    recentWinrate: string;
    overallWinrate: string;
    accuracyAnomaly: string;
    movePacing: string;
    eloVelocity: string;
    accountTrust: string;
  };
  stats: {
    accountAge: string;
    daysShort: string;
    yearsShort: string;
    monthsShort: string;
    recentRecord: string;
    avgAccuracy: string;
    expectedShort: string;
    moveCV: string;
    elo7d: string;
    streak: string;
    noReviewedGames: string;
    gamesAnalyzed: string;
  };
  actions: {
    swapTarget: string;
    watchSuspect: string;
    watchingSuspect: string;
    refresh: string;
    minimize: string;
    expand: string;
    openProfile: string;
    toggleDetails: string;
    hideDetails: string;
    copyReport: string;
    copiedReport: string;
    soundOn: string;
    soundOff: string;
  };
  v3: {
    liveClockTitle: string;
    liveClockMoves: string;
    liveClockSuspect: string;
    livePinpointToggle: string;
    livePinpointFlatline: string;
    pacingHistTitle: string;
    pacingEntropyTag: string;
    recentMatchesTitle: string;
    autoVerdictTitle: string;
    verdictBanned: string;
    verdictLiveToggle: string;
    verdictLiveFlatline: string;
    verdictAbortNow: string;
    verdictHighWatch: string;
    verdictElevatedWatch: string;
    verdictSmurfHuman: string;
    verdictCleanSafe: string;
    pinpointSectionTitle: string;
    pinpointOpenGame: string;
    pinpointToggleRow: string;
    pinpointFlatlineRow: string;
    pinpointCapsRow: string;
  };
  popup: {
    tabScanner: string;
    tabWatchlist: string;
    tabSettings: string;
    searchPlaceholder: string;
    scanBtn: string;
    recentScansTitle: string;
    emptyScans: string;
    watchlistTitle: string;
    checkBansBtn: string;
    checkingBans: string;
    emptyWatchlist: string;
    bannedTag: string;
    activeTag: string;
    addedOn: string;
    removeBtn: string;
    settingsLanguage: string;
    settingsAutoHud: string;
    settingsAutoHudDesc: string;
    settingsInlineBadge: string;
    settingsInlineBadgeDesc: string;
    settingsCompact: string;
    settingsCompactDesc: string;
    settingsRatedOnly: string;
    settingsRatedOnlyDesc: string;
    settingsSoundAlerts: string;
    settingsSoundAlertsDesc: string;
    settingsSensitivity: string;
    sensitivityConservative: string;
    sensitivityBalanced: string;
    sensitivityStrict: string;
    toggleInPageHud: string;
    privacyNote: string;
  };
  flags: Record<string, string>;
}

export const TRANSLATIONS: Record<Language, Dictionary> = {
  tr: {
    appName: 'Chess Sentinel',
    appSubtitle: 'Canlı Hile Olasılığı & Adil Oyun Radarı',
    cheatProbability: 'HİLE OLASILIĞI',
    scanningOpponent: 'Rakip telemetrisi analiz ediliyor…',
    waitingForMatch: 'Rakip bekleniyor…',
    abortWindowActive: 'Güvenli İptal (Abort) Penceresi Açık',
    safeToPlay: 'Normal oyuncu profili — güvenle oynanabilir',
    cautionAdvised: 'Olağandışı sinyaller var — dikkatli oynayın',
    considerAborting: 'Yüksek hile / smurf riski — iptal (abort) düşünün',
    bannedFairPlayBanner: 'CHESS.COM TARAFINDAN HİLEDEN KAPATILDI',
    confidenceLabel: {
      low: 'Düşük Veri Güveni',
      medium: 'Orta Veri Güveni',
      high: 'Yüksek Veri Güveni',
    },
    tiers: {
      low: { label: 'DÜŞÜK RİSK', summary: 'Doğal insan istatistikleri' },
      guarded: { label: 'NORMAL / İZLE', summary: 'Hafif form artışı, normal sınırda' },
      elevated: { label: 'ŞÜPHELİ', summary: 'Birden fazla olağandışı metrik' },
      high: { label: 'YÜKSEK RİSK', summary: 'Güçlü motor veya smurf sinyalleri' },
      critical: { label: 'KRİTİK HİLE RİSKİ', summary: 'Aşırı istatistiksel anomali!' },
      banned: { label: 'YASAKLANDI (%100)', summary: 'Adil Oyun (Fair Play) ihlali' },
    },
    signals: {
      sectionTitle: '6-SİNYALLİ ADLİ TELEMETRİ',
      recentWinrate: 'Son Maç Kazanma Anomalisi',
      overallWinrate: 'Genel Glicko Sapması',
      accuracyAnomaly: 'CAPS2 Doğruluk Sapması',
      movePacing: 'Motor Hamle Ritmi (%clk)',
      eloVelocity: 'Elo Sıçrama Hızı',
      accountTrust: 'Hesap Yaşı & Güven Riski',
    },
    stats: {
      accountAge: 'Hesap Yaşı',
      daysShort: 'gün',
      monthsShort: 'ay',
      yearsShort: 'yıl',
      recentRecord: 'Son Form',
      avgAccuracy: 'Ort. Doğruluk',
      expectedShort: 'beklenen',
      moveCV: 'Hamle Ritmi CV',
      elo7d: '7G Elo Farkı',
      streak: 'Seri',
      noReviewedGames: 'Analizli maç yok',
      gamesAnalyzed: '{count} maç incelendi',
    },
    actions: {
      swapTarget: 'Üst / Alt Oyuncu Değiştir',
      watchSuspect: 'Şüpheliyi Takibe Al',
      watchingSuspect: 'Takipte (Ban İzleniyor)',
      refresh: 'Yeniden Analiz Et',
      minimize: 'Küçült (Alt+S)',
      expand: 'Büyüt',
      openProfile: 'Chess.com Profilini Aç',
      toggleDetails: 'Adli Detayları & Grafikleri Göster',
      hideDetails: 'Detayları Gizle',
      copyReport: '📋 Kanıt Raporunu Kopyala',
      copiedReport: '✓ Rapor Panoya Kopyalandı!',
      soundOn: 'Sesli Risk Uyarısı: Açık',
      soundOff: 'Sesli Risk Uyarısı: Kapalı',
    },
    v3: {
      liveClockTitle: 'CANLI MAÇ HAMLE RADARI',
      liveClockMoves: '{count} hamle • Ort {mean}s • QCD {qcd}',
      liveClockSuspect: '⚡ Canlı maçta mekanik hamle temposu algılandı!',
      livePinpointToggle: '🎯 {pauseMove}. hamlede {pauseSec}sn duraksadı → {start}.–{end}. hamleler sabit robotik ({min}–{max}sn)',
      livePinpointFlatline: '🎯 {start}.–{end}. hamleler arası üst üste {count} hamle sabit robotik ({min}–{max}sn)',
      pacingHistTitle: 'HAMLE SÜRESİ DAĞILIMI (%clk)',
      pacingEntropyTag: 'Entropi: {ent}b • QCD: {qcd}',
      recentMatchesTitle: 'SON PUANLI MAÇLAR',
      autoVerdictTitle: 'OTOMATİK SİSTEM KARARI',
      verdictBanned: '🚨 Bu hesap Chess.com tarafından Adil Oyun (Hile) ihlali nedeniyle resmen kapatılmıştır.',
      verdictLiveToggle: '🎯 CANLI TESPİT: Rakip {pauseMove}. hamlede {pauseSec}sn bekleyip {start}.–{end}. hamleleri sabit makine ritminde ({min}–{max}sn) oynadı! Maç sonu alttan kanıt raporunu kopyalayın.',
      verdictLiveFlatline: '🎯 CANLI TESPİT: Rakip {start}.–{end}. hamleler boyunca üst üste {count} hamleyi sıfır refleksli sabit robotik sürede ({min}–{max}sn) oynuyor!',
      verdictAbortNow: '⛔ ÇOKLU MOTOR KANITI ({pins} şüpheli maç aralığı): Henüz ilk hamlelerdesiniz — puan kaybetmeden MAÇI İPTAL EDİN (Abort).',
      verdictHighWatch: '⚠️ Geçmiş maçlarda çoklu motor imzası bulundu (aşağıda tam hamle numaraları listelendi). Canlı saat radarı şu an her hamleyi izliyor.',
      verdictElevatedWatch: '🔶 Şüpheli hamle ritmi/doğruluk sinyalleri var. Canlı radar aktif — robotik seri oluşursa tam hamle numarasıyla burada otomatik yazacak.',
      verdictSmurfHuman: '🧭 Kazanma serisi yüksek ancak hamle süreleri tamamen doğal insan ritminde. Motor kanıtı YOK (el ile oynayan güçlü oyuncu / smurf).',
      verdictCleanSafe: '✅ İncelenen maçlarda şüpheli hamle aralığı veya motor geçişi yok. Doğal insan profili — güvenle oynayabilirsiniz.',
      pinpointSectionTitle: 'TESPİT EDİLEN ŞÜPHELİ MAÇ & HAMLE ARALIKLARI',
      pinpointOpenGame: 'Maçı Aç ↗',
      pinpointToggleRow: '{pauseMove}. hamlede {pauseSec}sn duraksama → {start}.–{end}. hamleler robotik ({min}–{max}sn)',
      pinpointFlatlineRow: '{start}.–{end}. hamleler arası {count} hamle sabit mekanik tempo ({min}–{max}sn)',
      pinpointCapsRow: '1.–{end}. hamleler boyunca %{acc} motor seviyesi CAPS2 doğruluk',
    },
    popup: {
      tabScanner: 'Oyuncu Tara',
      tabWatchlist: 'Ban Takibi',
      tabSettings: 'Ayarlar',
      searchPlaceholder: 'Chess.com kullanıcı adı yazın (örn. hikaru)…',
      scanBtn: 'Analiz Et',
      recentScansTitle: 'SON İNCELENEN RAKİPLER',
      emptyScans: 'Henüz incelenen rakip yok. Chess.com\'da maça girin veya yukarıdan aratın.',
      watchlistTitle: 'ŞÜPHELİ & BAN TAKİP LİSTESİ',
      checkBansBtn: 'Ban Durumlarını Kontrol Et',
      checkingBans: 'Kontrol ediliyor…',
      emptyWatchlist: 'Takip listeniz boş. Şüpheli rakipleri HUD üzerindeki göz ikonuyla ekleyin.',
      bannedTag: 'BANLANDI (HİLE)',
      activeTag: 'Aktif Hesap',
      addedOn: 'İlk skor: %{prob}',
      removeBtn: 'Kaldır',
      settingsLanguage: 'Arayüz Dili / Language',
      settingsAutoHud: 'Maç Başladığında HUD Pop-up Aç',
      settingsAutoHudDesc: 'Yeni rakip bulunduğunda Chess.com ekranında yüzen analiz kartını otomatik açar.',
      settingsInlineBadge: 'İsim Yanı Mini % Rozeti',
      settingsInlineBadgeDesc: 'Rakibin kullanıcı adının hemen yanına renkli hile olasılığı ve G/M/B rozeti ekler.',
      settingsCompact: 'Kompakt Pop-up Modu',
      settingsCompactDesc: 'HUD kartını varsayılan olarak daraltılmış görünümde başlatır.',
      settingsRatedOnly: 'Sadece Puanlı (Rated) Maçlar',
      settingsRatedOnlyDesc: 'Arkadaşlık / puansız maçları olasılık hesabından hariç tutar.',
      settingsSoundAlerts: 'Kritik Risk Sesli Uyarısı',
      settingsSoundAlertsDesc: 'Yüksek/Kritik riskli (%68+) veya takipteki rakip geldiğinde hafif radar sesi çalar.',
      settingsSensitivity: 'Algılama Hassasiyeti',
      sensitivityConservative: 'Esnek',
      sensitivityBalanced: 'Dengeli (Önerilen)',
      sensitivityStrict: 'Sıkı',
      toggleInPageHud: 'Aktif Sekmede HUD Göster/Gizle',
      privacyNote: '100% Gizli • Sıfır veri toplama • Yalnızca resmi Chess.com PubAPI kullanılır.',
    },
    flags: {
      banned_fair_play: 'Hesap Chess.com Adil Oyun (Hile) ihlali nedeniyle kapatılmış!',
      verified_title: 'Doğrulanmış FIDE unvanlı usta ({title}) — elit istatistik kalibrasyonu uygulandı',
      fresh_high_elo: 'Çok yeni hesap ({days} günlük) olmasına rağmen {rating} Elo seviyesinde',
      fresh_account: 'Yeni açılmış hesap ({days} günlük) — smurf veya yeni hile hesabı riski',
      extreme_recent_wr: 'Son {games} puanlı maçta %{wr} galibiyet (Rakip Elo göre +{z}σ sapma)',
      elevated_recent_wr: 'Son {games} maçta %{wr} galibiyet (+{z}σ Elo üstü performans)',
      smurf_human_pacing: 'Yüksek kazanma oranı ancak hamle ritmi doğal insan dağılımında (olası smurf / formda oyuncu)',
      accuracy_excess: 'Uzun maçlarda Elo bandı beklentisinin (+%{excess}) üzerinde doğruluk (%{avg})',
      accuracy_spikes: 'İncelenen {games} uzun maçın %{rate} kadarında tavan doğruluk (≥%{ceil})',
      robotic_pacing: 'Düşük zaman entropisi ({ent} bit) ve mekanik hamle dağılımı (QCD: {qcd}, CV: {cv})',
      midgame_toggle: '{count} maçta oyun ortası uzun duraksama sonrası mekanik seri (motor açma imzası)',
      elo_surge: 'Son 7 günde +{delta} Elo dikey puan sıçraması',
      hot_streak: 'Üst üste {streak} puanlı galibiyet serisinde',
      tactics_gap: 'Canlı puan ({rating}) ile bulmaca puanı ({tactics}) arasında uçurum var',
      natural_human: 'Doğal insan hamle süresi varyansı (CV: {cv}) ve dengeli kazanma oranı',
      established_veteran: 'Köklü hesap ({years}+ yıllık geçmiş, {total} toplam maç)',
    },
  },
  en: {
    appName: 'Chess Sentinel',
    appSubtitle: 'Live Cheat Probability & Fair-Play Radar',
    cheatProbability: 'CHEAT PROBABILITY',
    scanningOpponent: 'Analyzing opponent telemetry…',
    waitingForMatch: 'Waiting for opponent…',
    abortWindowActive: 'Safe Abort Window Open',
    safeToPlay: 'Normal player patterns — safe to play',
    cautionAdvised: 'Elevated anomaly signals — play with caution',
    considerAborting: 'High engine / smurf probability — consider aborting',
    bannedFairPlayBanner: 'CLOSED BY CHESS.COM FOR FAIR PLAY VIOLATIONS',
    confidenceLabel: {
      low: 'Low Sample Confidence',
      medium: 'Medium Confidence',
      high: 'High Telemetry Confidence',
    },
    tiers: {
      low: { label: 'LOW RISK', summary: 'Organic human patterns' },
      guarded: { label: 'GUARDED', summary: 'Slight hot streak, within normal bounds' },
      elevated: { label: 'SUSPICIOUS', summary: 'Multiple elevated statistical anomalies' },
      high: { label: 'HIGH RISK', summary: 'Strong engine assistance or smurf signals' },
      critical: { label: 'CRITICAL CHEAT RISK', summary: 'Extreme multi-signal anomaly!' },
      banned: { label: 'BANNED (100%)', summary: 'Confirmed Fair Play violation' },
    },
    signals: {
      sectionTitle: '6-SIGNAL FORENSIC TELEMETRY',
      recentWinrate: 'Recent Win-Rate Anomaly',
      overallWinrate: 'Lifetime Glicko Deviation',
      accuracyAnomaly: 'CAPS2 Accuracy Excess',
      movePacing: 'Engine Move Pacing (%clk)',
      eloVelocity: 'Elo Surge Velocity',
      accountTrust: 'Account Age & Trust Risk',
    },
    stats: {
      accountAge: 'Account Age',
      daysShort: 'd',
      monthsShort: 'mo',
      yearsShort: 'yr',
      recentRecord: 'Recent Form',
      avgAccuracy: 'Avg Accuracy',
      expectedShort: 'exp',
      moveCV: 'Move Pace CV',
      elo7d: '7d Elo Delta',
      streak: 'Streak',
      noReviewedGames: 'No reviewed games',
      gamesAnalyzed: '{count} games analyzed',
    },
    actions: {
      swapTarget: 'Swap Top / Bottom Player',
      watchSuspect: 'Add to Suspect Watchlist',
      watchingSuspect: 'Watching (Ban Monitor Active)',
      refresh: 'Re-scan Opponent',
      minimize: 'Minimize (Alt+S)',
      expand: 'Expand HUD',
      openProfile: 'Open Chess.com Profile',
      toggleDetails: 'Show Forensic Charts & Breakdown',
      hideDetails: 'Hide Breakdown',
      copyReport: '📋 Copy Fair-Play Report',
      copiedReport: '✓ Evidence Copied!',
      soundOn: 'Critical Risk Audio Alert: ON',
      soundOff: 'Critical Risk Audio Alert: OFF',
    },
    v3: {
      liveClockTitle: 'LIVE MATCH CLOCK RADAR',
      liveClockMoves: '{count} moves • Avg {mean}s • QCD {qcd}',
      liveClockSuspect: '⚡ Mechanical move pacing detected in live game!',
      livePinpointToggle: '🎯 Move #{pauseMove} ({pauseSec}s pause) → Moves #{start}–#{end} mechanical ({min}–{max}s)',
      livePinpointFlatline: '🎯 Moves #{start}–#{end} ({count} straight moves) locked in mechanical band ({min}–{max}s)',
      pacingHistTitle: 'MOVE-TIME HISTOGRAM (%clk)',
      pacingEntropyTag: 'Entropy: {ent}b • QCD: {qcd}',
      recentMatchesTitle: 'RECENT RATED MATCHES',
      autoVerdictTitle: 'AUTOMATIC SYSTEM VERDICT',
      verdictBanned: '🚨 This account has been officially closed by Chess.com for Fair Play violations.',
      verdictLiveToggle: '🎯 LIVE PINPOINT: Opponent paused {pauseSec}s on Move #{pauseMove}, then played Moves #{start}–#{end} at fixed robotic pace ({min}–{max}s)! Copy the evidence report after the game.',
      verdictLiveFlatline: '🎯 LIVE PINPOINT: Opponent played {count} consecutive moves (#{start}–#{end}) in a zero-reflex mechanical band ({min}–{max}s)!',
      verdictAbortNow: '⛔ CORROBORATED ENGINE EVIDENCE ({pins} suspect game spans): Safe abort window is open — ABORT MATCH NOW to protect your Elo.',
      verdictHighWatch: '⚠️ Corroborated engine signatures found in match history (exact move numbers listed below). Live radar is tracking every move.',
      verdictElevatedWatch: '🔶 Elevated chronometric/accuracy signals. Live radar is active and will pinpoint exact move numbers automatically if triggered.',
      verdictSmurfHuman: '🧭 High win rate, but move times follow natural human variance. NO engine proof (likely hand-played smurf or hot streak).',
      verdictCleanSafe: '✅ Zero suspect move ranges or engine toggles found across match history. Organic human profile — safe to play.',
      pinpointSectionTitle: 'PINPOINTED SUSPECT GAMES & MOVE RANGES',
      pinpointOpenGame: 'Open ↗',
      pinpointToggleRow: 'Move #{pauseMove} ({pauseSec}s pause) → Moves #{start}–#{end} robotic ({min}–{max}s)',
      pinpointFlatlineRow: 'Moves #{start}–#{end} ({count} moves) zero-reflex mechanical pace ({min}–{max}s)',
      pinpointCapsRow: 'Moves #1–#{end} played at {acc}% ceiling CAPS2 accuracy',
    },
    popup: {
      tabScanner: 'Live Scanner',
      tabWatchlist: 'Ban Watchlist',
      tabSettings: 'Settings',
      searchPlaceholder: 'Enter Chess.com username (e.g. hikaru)…',
      scanBtn: 'Analyze',
      recentScansTitle: 'RECENTLY SCANNED OPPONENTS',
      emptyScans: 'No opponents scanned yet. Start a game on Chess.com or search above.',
      watchlistTitle: 'SUSPECT & BAN TRACKER',
      checkBansBtn: 'Check Ban Status Now',
      checkingBans: 'Checking API…',
      emptyWatchlist: 'Watchlist is empty. Click the eye icon on the HUD to track suspicious opponents.',
      bannedTag: 'BANNED (FAIR PLAY)',
      activeTag: 'Active Account',
      addedOn: 'Initial risk: {prob}%',
      removeBtn: 'Remove',
      settingsLanguage: 'Interface Language / Dil',
      settingsAutoHud: 'Auto-Open Floating HUD on Match Start',
      settingsAutoHudDesc: 'Automatically opens the glassmorphic HUD overlay on Chess.com when an opponent is detected.',
      settingsInlineBadge: 'Inline Username % Risk Badge',
      settingsInlineBadgeDesc: 'Injects a compact risk percentage and W/L/D pill right next to the opponent username.',
      settingsCompact: 'Compact HUD Mode',
      settingsCompactDesc: 'Starts the in-page HUD popup with telemetry bars collapsed by default.',
      settingsRatedOnly: 'Rated Games Only',
      settingsRatedOnlyDesc: 'Excludes casual / unrated games when computing cheat probability.',
      settingsSoundAlerts: 'Critical Risk Audio Chime',
      settingsSoundAlertsDesc: 'Plays a subtle radar tone when matched against a High/Critical (≥68%) or watched opponent.',
      settingsSensitivity: 'Detection Sensitivity',
      sensitivityConservative: 'Conservative',
      sensitivityBalanced: 'Balanced (Default)',
      sensitivityStrict: 'Strict',
      toggleInPageHud: 'Toggle HUD on Active Chess.com Tab',
      privacyNote: '100% Private • Zero data collection • Powered strictly by official Chess.com PubAPI.',
    },
    flags: {
      banned_fair_play: 'Account closed by Chess.com for Fair Play (Cheating) violations!',
      verified_title: 'Verified FIDE titled player ({title}) — elite outlier calibration applied',
      fresh_high_elo: 'Brand-new account ({days} days old) already competing at {rating} Elo',
      fresh_account: 'Recently created account ({days} days old) — elevated smurf / burner risk',
      extreme_recent_wr: '{wr}% win rate across last {games} rated games (+{z}σ above opponent Elo expectation)',
      elevated_recent_wr: '{wr}% win rate across last {games} games (+{z}σ Elo-adjusted outperformance)',
      smurf_human_pacing: 'Elevated win rate accompanied by organic human move-time entropy (likely smurf / hot streak)',
      accuracy_excess: '+{excess}% long-game CAPS2 accuracy ({avg}%) above bias-adjusted Elo expectation',
      accuracy_spikes: '{rate}% of {games} full-length reviewed games hit ceiling accuracy (≥{ceil}%)',
      robotic_pacing: 'Collapsed chronometric entropy ({ent} bits) & mechanical move dispersion (QCD: {qcd}, CV: {cv})',
      midgame_toggle: 'Mid-game pause followed by flatline mechanical moves in {count} games (toggle signature)',
      elo_surge: '+{delta} Elo vertical rating surge over the last 7 days',
      hot_streak: 'Currently on a {streak}-game consecutive rated win streak',
      tactics_gap: 'Massive gap between live rating ({rating}) and tactics rating ({tactics})',
      natural_human: 'Organic human move-time variance (CV: {cv}) and balanced win distribution',
      established_veteran: 'Established veteran account ({years}+ years old, {total} lifetime games)',
    },
  },
};

export function formatFlag(lang: Language, flagId: string, params?: Record<string, string | number>): string {
  const template = TRANSLATIONS[lang].flags[flagId] || TRANSLATIONS.en.flags[flagId] || flagId;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
}

export function formatAgeShort(days: number | null, lang: Language): string {
  if (days === null || days < 0) return '—';
  const s = TRANSLATIONS[lang].stats;
  if (days < 60) return `${Math.max(1, days)} ${s.daysShort}`;
  if (days < 365) return `${Math.round(days / 30)} ${s.monthsShort}`;
  const yrs = (days / 365).toFixed(days >= 1095 ? 0 : 1);
  return `${yrs} ${s.yearsShort}`;
}
