// src/api/chesscom-client.ts
var API_BASE = "https://api.chess.com/pub";
var CACHE_TTL_MS = 5 * 60 * 1e3;
var TARGET_MIN_GAMES = 30;
var MAX_ARCHIVES_TO_WALK = 3;
var ChessComApiClient = class {
  memoryCache = /* @__PURE__ */ new Map();
  queue = Promise.resolve();
  enqueue(task) {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => void 0,
      () => void 0
    );
    return run;
  }
  async fetchJson(url, retries = 2) {
    return this.enqueue(async () => {
      let lastError = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 9e3);
        try {
          const response = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json"
            },
            credentials: "omit",
            signal: controller.signal
          });
          clearTimeout(timer);
          if (response.status === 404) {
            throw new Error(`PLAYER_NOT_FOUND`);
          }
          if (response.status === 429) {
            await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
            continue;
          }
          if (!response.ok) {
            throw new Error(`HTTP_${response.status}`);
          }
          const data = await response.json();
          if (typeof data.code === "number" && data.code === 0 && data.message) {
            throw new Error(`CHESSCOM_INTERNAL_ERROR`);
          }
          return data;
        } catch (err) {
          clearTimeout(timer);
          lastError = err instanceof Error ? err : new Error(String(err));
          if (lastError.message === "PLAYER_NOT_FOUND") {
            throw lastError;
          }
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
          }
        }
      }
      throw lastError || new Error("API_FETCH_FAILED");
    });
  }
  async fetchProfileOnly(username) {
    const clean = username.trim().toLowerCase();
    return this.fetchJson(`${API_BASE}/player/${encodeURIComponent(clean)}`);
  }
  async fetchPlayerBundle(username, forceRefresh = false) {
    const clean = username.trim().toLowerCase();
    if (!clean) throw new Error("INVALID_USERNAME");
    if (!forceRefresh) {
      const cached = this.memoryCache.get(clean);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.bundle;
      }
    }
    const profile = await this.fetchProfileOnly(clean);
    let stats = {};
    try {
      stats = await this.fetchJson(
        `${API_BASE}/player/${encodeURIComponent(clean)}/stats`
      );
    } catch {
      stats = {};
    }
    let archiveUrls = [];
    try {
      const archResp = await this.fetchJson(
        `${API_BASE}/player/${encodeURIComponent(clean)}/games/archives`
      );
      archiveUrls = Array.isArray(archResp.archives) ? archResp.archives : [];
    } catch {
      archiveUrls = [];
    }
    const recentGames = [];
    const candidateArchives = archiveUrls.slice(-MAX_ARCHIVES_TO_WALK).reverse();
    for (const archUrl of candidateArchives) {
      try {
        const secureUrl = archUrl.replace(/^http:\/\//i, "https://");
        const monthData = await this.fetchJson(secureUrl, 1);
        if (Array.isArray(monthData.games)) {
          recentGames.push(...monthData.games);
        }
        if (recentGames.length >= TARGET_MIN_GAMES) {
          break;
        }
      } catch {
        continue;
      }
    }
    recentGames.sort((a, b) => (b.end_time || 0) - (a.end_time || 0));
    const trimmedGames = recentGames.slice(0, 120);
    const bundle = {
      username: clean,
      profile,
      stats,
      recentGames: trimmedGames,
      fetchedAt: Date.now()
    };
    this.memoryCache.set(clean, {
      bundle,
      expiresAt: Date.now() + CACHE_TTL_MS
    });
    if (this.memoryCache.size > 60) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) this.memoryCache.delete(oldestKey);
    }
    return bundle;
  }
};
var chessComApi = new ChessComApiClient();

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
    { maxRating: 2400, expected: 88, ceiling: 93.5 },
    { maxRating: Infinity, expected: 91, ceiling: 96 }
  ],
  daily: [
    { maxRating: 1200, expected: 78, ceiling: 88 },
    { maxRating: 1800, expected: 84, ceiling: 92 },
    { maxRating: 2400, expected: 89, ceiling: 95 },
    { maxRating: Infinity, expected: 92, ceiling: 97 }
  ]
};
function getAccuracyBand(format, rating) {
  const list = CAPS2_ACCURACY_BANDS[format] || CAPS2_ACCURACY_BANDS.blitz;
  for (const band of list) {
    if (rating < band.maxRating) return band;
  }
  return list[list.length - 1];
}
var SENSITIVITY_MULTIPLIERS = {
  conservative: 0.84,
  balanced: 1,
  strict: 1.18
};
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
function probabilityToTier(probability, isBanned = false) {
  if (isBanned) return "banned";
  if (probability < 22) return "low";
  if (probability < 40) return "guarded";
  if (probability < 62) return "elevated";
  if (probability < 80) return "high";
  return "critical";
}
function getTitleDampener(title) {
  if (!title) return 1;
  const normalized = title.trim().toUpperCase();
  if (normalized === "GM" || normalized === "WGM") return 0.42;
  if (normalized === "IM" || normalized === "WIM") return 0.58;
  if (normalized === "FM" || normalized === "WFM" || normalized === "NM" || normalized === "CM") {
    return 0.78;
  }
  return 1;
}
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

