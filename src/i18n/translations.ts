import { ConfidenceLevel, Language, RiskTierId } from '../types';

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
  surfaceBadge: {
    live: string;
    game: string;
    profile: string;
  };
  hudTabs: {
    overview: string;
    clock: string;
    games: string;
  };
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
    performance: string;
    avgAccuracy: string;
    expectedShort: string;
    moveCV: string;
    elo7d: string;
    streak: string;
    noReviewedGames: string;
    gamesAnalyzed: string;
    lifetimeGames: string;
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
    reportFairPlay: string;
    soundOn: string;
    soundOff: string;
  };
  v3: {
    liveClockTitle: string;
    finishedClockTitle: string;
    emptyLiveClock: string;
    liveClockMoves: string;
    liveClockSuspect: string;
    livePinpointToggle: string;
    livePinpointFlatline: string;
    pacingHistTitle: string;
    pacingEntropyTag: string;
    recentMatchesTitle: string;
    inspectMoves: string;
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
    activeMatchLabel: string;
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
    appSubtitle: 'Rakip Analizi ve Adil Oyun Kontrolü',
    cheatProbability: 'Risk Skoru',
    scanningOpponent: 'Rakip geçmişi inceleniyor...',
    waitingForMatch: 'Rakip bekleniyor...',
    abortWindowActive: 'Ücretsiz iptal (abort) süresi açık',
    safeToPlay: 'Doğal insan profili, güvenle oynanabilir',
    cautionAdvised: 'Olağandışı metrikler var, dikkatli oynayın',
    considerAborting: 'Yüksek risk sinyali, maçı iptal edebilirsiniz',
    bannedFairPlayBanner: 'Bu hesap Chess.com tarafından adil oyun ihlalinden kapatıldı',
    confidenceLabel: {
      low: 'Az örneklem',
      medium: 'Orta örneklem',
      high: 'Yüksek örneklem',
    },
    surfaceBadge: {
      live: 'Canlı',
      game: 'Maç',
      profile: 'Profil',
    },
    hudTabs: {
      overview: 'Özet',
      clock: 'Maç Saati',
      games: 'Geçmiş',
    },
    tiers: {
      low: { label: 'Temiz', summary: 'Doğal insan istatistikleri' },
      guarded: { label: 'Normal+', summary: 'Formda, normal sınırlar içinde' },
      elevated: { label: 'Şüpheli', summary: 'Birden fazla olağandışı metrik' },
      high: { label: 'Yüksek Risk', summary: 'Güçlü motor veya dış destek sinyali' },
      critical: { label: 'Kritik Risk', summary: 'Çoklu doğrulanmış motor imzası' },
      banned: { label: 'Yasaklı', summary: 'Adil oyun ihlalinden kapatıldı' },
    },
    signals: {
      sectionTitle: 'Alt Sinyaller',
      recentWinrate: 'Son Maç Kazanma Sapması',
      overallWinrate: 'Genel Glicko Dengesi',
      accuracyAnomaly: 'Uzun Maç CAPS2 Sapması',
      movePacing: 'Hamle Süresi Tutarlılığı (%clk)',
      eloVelocity: 'Puan Artış Hızı',
      accountTrust: 'Hesap Yaşı ve Geçmiş',
    },
    stats: {
      accountAge: 'Hesap Yaşı',
      daysShort: 'gün',
      monthsShort: 'ay',
      yearsShort: 'yıl',
      recentRecord: 'Son Form',
      performance: 'Performans',
      avgAccuracy: 'CAPS2 Ort.',
      expectedShort: 'bek.',
      moveCV: 'Hamle Ritmi',
      elo7d: '7 Günlük Elo',
      streak: 'Seri',
      noReviewedGames: 'İncelenen maç yok',
      gamesAnalyzed: '{count} maç',
      lifetimeGames: '{count} maç',
    },
    actions: {
      swapTarget: 'Üst / Alt oyuncuyu değiştir',
      watchSuspect: 'Takip listesine ekle',
      watchingSuspect: 'Takipte (ban kontrolü aktif)',
      refresh: 'Verileri yenile',
      minimize: 'Küçült (Alt+S)',
      expand: 'Paneli aç',
      openProfile: 'Chess.com profilini aç',
      toggleDetails: 'Alt sinyalleri göster',
      hideDetails: 'Alt sinyalleri gizle',
      copyReport: 'Kanıt Kopyala',
      copiedReport: 'Kopyalandı',
      reportFairPlay: 'Bildir',
      soundOn: 'Sesli uyarı açık',
      soundOff: 'Sesli uyarı kapalı',
    },
    v3: {
      liveClockTitle: 'Canlı Maç Hamle Süreleri',
      finishedClockTitle: 'Bu Maçın Hamle Süreleri (0.1sn)',
      emptyLiveClock: 'Canlı hamle süreleri 3. hamleden itibaren burada grafiklenir.',
      liveClockMoves: '{count} hamle · Ort {mean}sn · QCD {qcd}',
      liveClockSuspect: 'Bu maçta mekanik hamle temposu tespit edildi.',
      livePinpointToggle: '{pauseMove}. hamlede {pauseSec}sn duraksama -> {start}.-{end}. hamleler sabit ({min}-{max}sn)',
      livePinpointFlatline: '{start}.-{end}. hamleler arası üst üste {count} hamle sabit aralıkta ({min}-{max}sn)',
      pacingHistTitle: 'Geçmiş Hamle Süresi Dağılımı',
      pacingEntropyTag: 'Entropi {ent}b · QCD {qcd}',
      recentMatchesTitle: 'Son Puanlı Maçlar',
      inspectMoves: 'Süreler',
      autoVerdictTitle: 'Durum',
      verdictBanned: 'Hesap Chess.com tarafından adil oyun ihlali nedeniyle kapatılmış.',
      verdictLiveToggle: 'Aktif maç tespiti: {pauseMove}. hamlede {pauseSec}sn bekleyip {start}.-{end}. hamleleri sabit ritimde ({min}-{max}sn) oynadı.',
      verdictLiveFlatline: 'Aktif maç tespiti: {start}.-{end}. hamleler boyunca üst üste {count} hamleyi sabit sürede ({min}-{max}sn) oynuyor.',
      verdictAbortNow: 'Geçmişte {pins} şüpheli maç aralığı bulundu. İlk hamlelerdesiniz, puan kaybetmeden iptal (abort) edebilirsiniz.',
      verdictHighWatch: 'Geçmiş maçlarda doğrulanmış motor imzası var. Tam hamle aralıkları aşağıda listelendi.',
      verdictElevatedWatch: 'Hamle temposu veya doğruluk verilerinde sapma var. Canlı saat takibi aktif.',
      verdictSmurfHuman: 'Kazanma oranı yüksek fakat hamle süreleri doğal insan dağılımında (olası smurf veya formda oyuncu).',
      verdictCleanSafe: 'İncelenen maçlarda robotik tempo veya oyun ortası motor geçişi görülmedi.',
      pinpointSectionTitle: 'Şüpheli Maç ve Hamle Aralıkları',
      pinpointOpenGame: 'Maçı aç',
      pinpointToggleRow: '{pauseMove}. hamlede {pauseSec}sn duraksama -> {start}.-{end}. hamleler sabit ({min}-{max}sn)',
      pinpointFlatlineRow: '{start}.-{end}. hamleler arası {count} hamle sabit mekanik tempo ({min}-{max}sn)',
      pinpointCapsRow: '1.-{end}. hamleler boyunca %{acc} CAPS2 doğruluk',
    },
    popup: {
      tabScanner: 'Sorgula',
      tabWatchlist: 'Takip Listesi',
      tabSettings: 'Ayarlar',
      activeMatchLabel: 'Açık sekmedeki rakip',
      searchPlaceholder: 'Kullanıcı adı (örn. hikaru)',
      scanBtn: 'İncele',
      recentScansTitle: 'Son İncelenenler',
      emptyScans: 'Henüz oyuncu incelenmedi. Chess.com\'da maça girin veya yukarıdan aratın.',
      watchlistTitle: 'Takip Edilen Hesaplar',
      checkBansBtn: 'Ban Kontrolü',
      checkingBans: 'Kontrol ediliyor...',
      emptyWatchlist: 'Takip listeniz boş. HUD üzerindeki yer imi simgesiyle oyuncu ekleyebilirsiniz.',
      bannedTag: 'Kapatıldı',
      activeTag: 'Aktif',
      addedOn: 'İlk skor: %{prob}',
      removeBtn: 'Sil',
      settingsLanguage: 'Dil / Language',
      settingsAutoHud: 'Maçta paneli otomatik aç',
      settingsAutoHudDesc: 'Rakip algılandığında sağ üstteki analiz panelini otomatik gösterir.',
      settingsInlineBadge: 'Kullanıcı adı yanı rozeti',
      settingsInlineBadgeDesc: 'Rakibin adının yanına sade yüzdelik skor ve galibiyet etiketi ekler.',
      settingsCompact: 'Daraltılmış görünüm',
      settingsCompactDesc: 'Alt sinyal çubuklarını varsayılan olarak kapalı tutar.',
      settingsRatedOnly: 'Yalnızca puanlı maçlar',
      settingsRatedOnlyDesc: 'Puansız maçları hesaplamaya dahil etmez.',
      settingsSoundAlerts: 'Yüksek risk ses uyarısı',
      settingsSoundAlertsDesc: 'Yüksek riskli veya takipteki rakip geldiğinde kısa uyarı sesi çalar.',
      settingsSensitivity: 'Hassasiyet',
      sensitivityConservative: 'Esnek',
      sensitivityBalanced: 'Dengeli (Önerilen)',
      sensitivityStrict: 'Sıkı',
      toggleInPageHud: 'Sekmede Paneli Göster / Gizle',
      privacyNote: 'Veri toplanmaz. Yalnızca herkese açık Chess.com verileri kullanılır.',
    },
    flags: {
      banned_fair_play: 'Chess.com tarafından adil oyun ihlalinden kapatıldı',
      verified_title: 'Onaylı FIDE unvanlı oyuncu ({title})',
      fresh_high_elo: 'Yeni hesap ({days} günlük), {rating} Elo seviyesinde',
      fresh_account: 'Yeni açılmış hesap ({days} günlük)',
      extreme_recent_wr: 'Son {games} maçta %{wr} galibiyet (+{z}σ Elo üstü performans)',
      elevated_recent_wr: 'Son {games} maçta %{wr} galibiyet (+{z}σ beklenti üstü)',
      smurf_human_pacing: 'Yüksek kazanma oranı, doğal insan hamle süreleri (olası smurf)',
      accuracy_excess: 'Uzun maçlarda beklentinin +%{excess} üzerinde doğruluk (%{avg})',
      accuracy_spikes: '{games} uzun maçın %{rate} kadarında ≥%{ceil} tavan doğruluk',
      robotic_pacing: 'Düşük süre çeşitliliği ({ent} bit, QCD {qcd}, CV {cv})',
      midgame_toggle: '{count} maçta uzun duraksama sonrası sabit süreli hamle serisi',
      elo_surge: 'Son 7 günde +{delta} Elo artış',
      hot_streak: 'Üst üste {streak} puanlı galibiyet serisi',
      tactics_gap: 'Canlı puan ({rating}) ile bulmaca puanı ({tactics}) farkı yüksek',
      natural_human: 'Doğal hamle süresi dağılımı (CV {cv})',
      established_veteran: 'Köklü hesap ({years}+ yıl, {total} maç)',
    },
  },
  en: {
    appName: 'Chess Sentinel',
    appSubtitle: 'Opponent Analysis & Fair-Play Monitor',
    cheatProbability: 'Risk Score',
    scanningOpponent: 'Loading opponent history...',
    waitingForMatch: 'Waiting for opponent...',
    abortWindowActive: 'Safe abort window open',
    safeToPlay: 'Organic human profile, safe to play',
    cautionAdvised: 'Unusual signals present, play with care',
    considerAborting: 'High risk indicators, consider aborting',
    bannedFairPlayBanner: 'Account closed by Chess.com for Fair Play violations',
    confidenceLabel: {
      low: 'Low sample',
      medium: 'Medium sample',
      high: 'High sample',
    },
    surfaceBadge: {
      live: 'Live',
      game: 'Game',
      profile: 'Profile',
    },
    hudTabs: {
      overview: 'Summary',
      clock: 'Match Clock',
      games: 'Games',
    },
    tiers: {
      low: { label: 'Clean', summary: 'Organic human statistics' },
      guarded: { label: 'Normal+', summary: 'In form, within normal bounds' },
      elevated: { label: 'Suspicious', summary: 'Multiple elevated metrics' },
      high: { label: 'High Risk', summary: 'Strong engine or relay indicators' },
      critical: { label: 'Critical', summary: 'Corroborated multi-signal anomaly' },
      banned: { label: 'Banned', summary: 'Closed for Fair Play violation' },
    },
    signals: {
      sectionTitle: 'Signal Breakdown',
      recentWinrate: 'Recent Win-Rate Deviation',
      overallWinrate: 'Lifetime Glicko Balance',
      accuracyAnomaly: 'Long-Game CAPS2 Excess',
      movePacing: 'Move-Time Consistency (%clk)',
      eloVelocity: 'Rating Velocity',
      accountTrust: 'Account Age & Provenance',
    },
    stats: {
      accountAge: 'Account Age',
      daysShort: 'd',
      monthsShort: 'mo',
      yearsShort: 'yr',
      recentRecord: 'Recent Form',
      performance: 'Performance',
      avgAccuracy: 'CAPS2 Avg',
      expectedShort: 'exp',
      moveCV: 'Move Pace',
      elo7d: '7d Rating',
      streak: 'Streak',
      noReviewedGames: 'No reviewed games',
      gamesAnalyzed: '{count} games',
      lifetimeGames: '{count} games',
    },
    actions: {
      swapTarget: 'Swap top / bottom player',
      watchSuspect: 'Add to watchlist',
      watchingSuspect: 'Bookmarked (ban check active)',
      refresh: 'Refresh data',
      minimize: 'Minimize (Alt+S)',
      expand: 'Open panel',
      openProfile: 'Open Chess.com profile',
      toggleDetails: 'Show signal breakdown',
      hideDetails: 'Hide signal breakdown',
      copyReport: 'Copy Evidence',
      copiedReport: 'Copied',
      reportFairPlay: 'Report',
      soundOn: 'Sound alert on',
      soundOff: 'Sound alert off',
    },
    v3: {
      liveClockTitle: 'Live Match Move Times',
      finishedClockTitle: 'Match Move Times (0.1s)',
      emptyLiveClock: 'Live move durations appear here starting from move 3.',
      liveClockMoves: '{count} moves · Avg {mean}s · QCD {qcd}',
      liveClockSuspect: 'Mechanical move pacing detected in this game.',
      livePinpointToggle: 'Move #{pauseMove} ({pauseSec}s pause) -> Moves #{start}-#{end} fixed ({min}-{max}s)',
      livePinpointFlatline: 'Moves #{start}-#{end} ({count} straight moves) in narrow band ({min}-{max}s)',
      pacingHistTitle: 'Historical Move-Time Distribution',
      pacingEntropyTag: 'Entropy {ent}b · QCD {qcd}',
      recentMatchesTitle: 'Recent Rated Games',
      inspectMoves: 'Pacing',
      autoVerdictTitle: 'Status',
      verdictBanned: 'Account closed by Chess.com for Fair Play violations.',
      verdictLiveToggle: 'Live match detection: paused {pauseSec}s on Move #{pauseMove}, then played Moves #{start}-#{end} at {min}-{max}s per move.',
      verdictLiveFlatline: 'Live match detection: played {count} straight moves (#{start}-#{end}) within {min}-{max}s per move.',
      verdictAbortNow: '{pins} suspect game spans found in history. Safe abort window is open.',
      verdictHighWatch: 'Corroborated engine patterns found in recent history. Exact move ranges are listed below.',
      verdictElevatedWatch: 'Elevated pacing or accuracy metrics. Live move-clock tracking is active.',
      verdictSmurfHuman: 'High win rate with natural human move-time variance (likely smurf or hot streak).',
      verdictCleanSafe: 'No mechanical move spans or mid-game toggles found across analyzed games.',
      pinpointSectionTitle: 'Suspect Games & Move Ranges',
      pinpointOpenGame: 'Open',
      pinpointToggleRow: 'Move #{pauseMove} ({pauseSec}s pause) -> Moves #{start}-#{end} fixed ({min}-{max}s)',
      pinpointFlatlineRow: 'Moves #{start}-#{end} ({count} moves) narrow mechanical band ({min}-{max}s)',
      pinpointCapsRow: 'Moves #1-#{end} played at {acc}% CAPS2 accuracy',
    },
    popup: {
      tabScanner: 'Lookup',
      tabWatchlist: 'Watchlist',
      tabSettings: 'Settings',
      activeMatchLabel: 'Active tab opponent',
      searchPlaceholder: 'Username (e.g. hikaru)',
      scanBtn: 'Inspect',
      recentScansTitle: 'Recent Lookups',
      emptyScans: 'No players inspected yet. Open a game on Chess.com or search above.',
      watchlistTitle: 'Bookmarked Accounts',
      checkBansBtn: 'Check Bans',
      checkingBans: 'Checking...',
      emptyWatchlist: 'Watchlist is empty. Use the bookmark icon on the panel to track accounts.',
      bannedTag: 'Banned',
      activeTag: 'Active',
      addedOn: 'Initial: {prob}%',
      removeBtn: 'Remove',
      settingsLanguage: 'Language / Dil',
      settingsAutoHud: 'Auto-open panel on match start',
      settingsAutoHudDesc: 'Shows the analysis panel automatically when an opponent is detected.',
      settingsInlineBadge: 'Inline username badge',
      settingsInlineBadgeDesc: 'Places a compact percentage and record tag next to the username.',
      settingsCompact: 'Collapsed breakdown by default',
      settingsCompactDesc: 'Keeps individual signal bars collapsed until expanded.',
      settingsRatedOnly: 'Rated games only',
      settingsRatedOnlyDesc: 'Excludes unrated games from probability calculations.',
      settingsSoundAlerts: 'High-risk audio alert',
      settingsSoundAlertsDesc: 'Plays a short tone when matched with a high-risk or bookmarked account.',
      settingsSensitivity: 'Sensitivity',
      sensitivityConservative: 'Conservative',
      sensitivityBalanced: 'Balanced (Default)',
      sensitivityStrict: 'Strict',
      toggleInPageHud: 'Show / Hide Panel on Tab',
      privacyNote: 'Zero tracking. Uses public Chess.com API data only.',
    },
    flags: {
      banned_fair_play: 'Account closed by Chess.com for Fair Play violations',
      verified_title: 'Verified FIDE titled player ({title})',
      fresh_high_elo: 'New account ({days}d old) competing at {rating} Elo',
      fresh_account: 'Recently created account ({days}d old)',
      extreme_recent_wr: '{wr}% win rate in last {games} games (+{z}σ above Elo expectation)',
      elevated_recent_wr: '{wr}% win rate in last {games} games (+{z}σ above expectation)',
      smurf_human_pacing: 'High win rate with natural human move-time spread (likely smurf)',
      accuracy_excess: '+{excess}% long-game CAPS2 accuracy ({avg}%) above expected band',
      accuracy_spikes: '{rate}% of {games} long reviewed games reached ≥{ceil}% accuracy',
      robotic_pacing: 'Low move-time entropy ({ent}b, QCD {qcd}, CV {cv})',
      midgame_toggle: 'Long pause followed by narrow-band move streak in {count} games',
      elo_surge: '+{delta} Elo gained over the last 7 days',
      hot_streak: '{streak} consecutive rated wins',
      tactics_gap: 'Large gap between live rating ({rating}) and tactics ({tactics})',
      natural_human: 'Natural human move-time dispersion (CV {cv})',
      established_veteran: 'Established account ({years}+ yr, {total} games)',
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
  if (days === null || days < 0) return '-';
  const s = TRANSLATIONS[lang].stats;
  if (days < 60) return `${Math.max(1, days)} ${s.daysShort}`;
  if (days < 365) return `${Math.round(days / 30)} ${s.monthsShort}`;
  const yrs = (days / 365).toFixed(days >= 1095 ? 0 : 1);
  return `${yrs} ${s.yearsShort}`;
}