// src/core/pgn-pacing.ts
var CLK_REGEX = /\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g;
var TC_HEADER_REGEX = /\[TimeControl\s+"(\d+)(?:\+(\d+))?"\]/;
function extractPlayerMoveTimes(pgn, isWhite) {
  if (!pgn || !pgn.includes("%clk")) return null;
  const tcMatch = pgn.match(TC_HEADER_REGEX);
  const baseSec = tcMatch ? Number(tcMatch[1]) : 180;
  const incrementSec = tcMatch && tcMatch[2] ? Number(tcMatch[2]) : 0;
  const allClocks = [];
  let match;
  CLK_REGEX.lastIndex = 0;
  while ((match = CLK_REGEX.exec(pgn)) !== null) {
    const hours = Number(match[1]);
    const mins = Number(match[2]);
    const secs = Number(match[3]);
    allClocks.push(hours * 3600 + mins * 60 + secs);
  }
  if (allClocks.length < 24) {
    return null;
  }
  const playerClocks = allClocks.filter((_, idx) => isWhite ? idx % 2 === 0 : idx % 2 === 1);
  if (playerClocks.length < 12) return null;
  const moveDurationsSec = [];
  for (let i = 1; i < playerClocks.length; i++) {
    const rawElapsed = playerClocks[i - 1] - playerClocks[i] + incrementSec;
    const cleanElapsed = Math.min(240, Math.max(0.1, Number(rawElapsed.toFixed(2))));
    moveDurationsSec.push(cleanElapsed);
  }
  return { incrementSec, baseSec, clocksSec: playerClocks, moveDurationsSec };
}
function analyzeSingleGamePacing(pgn, isWhite, timeClass, won) {
  if (timeClass === "daily") return null;
  const parsed = extractPlayerMoveTimes(pgn, isWhite);
  if (!parsed) return null;
  const { clocksSec, moveDurationsSec } = parsed;
  const scrambleThreshold = timeClass === "bullet" ? 7 : 18;
  const midMoves = [];
  const startIdx = Math.min(8, Math.floor(moveDurationsSec.length * 0.25));
  const endIdx = Math.min(38, moveDurationsSec.length);
  for (let i = startIdx; i < endIdx; i++) {
    const clockRemaining = clocksSec[i + 1] ?? 0;
    if (clockRemaining < scrambleThreshold) break;
    midMoves.push(moveDurationsSec[i]);
  }
  if (midMoves.length < 8) return null;
  const mean = midMoves.reduce((sum, v) => sum + v, 0) / midMoves.length;
  const variance = midMoves.reduce((sum, v) => sum + (v - mean) ** 2, 0) / midMoves.length;
  const std = Math.sqrt(variance);
  const cv = mean > 0 ? std / mean : 1;
  const fastThreshold = timeClass === "bullet" ? 1.1 : timeClass === "blitz" ? 1.8 : 2.3;
  const fastCount = midMoves.filter((t) => t <= fastThreshold).length;
  const fastMoveRatio = fastCount / midMoves.length;
  const roboticLo = timeClass === "bullet" ? 1.4 : 2.3;
  const roboticHi = timeClass === "bullet" ? 4.5 : 8.8;
  const roboticCount = midMoves.filter((t) => t >= roboticLo && t <= roboticHi).length;
  const roboticBandRatio = roboticCount / midMoves.length;
  const minMechanicalMean = timeClass === "bullet" ? 1.3 : 2.5;
  const isFlatline = cv <= 0.44 && mean >= minMechanicalMean && mean <= 11.5 && fastMoveRatio <= 0.09 && roboticBandRatio >= 0.58;
  let hasMidgameToggle = false;
  if (won && timeClass !== "bullet" && moveDurationsSec.length >= 16) {
    const pauseThreshold = timeClass === "blitz" ? 18 : 26;
    const latestToggleIdx = Math.min(22, moveDurationsSec.length - 8);
    for (let i = 4; i <= latestToggleIdx; i++) {
      if (moveDurationsSec[i] >= pauseThreshold && moveDurationsSec[i] <= 110) {
        const postSlice = moveDurationsSec.slice(i + 1, Math.min(i + 13, moveDurationsSec.length));
        if (postSlice.length >= 8) {
          const pMean = postSlice.reduce((a, b) => a + b, 0) / postSlice.length;
          const pStd = Math.sqrt(
            postSlice.reduce((a, b) => a + (b - pMean) ** 2, 0) / postSlice.length
          );
          const pCv = pMean > 0 ? pStd / pMean : 1;
          const bandHits = postSlice.filter((t) => t >= 2 && t <= 9).length / postSlice.length;
          if (pCv <= 0.44 && bandHits >= 0.75 && pMean >= 2.4) {
            hasMidgameToggle = true;
            break;
          }
        }
      }
    }
  }
  return {
    timeClass,
    movesAnalyzed: midMoves.length,
    meanMoveSec: Number(mean.toFixed(2)),
    stdMoveSec: Number(std.toFixed(2)),
    cv: Number(cv.toFixed(3)),
    fastMoveRatio: Number(fastMoveRatio.toFixed(3)),
    roboticBandRatio: Number(roboticBandRatio.toFixed(3)),
    isFlatline,
    hasMidgameToggle,
    won
  };
}
function computeAggregatePacing(games, username, ratedOnly = true) {
  const userLower = username.toLowerCase();
  const sorted = [...games].filter((g) => {
    if (ratedOnly && g.rated === false) return false;
    if (!g.pgn || g.time_class === "daily") return false;
    return g.white?.username?.toLowerCase() === userLower || g.black?.username?.toLowerCase() === userLower;
  }).sort((a, b) => (b.end_time || 0) - (a.end_time || 0)).slice(0, 35);
  const metrics = [];
  for (const g of sorted) {
    const isWhite = g.white?.username?.toLowerCase() === userLower;
    const playerObj = isWhite ? g.white : g.black;
    const won = playerObj?.result === "win";
    const m = analyzeSingleGamePacing(g.pgn || "", isWhite, String(g.time_class || "blitz"), won);
    if (m) metrics.push(m);
  }
  if (metrics.length < 3) {
    return {
      gamesAnalyzed: metrics.length,
      medianCV: null,
      minCV: null,
      meanFastMoveRatio: null,
      meanRoboticBandRatio: null,
      flatlineGames: 0,
      flatlineRate: 0,
      toggleGames: 0,
      pacingScore: 0
    };
  }
  const cvs = metrics.map((m) => m.cv).sort((a, b) => a - b);
  const mid = Math.floor(cvs.length / 2);
  const medianCV = cvs.length % 2 === 0 ? Number(((cvs[mid - 1] + cvs[mid]) / 2).toFixed(2)) : Number(cvs[mid].toFixed(2));
  const minCV = Number(cvs[0].toFixed(2));
  const meanFastMoveRatio = Number(
    (metrics.reduce((s, m) => s + m.fastMoveRatio, 0) / metrics.length).toFixed(3)
  );
  const meanRoboticBandRatio = Number(
    (metrics.reduce((s, m) => s + m.roboticBandRatio, 0) / metrics.length).toFixed(3)
  );
  const flatlineGames = metrics.filter((m) => m.isFlatline).length;
  const flatlineRate = Number((flatlineGames / metrics.length).toFixed(3));
  const toggleGames = metrics.filter((m) => m.hasMidgameToggle).length;
  let cvRisk = 0;
  if (medianCV < 0.62) {
    cvRisk = Math.min(100, (0.62 - medianCV) / 0.3 * 85);
  }
  let flatlineRisk = 0;
  if (flatlineRate >= 0.12) {
    flatlineRisk = Math.min(100, (flatlineRate - 0.1) / 0.35 * 95);
  }
  let instinctDeficitRisk = 0;
  if (meanFastMoveRatio < 0.08 && meanRoboticBandRatio > 0.52) {
    instinctDeficitRisk = Math.min(
      85,
      (0.08 - meanFastMoveRatio) / 0.08 * 50 + (meanRoboticBandRatio - 0.52) / 0.35 * 40
    );
  }
  const toggleBonus = toggleGames >= 2 ? Math.min(35, toggleGames * 14) : toggleGames === 1 ? 10 : 0;
  const sampleWeight2 = metrics.length / (metrics.length + 2.5);
  const rawPacing = Math.max(cvRisk * 0.5 + flatlineRisk * 0.5, flatlineRisk * 0.85, cvRisk * 0.7 + instinctDeficitRisk * 0.35) + toggleBonus;
  const pacingScore = Math.min(100, Math.max(0, Math.round(rawPacing * sampleWeight2)));
  return {
    gamesAnalyzed: metrics.length,
    medianCV,
    minCV,
    meanFastMoveRatio,
    meanRoboticBandRatio,
    flatlineGames,
    flatlineRate,
    toggleGames,
    pacingScore
  };
}

// src/core/engine.ts
var ALL_FORMATS = ["rapid", "blitz", "bullet", "daily"];
function sampleWeight(n, k = 16) {
  if (n <= 0) return 0;
  return n / (n + k);
}
function computeWinrateSignal(wins, total, k = 16) {
  if (total < 3) return 0;
  const wr = wins / total;
  if (wr <= 0.51) return 0;
  let raw = 0;
  if (wr <= 0.58) {
    raw = (wr - 0.51) / 0.07 * 32;
  } else if (wr <= 0.66) {
    raw = 32 + (wr - 0.58) / 0.08 * 38;
  } else if (wr <= 0.75) {
    raw = 70 + (wr - 0.66) / 0.09 * 30;
  } else {
    raw = 100 + (wr - 0.75) / 0.1 * 35;
  }
  return Math.min(100, Math.round(raw * sampleWeight(total, k)));
}
function computeAccuracySignal(avgAccuracy, expected, highAccRate, reviewedGames) {
  if (avgAccuracy === null || reviewedGames < 2) return 0;
  const excess = avgAccuracy - expected;
  let excessScore = 0;
  if (excess > 0.5) {
    if (excess <= 4) excessScore = (excess - 0.5) / 3.5 * 35;
    else if (excess <= 8) excessScore = 35 + (excess - 4) / 4 * 40;
    else excessScore = Math.min(105, 75 + (excess - 8) / 5 * 30);
  }
  let spikeScore = 0;
  if (highAccRate > 0.12) {
    if (highAccRate <= 0.28) spikeScore = (highAccRate - 0.12) / 0.16 * 50;
    else if (highAccRate <= 0.45) spikeScore = 50 + (highAccRate - 0.28) / 0.17 * 40;
    else spikeScore = Math.min(105, 90 + (highAccRate - 0.45) / 0.25 * 20);
  }
  const conf = sampleWeight(reviewedGames, 8);
  return Math.min(100, Math.round((0.6 * excessScore + 0.4 * spikeScore) * conf));
}
function computeEloVelocitySignal(eloDelta7d, eloDelta30d, winStreak, rd) {
  const rdDamper = rd !== null && rd > 130 ? 0.65 : 1;
  let surge7 = 0;
  if (eloDelta7d !== null && eloDelta7d > 55) {
    surge7 = Math.min(100, (eloDelta7d - 55) / 185 * 95) * rdDamper;
  }
  let surge30 = 0;
  if (eloDelta30d !== null && eloDelta30d > 95) {
    surge30 = Math.min(100, (eloDelta30d - 95) / 260 * 90) * rdDamper;
  }
  let streakScore = 0;
  if (winStreak >= 6) {
    streakScore = Math.min(95, (winStreak - 5) / 10 * 85);
  }
  return Math.min(100, Math.round(Math.max(surge7, surge30 * 0.9) * 0.72 + streakScore * 0.45));
}
function computeAccountTrustSignal(accountAgeDays, bestLiveRating, lifetimeGames, stats) {
  let ageRisk = 0;
  let ageMultiplier = 1;
  if (accountAgeDays !== null) {
    if (accountAgeDays <= 7) {
      ageRisk = 92;
      ageMultiplier = 1.52;
    } else if (accountAgeDays <= 14) {
      ageRisk = 78;
      ageMultiplier = 1.4;
    } else if (accountAgeDays <= 30) {
      ageRisk = 64;
      ageMultiplier = 1.3;
    } else if (accountAgeDays <= 90) {
      ageRisk = 46;
      ageMultiplier = 1.18;
    } else if (accountAgeDays <= 180) {
      ageRisk = 28;
      ageMultiplier = 1.09;
    } else if (accountAgeDays <= 365) {
      ageRisk = 14;
      ageMultiplier = 1.03;
    } else if (accountAgeDays >= 1095 && lifetimeGames >= 800) {
      ageRisk = 0;
      ageMultiplier = 0.9;
    }
  }
  if (accountAgeDays !== null && accountAgeDays <= 75 && bestLiveRating >= 1650) {
    const ratingExcess = Math.min(25, (bestLiveRating - 1600) / 600 * 25);
    ageRisk = Math.min(100, ageRisk + ratingExcess);
    ageMultiplier = Math.min(1.68, ageMultiplier + 0.14);
  }
  const tacticsHighest = stats.tactics?.highest?.rating ?? null;
  let tacticsGapRating = null;
  if (bestLiveRating >= 1850 && tacticsHighest !== null && tacticsHighest > 0 && bestLiveRating - tacticsHighest >= 900) {
    tacticsGapRating = tacticsHighest;
    ageRisk = Math.min(100, ageRisk + 26);
  }
  return {
    trustRiskScore: Math.round(ageRisk),
    ageMultiplier,
    tacticsGapRating
  };
}
function extractCountryCode(countryUrl) {
  if (!countryUrl) return null;
  const parts = countryUrl.split("/").filter(Boolean);
  const code = parts[parts.length - 1];
  return code && code.length === 2 ? code.toUpperCase() : null;
}
function buildFormatTelemetry(format, stats, games, usernameLower, ratedOnly, nowSec) {
  const recObj = stats[`chess_${format}`];
  const currentRating = recObj?.last?.rating ?? null;
  const peakRating = recObj?.best?.rating ?? currentRating;
  const rd = recObj?.last?.rd ?? null;
  const overallWins = recObj?.record?.win ?? 0;
  const overallLosses = recObj?.record?.loss ?? 0;
  const overallDraws = recObj?.record?.draw ?? 0;
  const overallTotal = overallWins + overallLosses + overallDraws;
  const overallWinPct = overallTotal > 0 ? Math.round(overallWins / overallTotal * 100) : 0;
  const effectiveRating = currentRating || peakRating || 1200;
  const band = getAccuracyBand(format, effectiveRating);
  let recentWins = 0;
  let recentLosses = 0;
  let recentDraws = 0;
  let accSum = 0;
  let reviewedGames = 0;
  let highAccCount = 0;
  const sevenDaysCutoff = nowSec - 7 * 86400;
  const thirtyDaysCutoff = nowSec - 30 * 86400;
  let oldest7Ts = Infinity;
  let newest7Ts = -Infinity;
  let oldest7Rating = null;
  let newest7Rating = null;
  let oldest30Ts = Infinity;
  let newest30Ts = -Infinity;
  let oldest30Rating = null;
  let newest30Rating = null;
  for (const g of games) {
    if (g.time_class !== format) continue;
    if (ratedOnly && g.rated === false) continue;
    const isWhite = g.white?.username?.toLowerCase() === usernameLower;
    const isBlack = g.black?.username?.toLowerCase() === usernameLower;
    if (!isWhite && !isBlack) continue;
    const player = isWhite ? g.white : g.black;
    if (!player) continue;
    if (player.result === "win") recentWins++;
    else if (["checkmated", "resigned", "timeout", "abandoned", "lose"].includes(player.result)) {
      recentLosses++;
    } else {
      recentDraws++;
    }
    const acc = g.accuracies ? isWhite ? g.accuracies.white : g.accuracies.black : null;
    if (typeof acc === "number" && !Number.isNaN(acc)) {
      reviewedGames++;
      accSum += acc;
      if (acc >= band.ceiling) highAccCount++;
    }
    const ts = g.end_time || 0;
    const r = player.rating;
    if (ts > 0 && typeof r === "number") {
      if (ts >= sevenDaysCutoff) {
        if (ts < oldest7Ts) {
          oldest7Ts = ts;
          oldest7Rating = r;
        }
        if (ts > newest7Ts) {
          newest7Ts = ts;
          newest7Rating = r;
        }
      }
      if (ts >= thirtyDaysCutoff) {
        if (ts < oldest30Ts) {
          oldest30Ts = ts;
          oldest30Rating = r;
        }
        if (ts > newest30Ts) {
          newest30Ts = ts;
          newest30Rating = r;
        }
      }
    }
  }
  const recentTotal = recentWins + recentLosses + recentDraws;
  const recentWinPct = recentTotal > 0 ? Math.round(recentWins / recentTotal * 100) : 0;
  const avgAccuracy = reviewedGames > 0 ? Number((accSum / reviewedGames).toFixed(1)) : null;
  const highAccRate = reviewedGames > 0 ? Number((highAccCount / reviewedGames).toFixed(3)) : 0;
  const eloDelta7d = oldest7Rating !== null && newest7Rating !== null && newest7Ts > oldest7Ts ? newest7Rating - oldest7Rating : null;
  const eloDelta30d = oldest30Rating !== null && newest30Rating !== null && newest30Ts > oldest30Ts ? newest30Rating - oldest30Rating : null;
  return {
    format,
    currentRating,
    peakRating,
    rd,
    overallWins,
    overallLosses,
    overallDraws,
    overallTotal,
    overallWinPct,
    recentWins,
    recentLosses,
    recentDraws,
    recentTotal,
    recentWinPct,
    avgAccuracy,
    expectedAccuracy: band.expected,
    highAccCeiling: band.ceiling,
    highAccRate,
    reviewedGames,
    eloDelta7d,
    eloDelta30d,
    formatProbability: 0
  };
}
function analyzePlayerBundle(bundle, options = {}) {
  const ratedOnly = options.ratedOnly ?? true;
  const sensitivity = options.sensitivity ?? "balanced";
  const nowMs = options.nowMs ?? Date.now();
  const nowSec = Math.floor(nowMs / 1e3);
  const { profile, stats, recentGames } = bundle;
  const usernameLower = (profile.username || bundle.username).toLowerCase();
  const displayName = profile.username || bundle.username;
  const accountStatus = profile.status || "basic";
  const isBannedFairPlay = accountStatus.toLowerCase().includes("fair_play_violations");
  const accountAgeDays = profile.joined ? Math.max(0, Math.round((nowSec - profile.joined) / 86400)) : null;
  const validGames = [...recentGames].filter((g) => {
    if (ratedOnly && g.rated === false) return false;
    return g.white?.username?.toLowerCase() === usernameLower || g.black?.username?.toLowerCase() === usernameLower;
  }).sort((a, b) => (b.end_time || 0) - (a.end_time || 0));
  let winStreak = 0;
  for (const g of validGames) {
    const p = g.white?.username?.toLowerCase() === usernameLower ? g.white : g.black;
    if (p?.result === "win") winStreak++;
    else break;
  }
  const recentForm = validGames.slice(0, 8).map((g) => {
    const p = g.white?.username?.toLowerCase() === usernameLower ? g.white : g.black;
    if (p?.result === "win") return "W";
    if (["checkmated", "resigned", "timeout", "abandoned", "lose"].includes(p?.result || "")) {
      return "L";
    }
    return "D";
  });
  const pacing = computeAggregatePacing(validGames, usernameLower, ratedOnly);
  const formats = {};
  let bestLiveRating = 0;
  let lifetimeGames = 0;
  for (const fmt of ALL_FORMATS) {
    const ft = buildFormatTelemetry(fmt, stats, validGames, usernameLower, ratedOnly, nowSec);
    formats[fmt] = ft;
    lifetimeGames += ft.overallTotal;
    if (fmt !== "daily" && (ft.currentRating || 0) > bestLiveRating) {
      bestLiveRating = ft.currentRating || 0;
    }
  }
  const { trustRiskScore, ageMultiplier, tacticsGapRating } = computeAccountTrustSignal(
    accountAgeDays,
    bestLiveRating,
    lifetimeGames,
    stats
  );
  const titleDampener = getTitleDampener(profile.title);
  const sensitivityMult = SENSITIVITY_MULTIPLIERS[sensitivity] ?? 1;
  const formatBreakdowns = {};
  for (const fmt of ALL_FORMATS) {
    const ft = formats[fmt];
    const rwr = computeWinrateSignal(ft.recentWins, ft.recentTotal, 14);
    const owr = computeWinrateSignal(ft.overallWins, ft.overallTotal, 22);
    const acc = computeAccuracySignal(
      ft.avgAccuracy,
      ft.expectedAccuracy,
      ft.highAccRate,
      ft.reviewedGames
    );
    const pace = fmt === "daily" ? 0 : pacing.pacingScore;
    const vel = computeEloVelocitySignal(ft.eloDelta7d, ft.eloDelta30d, winStreak, ft.rd);
    formatBreakdowns[fmt] = {
      recentWinrate: rwr,
      overallWinrate: owr,
      accuracyAnomaly: acc,
      movePacing: pace,
      eloVelocity: vel,
      accountTrust: trustRiskScore
    };
    const hasAcc = ft.reviewedGames >= 2;
    const hasPacing = fmt !== "daily" && pacing.gamesAnalyzed >= 3;
    let wRwr = 0.25;
    let wOwr = 0.16;
    let wAcc = hasAcc ? 0.25 : 0;
    let wPace = hasPacing ? 0.18 : 0;
    let wVel = 0.08;
    let wTrust = 0.08;
    const activeWeightSum = wRwr + wOwr + wAcc + wPace + wVel + wTrust;
    wRwr /= activeWeightSum;
    wOwr /= activeWeightSum;
    wAcc /= activeWeightSum;
    wPace /= activeWeightSum;
    wVel /= activeWeightSum;
    wTrust /= activeWeightSum;
    const weightedCore = wRwr * rwr + wOwr * owr + wAcc * acc + wPace * pace + wVel * vel + wTrust * trustRiskScore;
    const strongSignals = [rwr >= 60, owr >= 58, acc >= 60, pace >= 55, trustRiskScore >= 65].filter(
      Boolean
    ).length;
    const synergyMultiplier = strongSignals >= 3 ? 1.22 : strongSignals === 2 ? 1.1 : 1;
    const rawProb = weightedCore * ageMultiplier * synergyMultiplier * titleDampener * sensitivityMult;
    const floor = profile.title ? 1 : 3;
    ft.formatProbability = ft.overallTotal < 3 && ft.recentTotal < 3 ? floor : Math.min(99, Math.max(floor, Math.round(rawProb)));
  }
  let primaryFormat = "blitz";
  let maxFormatProb = -1;
  let maxFormat = "blitz";
  for (const fmt of LIVE_FORMATS) {
    if (formats[fmt].formatProbability > maxFormatProb) {
      maxFormatProb = formats[fmt].formatProbability;
      maxFormat = fmt;
    }
  }
  if (options.preferredFormat && (formats[options.preferredFormat].recentTotal >= 3 || formats[options.preferredFormat].overallTotal >= 5)) {
    primaryFormat = options.preferredFormat;
  } else if (maxFormatProb > 0) {
    primaryFormat = maxFormat;
  } else {
    primaryFormat = LIVE_FORMATS.slice().sort((a, b) => formats[b].overallTotal - formats[a].overallTotal)[0] || "blitz";
  }
  let probability = formats[primaryFormat].formatProbability;
  if (primaryFormat !== maxFormat && maxFormatProb > probability + 18) {
    probability = Math.round(probability * 0.45 + maxFormatProb * 0.55);
    primaryFormat = maxFormat;
  }
  if (isBannedFairPlay) {
    probability = 100;
  }
  const signals = formatBreakdowns[primaryFormat];
  const pf = formats[primaryFormat];
  const totalSample = pf.recentTotal + Math.min(30, pf.overallTotal);
  let confidence = "low";
  if (isBannedFairPlay || totalSample >= 25 && (pacing.gamesAnalyzed >= 5 || pf.reviewedGames >= 4)) {
    confidence = "high";
  } else if (totalSample >= 10) {
    confidence = "medium";
  }
  const flags = [];
  if (isBannedFairPlay) {
    flags.push({ id: "banned_fair_play", severity: "danger", icon: "\u{1F6A8}" });
  }
  if (profile.title) {
    flags.push({
      id: "verified_title",
      severity: "info",
      icon: "\u{1F451}",
      params: { title: profile.title.toUpperCase() }
    });
  }
  if (accountAgeDays !== null && accountAgeDays <= 45 && (pf.currentRating || 0) >= 1650) {
    flags.push({
      id: "fresh_high_elo",
      severity: "danger",
      icon: "\u{1F195}",
      params: { days: Math.max(1, accountAgeDays), rating: pf.currentRating || 0 }
    });
  } else if (accountAgeDays !== null && accountAgeDays <= 30) {
    flags.push({
      id: "fresh_account",
      severity: "warning",
      icon: "\u{1F195}",
      params: { days: Math.max(1, accountAgeDays) }
    });
  }
  if (pf.recentTotal >= 8 && pf.recentWinPct >= 68) {
    flags.push({
      id: "extreme_recent_wr",
      severity: "danger",
      icon: "\u{1F6A9}",
      params: { games: pf.recentTotal, wr: pf.recentWinPct }
    });
  } else if (pf.recentTotal >= 8 && pf.recentWinPct >= 58) {
    flags.push({
      id: "elevated_recent_wr",
      severity: "warning",
      icon: "\u{1F4C8}",
      params: { games: pf.recentTotal, wr: pf.recentWinPct }
    });
  }
  if (pf.reviewedGames >= 3 && pf.avgAccuracy !== null && pf.avgAccuracy - pf.expectedAccuracy >= 3.5) {
    const excess = Number((pf.avgAccuracy - pf.expectedAccuracy).toFixed(1));
    flags.push({
      id: "accuracy_excess",
      severity: excess >= 6.5 ? "danger" : "warning",
      icon: "\u{1F3AF}",
      params: { excess, avg: pf.avgAccuracy }
    });
  }
  if (pf.reviewedGames >= 4 && pf.highAccRate >= 0.25) {
    flags.push({
      id: "accuracy_spikes",
      severity: pf.highAccRate >= 0.4 ? "danger" : "warning",
      icon: "\u26A1",
      params: { games: pf.reviewedGames, rate: Math.round(pf.highAccRate * 100), ceil: pf.highAccCeiling }
    });
  }
  if (pacing.gamesAnalyzed >= 4 && pacing.pacingScore >= 48 && pacing.medianCV !== null) {
    flags.push({
      id: "robotic_pacing",
      severity: pacing.pacingScore >= 70 ? "danger" : "warning",
      icon: "\u23F1\uFE0F",
      params: { cv: pacing.medianCV }
    });
  }
  if (pacing.toggleGames >= 1) {
    flags.push({
      id: "midgame_toggle",
      severity: pacing.toggleGames >= 2 ? "danger" : "warning",
      icon: "\u{1F916}",
      params: { count: pacing.toggleGames }
    });
  }
  if (pf.eloDelta7d !== null && pf.eloDelta7d >= 85) {
    flags.push({
      id: "elo_surge",
      severity: pf.eloDelta7d >= 160 ? "danger" : "warning",
      icon: "\u{1F680}",
      params: { delta: pf.eloDelta7d }
    });
  }
  if (winStreak >= 6) {
    flags.push({
      id: "hot_streak",
      severity: winStreak >= 10 ? "danger" : "warning",
      icon: "\u{1F525}",
      params: { streak: winStreak }
    });
  }
  if (tacticsGapRating !== null && (pf.currentRating || bestLiveRating) >= 1850) {
    flags.push({
      id: "tactics_gap",
      severity: "warning",
      icon: "\u{1F9E9}",
      params: { rating: pf.currentRating || bestLiveRating, tactics: tacticsGapRating }
    });
  }
  if (!isBannedFairPlay && probability < 28) {
    if (pacing.medianCV !== null && pacing.medianCV >= 0.72) {
      flags.push({
        id: "natural_human",
        severity: "positive",
        icon: "\u2705",
        params: { cv: pacing.medianCV }
      });
    }
    if (accountAgeDays !== null && accountAgeDays >= 730 && lifetimeGames >= 500) {
      flags.push({
        id: "established_veteran",
        severity: "positive",
        icon: "\u{1F6E1}\uFE0F",
        params: { years: Math.floor(accountAgeDays / 365), total: lifetimeGames }
      });
    }
  }
  const tier = probabilityToTier(probability, isBannedFairPlay);
  return {
    username: usernameLower,
    displayName,
    avatarUrl: profile.avatar || null,
    countryCode: extractCountryCode(profile.country),
    title: profile.title || null,
    accountStatus,
    isBannedFairPlay,
    accountAgeDays,
    joinedTimestamp: profile.joined || null,
    primaryFormat,
    probability,
    tier,
    confidence,
    winStreak,
    recentForm,
    signals,
    pacing,
    formats,
    flags: flags.slice(0, 5),
    analyzedGamesCount: validGames.length,
    timestamp: nowMs
  };
}

// src/storage/store.ts
var KEYS = {
  SETTINGS: "sentinel_settings_v1",
  WATCHLIST: "sentinel_watchlist_v1",
  RECENT_SCANS: "sentinel_recent_scans_v1"
};
var MAX_RECENT_SCANS = 20;
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
async function saveWatchlist(list) {
  if (!hasChromeStorage()) return;
  try {
    await chrome.storage.local.set({ [KEYS.WATCHLIST]: list });
  } catch {
  }
}
async function toggleWatchlistEntry(entry) {
  const list = await getWatchlist();
  const userLower = entry.username.toLowerCase();
  const existingIdx = list.findIndex((item) => item.username.toLowerCase() === userLower);
  if (existingIdx >= 0) {
    list.splice(existingIdx, 1);
    await saveWatchlist(list);
    return { added: false, list };
  }
  const now = Date.now();
  const fullEntry = {
    ...entry,
    username: userLower,
    addedAt: now,
    lastCheckedAt: now
  };
  const next = [fullEntry, ...list].slice(0, 150);
  await saveWatchlist(next);
  return { added: true, list: next };
}
async function removeWatchlistEntry(username) {
  const list = await getWatchlist();
  const userLower = username.toLowerCase();
  const next = list.filter((item) => item.username.toLowerCase() !== userLower);
  await saveWatchlist(next);
  return next;
}
async function getRecentScans() {
  if (!hasChromeStorage()) return [];
  try {
    const res = await chrome.storage.local.get(KEYS.RECENT_SCANS);
    return Array.isArray(res[KEYS.RECENT_SCANS]) ? res[KEYS.RECENT_SCANS] : [];
  } catch {
    return [];
  }
}
async function recordRecentScan(result) {
  if (!hasChromeStorage()) return;
  try {
    const current = await getRecentScans();
    const filtered = current.filter(
      (item) => item.username.toLowerCase() !== result.username.toLowerCase()
    );
    const next = [result, ...filtered].slice(0, MAX_RECENT_SCANS);
    await chrome.storage.local.set({ [KEYS.RECENT_SCANS]: next });
  } catch {
  }
}

// src/background/index.ts
var WATCHLIST_ALARM = "chess_sentinel_ban_check";
function setTabBadge(tabId, probability, tierColor) {
  if (!tabId || typeof chrome === "undefined" || !chrome.action) return;
  try {
    void chrome.action.setBadgeText({ tabId, text: `${probability}%` });
    void chrome.action.setBadgeBackgroundColor({ tabId, color: tierColor });
  } catch {
  }
}
async function refreshWatchlistBans() {
  const list = await getWatchlist();
  if (list.length === 0) return list;
  const updated = [];
  for (const item of list) {
    try {
      const profile = await chessComApi.fetchProfileOnly(item.username);
      const status = profile.status || "basic";
      const isBannedFairPlay = status.toLowerCase().includes("fair_play_violations");
      updated.push({
        ...item,
        accountStatus: status,
        isBannedFairPlay,
        avatarUrl: profile.avatar || item.avatarUrl,
        lastCheckedAt: Date.now()
      });
    } catch {
      updated.push({ ...item, lastCheckedAt: Date.now() });
    }
  }
  await saveWatchlist(updated);
  return updated;
}
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.alarms) {
    chrome.alarms.create(WATCHLIST_ALARM, { periodInMinutes: 720 });
  }
});
if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === WATCHLIST_ALARM) {
      void refreshWatchlistBans();
    }
  });
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void (async () => {
    try {
      switch (message.type) {
        case "ANALYZE_PLAYER": {
          const settings = await getSettings();
          const bundle = await chessComApi.fetchPlayerBundle(
            message.username,
            Boolean(message.forceRefresh)
          );
          const result = analyzePlayerBundle(bundle, {
            preferredFormat: message.preferredFormat,
            ratedOnly: settings.ratedOnly,
            sensitivity: settings.sensitivity
          });
          await recordRecentScan(result);
          setTabBadge(sender.tab?.id, result.probability, TIER_THEMES[result.tier].color);
          sendResponse({ ok: true, result });
          break;
        }
        case "GET_SETTINGS": {
          const settings = await getSettings();
          sendResponse({ ok: true, settings });
          break;
        }
        case "UPDATE_SETTINGS": {
          const settings = await updateSettings(message.patch);
          sendResponse({ ok: true, settings });
          break;
        }
        case "GET_WATCHLIST": {
          const list = await getWatchlist();
          sendResponse({ ok: true, list });
          break;
        }
        case "TOGGLE_WATCHLIST": {
          const { added, list } = await toggleWatchlistEntry(message.entry);
          sendResponse({ ok: true, added, list });
          break;
        }
        case "REMOVE_WATCHLIST": {
          const list = await removeWatchlistEntry(message.username);
          sendResponse({ ok: true, list });
          break;
        }
        case "REFRESH_WATCHLIST_BANS": {
          const list = await refreshWatchlistBans();
          sendResponse({ ok: true, list });
          break;
        }
        case "GET_RECENT_SCANS": {
          const scans = await getRecentScans();
          sendResponse({ ok: true, scans });
          break;
        }
        default:
          sendResponse({ ok: false, error: "UNKNOWN_MESSAGE" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UNKNOWN_ERROR";
      sendResponse({ ok: false, error: msg });
    }
  })();
  return true;
});
