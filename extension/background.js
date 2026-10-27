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
  if (probability < 30) return "low";
  if (probability < 55) return "guarded";
  if (probability < 75) return "elevated";
  if (probability < 90) return "high";
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
  soundAlerts: true,
  sensitivity: "balanced",
  hudPosition: null
};
var LIVE_FORMATS = ["rapid", "blitz", "bullet"];

// src/core/pgn-pacing.ts
var CLK_REGEX = /\{[^}]*\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\][^}]*\}/g;
var SAN_TOKEN_REGEX = /(?:O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/g;
var TC_HEADER_REGEX = /\[TimeControl\s+"(\d+)(?:\+(\d+))?"\]/;
var LOG_TIME_BINS = [0.9, 1.8, 3.2, 5.5, 9.5, 18];
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
function computeLogTimeBuckets(durations) {
  const counts = new Array(LOG_TIME_BINS.length + 1).fill(0);
  if (durations.length === 0) return { counts, entropyBits: 0 };
  for (const d of durations) {
    let placed = false;
    for (let i = 0; i < LOG_TIME_BINS.length; i++) {
      if (d < LOG_TIME_BINS[i]) {
        counts[i]++;
        placed = true;
        break;
      }
    }
    if (!placed) counts[LOG_TIME_BINS.length]++;
  }
  let entropy = 0;
  const n = durations.length;
  for (const c of counts) {
    if (c > 0) {
      const p = c / n;
      entropy -= p * Math.log2(p);
    }
  }
  return { counts, entropyBits: entropy };
}
function extractPlayerMoveTimes(pgn, isWhite) {
  if (!pgn || !pgn.includes("%clk")) return null;
  const tcMatch = pgn.match(TC_HEADER_REGEX);
  const baseSec = tcMatch ? Number(tcMatch[1]) : 180;
  const incrementSec = tcMatch && tcMatch[2] ? Number(tcMatch[2]) : 0;
  const movetextStart = pgn.indexOf("\n\n");
  const body = movetextStart >= 0 ? pgn.slice(movetextStart + 2) : pgn.replace(/\[[^\]]*\]/g, " ");
  const allClocks = [];
  const allSan = [];
  let prevEnd = 0;
  let match;
  CLK_REGEX.lastIndex = 0;
  while ((match = CLK_REGEX.exec(body)) !== null) {
    const hours = Number(match[1]);
    const mins = Number(match[2]);
    const secs = Number(match[3]);
    allClocks.push(hours * 3600 + mins * 60 + secs);
    const segment = body.slice(prevEnd, match.index).replace(/\{[^}]*\}/g, " ").replace(/\d+\.+/g, " ");
    const sanMatches = segment.match(SAN_TOKEN_REGEX);
    allSan.push(sanMatches && sanMatches.length > 0 ? sanMatches[sanMatches.length - 1] : "");
    prevEnd = match.index + match[0].length;
  }
  if (allClocks.length < 30) {
    return null;
  }
  const playerClocks = [];
  const playerSanMoves = [];
  for (let idx = 0; idx < allClocks.length; idx++) {
    const belongs = isWhite ? idx % 2 === 0 : idx % 2 === 1;
    if (belongs) {
      playerClocks.push(allClocks[idx]);
      const fullMoveNo = Math.floor(idx / 2) + 1;
      const prefix = isWhite ? `${fullMoveNo}.` : `${fullMoveNo}...`;
      playerSanMoves.push(allSan[idx] ? `${prefix}${allSan[idx]}` : `${prefix}?`);
    }
  }
  if (playerClocks.length < 15) return null;
  const moveDurationsSec = [];
  for (let i = 1; i < playerClocks.length; i++) {
    const rawElapsed = playerClocks[i - 1] - playerClocks[i] + incrementSec;
    const cleanElapsed = Math.min(240, Math.max(0.1, Number(rawElapsed.toFixed(2))));
    moveDurationsSec.push(cleanElapsed);
  }
  return {
    incrementSec,
    baseSec,
    totalPlies: allClocks.length,
    clocksSec: playerClocks,
    moveDurationsSec,
    playerSanMoves
  };
}
function analyzeSingleGamePacing(pgn, isWhite, timeClass, won) {
  if (timeClass === "daily") return null;
  const parsed = extractPlayerMoveTimes(pgn, isWhite);
  if (!parsed) return null;
  const { baseSec, clocksSec, moveDurationsSec, playerSanMoves } = parsed;
  const isUltraFastBullet = timeClass === "bullet" && baseSec <= 120;
  const scrambleThreshold = timeClass === "bullet" ? 10 : timeClass === "blitz" ? 22 : 35;
  const midMoves = [];
  const startIdx = Math.min(8, Math.floor(moveDurationsSec.length * 0.25));
  const endIdx = Math.min(42, moveDurationsSec.length);
  let lastValidMidIdx = startIdx;
  for (let i = startIdx; i < endIdx; i++) {
    const clockRemaining = clocksSec[i + 1] ?? 0;
    if (clockRemaining < scrambleThreshold) break;
    midMoves.push(moveDurationsSec[i]);
    lastValidMidIdx = i;
  }
  if (midMoves.length < 10) return null;
  const mean = midMoves.reduce((sum, v) => sum + v, 0) / midMoves.length;
  const variance = midMoves.reduce((sum, v) => sum + (v - mean) ** 2, 0) / midMoves.length;
  const std = Math.sqrt(variance);
  const cv = mean > 0 ? std / mean : 1;
  const sortedMid = [...midMoves].sort((a, b) => a - b);
  const q1 = quantileSorted(sortedMid, 0.25);
  const q3 = quantileSorted(sortedMid, 0.75);
  const qcd = q3 + q1 > 0 ? (q3 - q1) / (q3 + q1) : 0;
  const { counts: bucketCounts, entropyBits } = computeLogTimeBuckets(midMoves);
  const fastThreshold = timeClass === "bullet" ? 1 : timeClass === "blitz" ? 1.75 : 2.25;
  const fastCount = midMoves.filter((t) => t <= fastThreshold).length;
  const fastMoveRatio = fastCount / midMoves.length;
  const roboticLo = timeClass === "bullet" ? 1.9 : 2.6;
  const roboticHi = timeClass === "bullet" ? 4.8 : 8.6;
  const roboticCount = midMoves.filter((t) => t >= roboticLo && t <= roboticHi).length;
  const roboticBandRatio = roboticCount / midMoves.length;
  const isFlatline = won && !isUltraFastBullet && (cv <= 0.36 && qcd <= 0.21 || qcd <= 0.17 && entropyBits <= 1.28) && mean >= 2.8 && mean <= 10.5 && fastMoveRatio <= 0.04 && roboticBandRatio >= 0.72;
  let hasMidgameToggle = false;
  let pauseMoveNumber = null;
  let pauseSec = null;
  let suspectStartMove = startIdx + 2;
  let suspectEndMove = lastValidMidIdx + 2;
  let minBandSec = isFlatline ? Number(q1.toFixed(1)) : null;
  let maxBandSec = isFlatline ? Number(q3.toFixed(1)) : null;
  let sampleMoves = isFlatline ? playerSanMoves.slice(startIdx + 1, startIdx + 4).filter((s) => !s.endsWith("?")) : [];
  if (won && !isUltraFastBullet && timeClass !== "bullet" && moveDurationsSec.length >= 20) {
    const pauseMin = timeClass === "blitz" ? 24 : 32;
    const pauseMax = timeClass === "blitz" ? 95 : 130;
    const latestToggleIdx = Math.min(20, moveDurationsSec.length - 11);
    for (let i = 5; i <= latestToggleIdx; i++) {
      if (moveDurationsSec[i] >= pauseMin && moveDurationsSec[i] <= pauseMax) {
        const preSlice = moveDurationsSec.slice(0, i);
        const preHasFast = preSlice.some((t) => t <= 2.1);
        const postEndIdx = Math.min(i + 15, moveDurationsSec.length);
        const postSlice = moveDurationsSec.slice(i + 1, postEndIdx);
        if (preHasFast && postSlice.length >= 10) {
          const pMean = postSlice.reduce((a, b) => a + b, 0) / postSlice.length;
          const pStd = Math.sqrt(
            postSlice.reduce((a, b) => a + (b - pMean) ** 2, 0) / postSlice.length
          );
          const pCv = pMean > 0 ? pStd / pMean : 1;
          const pSorted = [...postSlice].sort((a, b) => a - b);
          const pQ1 = quantileSorted(pSorted, 0.25);
          const pQ3 = quantileSorted(pSorted, 0.75);
          const pQcd = pQ3 + pQ1 > 0 ? (pQ3 - pQ1) / (pQ3 + pQ1) : 1;
          const pFastCount = postSlice.filter((t) => t <= 1.9).length;
          const bandHits = postSlice.filter((t) => t >= 2.5 && t <= 8.5).length / postSlice.length;
          if (pCv <= 0.32 && pQcd <= 0.19 && pFastCount === 0 && bandHits >= 0.85 && pMean >= 2.8) {
            hasMidgameToggle = true;
            pauseMoveNumber = i + 2;
            pauseSec = Number(moveDurationsSec[i].toFixed(1));
            suspectStartMove = i + 3;
            suspectEndMove = i + 2 + postSlice.length;
            minBandSec = Number(pQ1.toFixed(1));
            maxBandSec = Number(pQ3.toFixed(1));
            sampleMoves = playerSanMoves.slice(i + 2, i + 5).filter((s) => !s.endsWith("?"));
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
    qcd: Number(qcd.toFixed(3)),
    entropyBits: Number(entropyBits.toFixed(2)),
    bucketCounts,
    fastMoveRatio: Number(fastMoveRatio.toFixed(3)),
    roboticBandRatio: Number(roboticBandRatio.toFixed(3)),
    isFlatline,
    hasMidgameToggle,
    won,
    pauseMoveNumber,
    pauseSec,
    suspectStartMove,
    suspectEndMove,
    minBandSec,
    maxBandSec,
    sampleMoves
  };
}
function extractSuspectGamePinpoints(games, username, ratedOnly, getAccuracyCeiling) {
  const userLower = username.toLowerCase();
  const sorted = [...games].filter((g) => {
    if (ratedOnly && g.rated === false) return false;
    if (g.time_class === "daily") return false;
    return g.white?.username?.toLowerCase() === userLower || g.black?.username?.toLowerCase() === userLower;
  }).sort((a, b) => (b.end_time || 0) - (a.end_time || 0)).slice(0, 40);
  const candidates = [];
  const byUrlOrEndTime = /* @__PURE__ */ new Map();
  for (const g of sorted) {
    const isWhite = g.white?.username?.toLowerCase() === userLower;
    const player = isWhite ? g.white : g.black;
    const opp = isWhite ? g.black : g.white;
    const won = player?.result === "win";
    const format = String(g.time_class || "blitz");
    const accRaw = g.accuracies ? isWhite ? g.accuracies.white : g.accuracies.black : null;
    const accuracy = typeof accRaw === "number" && accRaw > 0 && accRaw <= 100 ? Number(accRaw.toFixed(1)) : null;
    const m = g.pgn ? analyzeSingleGamePacing(g.pgn, isWhite, format, won) : null;
    const key = g.url || String(g.end_time || "");
    if (m && (m.hasMidgameToggle || m.isFlatline)) {
      const p = {
        kind: m.hasMidgameToggle ? "midgame_toggle" : "robotic_flatline",
        format,
        opponentUsername: opp?.username || "Opponent",
        opponentRating: opp?.rating || 0,
        gameUrl: g.url || null,
        endTime: g.end_time || 0,
        accuracy,
        pauseMoveNumber: m.pauseMoveNumber,
        pauseSec: m.pauseSec,
        suspectStartMove: m.suspectStartMove,
        suspectEndMove: m.suspectEndMove,
        roboticMoveCount: Math.max(1, m.suspectEndMove - m.suspectStartMove + 1),
        minBandSec: m.minBandSec,
        maxBandSec: m.maxBandSec,
        sampleMoves: m.sampleMoves
      };
      candidates.push(p);
      if (key) byUrlOrEndTime.set(key, p);
      continue;
    }
    const ceiling = getAccuracyCeiling(format, player?.rating || 1500);
    if (won && accuracy !== null && accuracy >= Math.max(94, ceiling + 1.5) && g.pgn) {
      const moveNums = g.pgn.match(/\b(\d+)\.\s+\S+/g);
      const totalFullMoves = moveNums ? moveNums.length : 0;
      if (totalFullMoves >= 22) {
        const p = {
          kind: "caps2_spike",
          format,
          opponentUsername: opp?.username || "Opponent",
          opponentRating: opp?.rating || 0,
          gameUrl: g.url || null,
          endTime: g.end_time || 0,
          accuracy,
          pauseMoveNumber: null,
          pauseSec: null,
          suspectStartMove: 1,
          suspectEndMove: totalFullMoves,
          roboticMoveCount: totalFullMoves,
          minBandSec: null,
          maxBandSec: null,
          sampleMoves: []
        };
        candidates.push(p);
        if (key) byUrlOrEndTime.set(key, p);
      }
    }
  }
  const priority = (p) => p.kind === "midgame_toggle" ? 3 : p.kind === "robotic_flatline" ? 2 : 1;
  const pinpoints = candidates.sort((a, b) => priority(b) - priority(a) || b.endTime - a.endTime).slice(0, 4);
  return { pinpoints, byUrlOrEndTime };
}
function computeAggregatePacing(games, username, ratedOnly = true) {
  const userLower = username.toLowerCase();
  const sorted = [...games].filter((g) => {
    if (ratedOnly && g.rated === false) return false;
    if (!g.pgn || g.time_class === "daily") return false;
    return g.white?.username?.toLowerCase() === userLower || g.black?.username?.toLowerCase() === userLower;
  }).sort((a, b) => (b.end_time || 0) - (a.end_time || 0)).slice(0, 40);
  const metrics = [];
  for (const g of sorted) {
    const isWhite = g.white?.username?.toLowerCase() === userLower;
    const playerObj = isWhite ? g.white : g.black;
    const won = playerObj?.result === "win";
    const m = analyzeSingleGamePacing(g.pgn || "", isWhite, String(g.time_class || "blitz"), won);
    if (m) metrics.push(m);
  }
  const totalBuckets = new Array(LOG_TIME_BINS.length + 1).fill(0);
  let totalMoves = 0;
  for (const m of metrics) {
    for (let i = 0; i < totalBuckets.length; i++) {
      const c = m.bucketCounts[i] || 0;
      totalBuckets[i] += c;
      totalMoves += c;
    }
  }
  const bucketDistribution = totalMoves > 0 ? totalBuckets.map((c) => Number((c / totalMoves).toFixed(3))) : new Array(LOG_TIME_BINS.length + 1).fill(0);
  const nonBulletCount = metrics.filter((m) => m.timeClass !== "bullet").length;
  if (metrics.length < 6 || nonBulletCount < 5) {
    const cvs2 = metrics.map((m) => m.cv).sort((a, b) => a - b);
    const qcds2 = metrics.map((m) => m.qcd).sort((a, b) => a - b);
    return {
      gamesAnalyzed: metrics.length,
      medianCV: cvs2.length ? Number(quantileSorted(cvs2, 0.5).toFixed(2)) : null,
      medianQCD: qcds2.length ? Number(quantileSorted(qcds2, 0.5).toFixed(2)) : null,
      meanEntropyBits: metrics.length ? Number((metrics.reduce((s, m) => s + m.entropyBits, 0) / metrics.length).toFixed(2)) : null,
      minCV: cvs2.length ? Number(cvs2[0].toFixed(2)) : null,
      meanFastMoveRatio: null,
      meanRoboticBandRatio: null,
      bucketDistribution,
      flatlineGames: 0,
      flatlineRate: 0,
      toggleGames: 0,
      isConfirmedHumanPacing: metrics.length >= 3 && quantileSorted(cvs2, 0.5) >= 0.72 && quantileSorted(qcds2, 0.5) >= 0.34,
      pacingScore: 0
    };
  }
  const cvs = metrics.map((m) => m.cv).sort((a, b) => a - b);
  const qcds = metrics.map((m) => m.qcd).sort((a, b) => a - b);
  const medianCV = Number(quantileSorted(cvs, 0.5).toFixed(2));
  const medianQCD = Number(quantileSorted(qcds, 0.5).toFixed(2));
  const minCV = Number(cvs[0].toFixed(2));
  const meanEntropyBits = Number(
    (metrics.reduce((s, m) => s + m.entropyBits, 0) / metrics.length).toFixed(2)
  );
  const meanFastMoveRatio = Number(
    (metrics.reduce((s, m) => s + m.fastMoveRatio, 0) / metrics.length).toFixed(3)
  );
  const meanRoboticBandRatio = Number(
    (metrics.reduce((s, m) => s + m.roboticBandRatio, 0) / metrics.length).toFixed(3)
  );
  const flatlineGames = metrics.filter((m) => m.isFlatline).length;
  const flatlineRate = Number((flatlineGames / metrics.length).toFixed(3));
  const toggleGames = metrics.filter((m) => m.hasMidgameToggle).length;
  const isConfirmedHumanPacing = medianCV >= 0.68 && medianQCD >= 0.33 && meanEntropyBits >= 1.7 && flatlineGames <= 1 && toggleGames === 0;
  if (isConfirmedHumanPacing) {
    return {
      gamesAnalyzed: metrics.length,
      medianCV,
      medianQCD,
      meanEntropyBits,
      minCV,
      meanFastMoveRatio,
      meanRoboticBandRatio,
      bucketDistribution,
      flatlineGames,
      flatlineRate,
      toggleGames,
      isConfirmedHumanPacing: true,
      pacingScore: 0
    };
  }
  let dispersionRisk = 0;
  if (medianQCD <= 0.23 && medianCV <= 0.45 && meanFastMoveRatio <= 0.05) {
    const qScore = (0.23 - medianQCD) / 0.12 * 55;
    const cScore = (0.45 - medianCV) / 0.22 * 45;
    dispersionRisk = Math.min(100, qScore + cScore);
  }
  let entropyRisk = 0;
  if (meanEntropyBits <= 1.42 && meanFastMoveRatio <= 0.04 && meanRoboticBandRatio >= 0.68) {
    entropyRisk = Math.min(
      100,
      (1.42 - meanEntropyBits) / 0.45 * 60 + (0.04 - meanFastMoveRatio) / 0.04 * 40
    );
  }
  let flatlineRisk = 0;
  if (flatlineGames >= 3 && flatlineRate >= 0.22) {
    const countBoost = flatlineGames >= 5 ? Math.min(28, (flatlineGames - 3) * 4.5) : 0;
    flatlineRisk = Math.min(100, (flatlineRate - 0.14) / 0.24 * 85 + countBoost);
  }
  const toggleBonus = toggleGames >= 3 && toggleGames / metrics.length >= 0.15 ? 24 : 0;
  const sampleWeight = metrics.length / (metrics.length + 3.2);
  const rawCombined = Math.max(
    flatlineRisk * 0.97,
    dispersionRisk * 0.55 + flatlineRisk * 0.45,
    dispersionRisk * 0.55 + entropyRisk * 0.45
  ) + toggleBonus;
  const pacingScore = Math.min(100, Math.max(0, Math.round(rawCombined * sampleWeight)));
  return {
    gamesAnalyzed: metrics.length,
    medianCV,
    medianQCD,
    meanEntropyBits,
    minCV,
    meanFastMoveRatio,
    meanRoboticBandRatio,
    bucketDistribution,
    flatlineGames,
    flatlineRate,
    toggleGames,
    isConfirmedHumanPacing: false,
    pacingScore
  };
}

// src/core/engine.ts
var ALL_FORMATS = ["rapid", "blitz", "bullet", "daily"];
var CLK_COUNT_REGEX = /\[%clk\s+/g;
function logistic(logit) {
  return 1 / (1 + Math.exp(-logit));
}
function estimateGamePlies(pgn) {
  if (!pgn) return 40;
  const clkMatches = pgn.match(CLK_COUNT_REGEX);
  if (clkMatches && clkMatches.length > 0) return clkMatches.length;
  const moveNums = [...pgn.matchAll(/\b(\d+)\.\s+[a-zA-Z]/g)];
  if (moveNums.length > 0) {
    return Number(moveNums[moveNums.length - 1][1]) * 2;
  }
  return 40;
}
function wilsonLowerBound(successes, total, z = 2.33) {
  if (total <= 0 || successes <= 0) return 0;
  const p = successes / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  return Math.max(0, (center - spread) / denom);
}
function computeEloZScoreSignal(eloZScore, gamesCount, rd) {
  if (gamesCount < 8 || eloZScore <= 2.65) return 0;
  const rdDamper = rd !== null && rd > 110 ? 0.55 : rd !== null && rd > 80 ? 0.8 : 1;
  const adjZ = eloZScore * rdDamper;
  if (adjZ <= 2.65) return 0;
  let raw = 0;
  if (adjZ <= 3.5) {
    raw = (adjZ - 2.65) / 0.85 * 42;
  } else if (adjZ <= 4.5) {
    raw = 42 + (adjZ - 3.5) / 1 * 38;
  } else {
    raw = 80 + Math.min(20, (adjZ - 4.5) * 14);
  }
  const sampleConfidence = gamesCount / (gamesCount + 10);
  return Math.min(100, Math.round(raw * sampleConfidence));
}
function computeLifetimeGlickoSignal(wins, losses, draws) {
  const total = wins + losses + draws;
  if (total < 30) return 0;
  const scoreRatio = (wins + 0.5 * draws) / total;
  if (scoreRatio <= 0.6) return 0;
  const z = (scoreRatio - 0.56) / Math.sqrt(0.2464 / total);
  if (z <= 2.8) return 0;
  let raw = 0;
  if (scoreRatio <= 0.68) {
    raw = (scoreRatio - 0.6) / 0.08 * 45;
  } else if (scoreRatio <= 0.78) {
    raw = 45 + (scoreRatio - 0.68) / 0.1 * 40;
  } else {
    raw = 85 + Math.min(15, (scoreRatio - 0.78) / 0.1 * 15);
  }
  const zCap = Math.min(1, (z - 2.5) / 3);
  const weight = total / (total + 45);
  return Math.min(100, Math.round(raw * zCap * weight));
}
function computeBiasAdjustedAccuracySignal(avgLongAccuracy, expected, highAccRate, reviewedLongGames, totalLongGames, reviewedWinRate, overallRecentWinRate) {
  if (avgLongAccuracy === null || reviewedLongGames < 5) return 0;
  const coverage = totalLongGames > 0 ? reviewedLongGames / totalLongGames : 1;
  const winSkew = Math.max(0, reviewedWinRate - overallRecentWinRate);
  let survivorshipBiasOffset = 0;
  if (coverage < 0.5 && winSkew > 0.15) {
    survivorshipBiasOffset = Math.min(4.6, 2 + winSkew * 5);
  } else if (coverage < 0.3) {
    survivorshipBiasOffset = 2.4;
  }
  const samplingMargin = 2.58 * (5.6 / Math.sqrt(reviewedLongGames)) * 0.62;
  const lowerBoundExcess = avgLongAccuracy - (expected + survivorshipBiasOffset + samplingMargin);
  let excessScore = 0;
  if (lowerBoundExcess > 0.4) {
    if (lowerBoundExcess <= 3.2) {
      excessScore = (lowerBoundExcess - 0.4) / 2.8 * 48;
    } else if (lowerBoundExcess <= 6.2) {
      excessScore = 48 + (lowerBoundExcess - 3.2) / 3 * 38;
    } else {
      excessScore = Math.min(100, 86 + (lowerBoundExcess - 6.2) / 3.5 * 14);
    }
  }
  const rawHighCount = Math.round(highAccRate * reviewedLongGames);
  const wilsonSpikeRate = wilsonLowerBound(rawHighCount, reviewedLongGames, 2.33);
  const biasAdjustedSpikeLcb = survivorshipBiasOffset > 1.5 ? Math.max(0, wilsonSpikeRate - 0.1) : wilsonSpikeRate;
  let spikeScore = 0;
  if (biasAdjustedSpikeLcb > 0.16) {
    if (biasAdjustedSpikeLcb <= 0.34) {
      spikeScore = (biasAdjustedSpikeLcb - 0.16) / 0.18 * 52;
    } else {
      spikeScore = Math.min(100, 52 + (biasAdjustedSpikeLcb - 0.34) / 0.25 * 48);
    }
  }
  return Math.min(100, Math.round(0.68 * excessScore + 0.32 * spikeScore));
}
function computeEloVelocitySignal(eloDelta7d, eloDelta30d, winStreak, rd) {
  const rdDamper = rd !== null && rd > 125 ? 0.35 : rd !== null && rd > 85 ? 0.65 : 1;
  let surge7 = 0;
  if (eloDelta7d !== null && eloDelta7d > 85) {
    surge7 = Math.min(100, (eloDelta7d - 85) / 210 * 92) * rdDamper;
  }
  let surge30 = 0;
  if (eloDelta30d !== null && eloDelta30d > 140) {
    surge30 = Math.min(100, (eloDelta30d - 140) / 290 * 88) * rdDamper;
  }
  let streakScore = 0;
  if (winStreak >= 8) {
    streakScore = Math.min(95, (winStreak - 7) / 11 * 85);
  }
  return Math.min(100, Math.round(Math.max(surge7, surge30 * 0.9) * 0.68 + streakScore * 0.42));
}
function computeAccountTrustSignal(accountAgeDays, bestLiveRating, lifetimeGames, stats) {
  let ageRisk = 0;
  if (accountAgeDays !== null) {
    if (accountAgeDays <= 5) ageRisk = 78;
    else if (accountAgeDays <= 14) ageRisk = 62;
    else if (accountAgeDays <= 30) ageRisk = 45;
    else if (accountAgeDays <= 60) ageRisk = 28;
    else if (accountAgeDays <= 120) ageRisk = 14;
    else ageRisk = 0;
  }
  if (accountAgeDays !== null && accountAgeDays <= 45 && bestLiveRating >= 1800) {
    const ratingExcess = Math.min(28, (bestLiveRating - 1750) / 550 * 28);
    ageRisk = Math.min(100, ageRisk + ratingExcess);
  }
  const tacticsHighest = stats.tactics?.highest?.rating ?? null;
  const tacticsLowest = stats.tactics?.lowest?.rating ?? null;
  const puzzleRushAttempts = stats.puzzle_rush?.best?.total_attempts ?? 0;
  const hasRealPuzzleActivity = tacticsHighest !== null && tacticsHighest > 520 && (puzzleRushAttempts >= 5 || tacticsLowest !== null && tacticsHighest !== tacticsLowest);
  let tacticsGapRating = null;
  if (hasRealPuzzleActivity && bestLiveRating >= 2e3 && tacticsHighest !== null && bestLiveRating - tacticsHighest >= 1e3) {
    tacticsGapRating = tacticsHighest;
    ageRisk = Math.min(100, ageRisk + 22);
  }
  if (accountAgeDays !== null && accountAgeDays >= 730 && lifetimeGames >= 500) {
    ageRisk = 0;
  }
  return {
    trustRiskScore: Math.round(ageRisk),
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
  let reviewedWins = 0;
  let highAccCount = 0;
  let totalLongGames = 0;
  let actualMinusExpectedSum = 0;
  let varianceSum = 0;
  let oppRatingSum = 0;
  let ratedPairCount = 0;
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
    const opponent = isWhite ? g.black : g.white;
    if (!player) continue;
    let numericScore = 0.5;
    if (player.result === "win") {
      recentWins++;
      numericScore = 1;
    } else if (["checkmated", "resigned", "timeout", "abandoned", "lose"].includes(player.result)) {
      recentLosses++;
      numericScore = 0;
    } else {
      recentDraws++;
      numericScore = 0.5;
    }
    if (typeof player.rating === "number" && typeof opponent?.rating === "number") {
      const clampedDiff = Math.max(-600, Math.min(600, opponent.rating - player.rating));
      const expectedScore = 1 / (1 + Math.pow(10, clampedDiff / 400));
      actualMinusExpectedSum += numericScore - expectedScore;
      varianceSum += Math.max(0.11, expectedScore * (1 - expectedScore) * 0.86);
      oppRatingSum += opponent.rating;
      ratedPairCount++;
    }
    const plies = estimateGamePlies(g.pgn);
    const isFullLengthGame = plies >= 44;
    if (isFullLengthGame) {
      totalLongGames++;
      const acc = g.accuracies ? isWhite ? g.accuracies.white : g.accuracies.black : null;
      if (typeof acc === "number" && !Number.isNaN(acc)) {
        reviewedGames++;
        accSum += acc;
        if (numericScore === 1) reviewedWins++;
        if (acc >= band.ceiling) highAccCount++;
      }
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
  const reviewedWinRate = reviewedGames > 0 ? reviewedWins / reviewedGames : 0;
  const eloZScore = ratedPairCount >= 5 ? Number((actualMinusExpectedSum / Math.sqrt(varianceSum + 1.25)).toFixed(2)) : 0;
  let performanceRating = null;
  if (ratedPairCount >= 5) {
    const avgOpp = oppRatingSum / ratedPairCount;
    const scorePct = Math.min(0.96, Math.max(0.04, (recentWins + 0.5 * recentDraws) / recentTotal));
    performanceRating = Math.round(avgOpp - 400 * Math.log10(1 / scorePct - 1));
  }
  const eloDelta7d = oldest7Rating !== null && newest7Rating !== null && newest7Ts > oldest7Ts ? newest7Rating - oldest7Rating : null;
  const eloDelta30d = oldest30Rating !== null && newest30Rating !== null && newest30Ts > oldest30Ts ? newest30Rating - oldest30Rating : null;
  return {
    telemetry: {
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
      eloZScore,
      performanceRating,
      eloDelta7d,
      eloDelta30d,
      formatProbability: 0
    },
    totalLongGames,
    reviewedWinRate
  };
}
function analyzePlayerBundle(bundle, options = {}) {
  const ratedOnly = options.ratedOnly ?? true;
  const sensitivity = options.sensitivity ?? "balanced";
  const nowMs = options.nowMs ?? Date.now();
  const nowSec = Math.floor(nowMs / 1e3);
  const { profile, stats, recentGames } = bundle;
  const usernameLower = (profile.username || bundle.username).toLowerCase();
  const urlMemberMatch = profile.url?.match(/\/member\/([^/?#]+)/i);
  const displayName = urlMemberMatch?.[1] || profile.username || bundle.username;
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
  const { pinpoints: rawPinpoints, byUrlOrEndTime } = extractSuspectGamePinpoints(
    validGames,
    usernameLower,
    ratedOnly,
    (fmtStr, rating) => {
      const validFmt = ["bullet", "blitz", "rapid", "daily"].includes(fmtStr) ? fmtStr : "blitz";
      return getAccuracyBand(validFmt, rating).ceiling;
    }
  );
  const recentMatches = validGames.slice(0, 5).map((g) => {
    const isWhite = g.white?.username?.toLowerCase() === usernameLower;
    const player = isWhite ? g.white : g.black;
    const opp = isWhite ? g.black : g.white;
    const resCode = player?.result === "win" ? "W" : ["checkmated", "resigned", "timeout", "abandoned", "lose"].includes(player?.result || "") ? "L" : "D";
    const rawAcc = g.accuracies ? isWhite ? g.accuracies.white : g.accuracies.black : null;
    const accuracy = typeof rawAcc === "number" && !Number.isNaN(rawAcc) ? Number(rawAcc.toFixed(1)) : null;
    const pinKey = g.url || String(g.end_time || "");
    const pin = pinKey ? byUrlOrEndTime.get(pinKey) : void 0;
    return {
      result: resCode,
      format: String(g.time_class || "blitz"),
      playerRating: player?.rating || 0,
      opponentUsername: opp?.username || "Opponent",
      opponentRating: opp?.rating || 0,
      accuracy,
      plies: estimateGamePlies(g.pgn),
      url: g.url || null,
      endTime: g.end_time || 0,
      pinpointKind: pin ? pin.kind : null,
      pinpointMoveRange: pin ? `#${pin.suspectStartMove}\u2013#${pin.suspectEndMove}` : null
    };
  });
  const pacing = computeAggregatePacing(validGames, usernameLower, ratedOnly);
  const formats = {};
  const extMeta = {};
  let bestLiveRating = 0;
  let lifetimeGames = 0;
  for (const fmt of ALL_FORMATS) {
    const built = buildFormatTelemetry(fmt, stats, validGames, usernameLower, ratedOnly, nowSec);
    formats[fmt] = built.telemetry;
    extMeta[fmt] = {
      totalLongGames: built.totalLongGames,
      reviewedWinRate: built.reviewedWinRate
    };
    lifetimeGames += built.telemetry.overallTotal;
    if (fmt !== "daily" && (built.telemetry.currentRating || 0) > bestLiveRating) {
      bestLiveRating = built.telemetry.currentRating || 0;
    }
  }
  const { trustRiskScore, tacticsGapRating } = computeAccountTrustSignal(
    accountAgeDays,
    bestLiveRating,
    lifetimeGames,
    stats
  );
  const titleDampener = getTitleDampener(profile.title);
  const sensitivityOffsetLogit = sensitivity === "conservative" ? -0.42 : sensitivity === "strict" ? 0.36 : 0;
  const _unusedMult = SENSITIVITY_MULTIPLIERS[sensitivity];
  const formatBreakdowns = {};
  for (const fmt of ALL_FORMATS) {
    const ft = formats[fmt];
    const meta = extMeta[fmt];
    const rwr = computeEloZScoreSignal(ft.eloZScore, ft.recentTotal, ft.rd);
    const owr = computeLifetimeGlickoSignal(ft.overallWins, ft.overallLosses, ft.overallDraws);
    const overallRecentWinRate = ft.recentTotal > 0 ? ft.recentWins / ft.recentTotal : ft.overallWinPct / 100;
    const acc = computeBiasAdjustedAccuracySignal(
      ft.avgAccuracy,
      ft.expectedAccuracy,
      ft.highAccRate,
      ft.reviewedGames,
      meta.totalLongGames,
      meta.reviewedWinRate,
      overallRecentWinRate
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
    const floor = profile.title ? 1 : 2;
    if (ft.overallTotal < 5 && ft.recentTotal < 5) {
      ft.formatProbability = floor;
      continue;
    }
    const independentHistoryRatio = ft.overallTotal > ft.recentTotal ? Math.min(1, (ft.overallTotal - ft.recentTotal) / 80) : 0;
    const perfPillar = Math.min(
      100,
      Math.max(rwr, owr * (0.45 + 0.55 * independentHistoryRatio)) + Math.min(18, vel * 0.22)
    );
    const accPillar = acc;
    const hasResultsOrQuality = perfPillar >= 22 || accPillar >= 25 || ft.recentWinPct >= 56;
    const pacePillar = hasResultsOrQuality ? pace : Math.round(pace * 0.32);
    const trustPillar = trustRiskScore;
    let logit = -4 + sensitivityOffsetLogit;
    logit += perfPillar / 100 * 2.55;
    logit += accPillar / 100 * 3.1;
    logit += pacePillar / 100 * 2.95;
    logit += trustPillar / 100 * 0.75;
    const hasHardQualityEvidence = accPillar >= 46;
    const hasHardClockEvidence = pacePillar >= 55;
    const hasDirectEngineEvidence = hasHardQualityEvidence || hasHardClockEvidence;
    const isMultiPillarCorroborated = hasHardQualityEvidence && hasHardClockEvidence || hasHardQualityEvidence && perfPillar >= 42 || hasHardClockEvidence && perfPillar >= 45;
    if (isMultiPillarCorroborated) {
      logit += 1.35;
    }
    if (hasHardQualityEvidence && hasHardClockEvidence) {
      logit += 1.15;
    }
    if (isMultiPillarCorroborated && trustPillar >= 55) {
      logit += 0.45;
    }
    if (pacing.isConfirmedHumanPacing && !hasHardQualityEvidence) {
      logit -= 1.1;
    }
    if (ft.reviewedGames >= 5 && ft.avgAccuracy !== null && ft.avgAccuracy <= ft.expectedAccuracy + 1.5) {
      logit -= 0.9;
    }
    if (accountAgeDays !== null && accountAgeDays >= 730 && lifetimeGames >= 600 && !hasDirectEngineEvidence) {
      logit -= 0.65;
    }
    let posteriorPct = logistic(logit) * 100 * titleDampener;
    if (perfPillar < 20 && accPillar < 20 && pacePillar < 25) {
      posteriorPct = Math.min(posteriorPct, 12);
    }
    if (!hasDirectEngineEvidence) {
      posteriorPct = Math.min(posteriorPct, 28);
    }
    if (hasDirectEngineEvidence && !isMultiPillarCorroborated) {
      posteriorPct = Math.min(posteriorPct, 46);
    }
    ft.formatProbability = Math.min(99, Math.max(floor, Math.round(posteriorPct)));
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
  if (options.preferredFormat && (formats[options.preferredFormat].recentTotal >= 4 || formats[options.preferredFormat].overallTotal >= 10)) {
    primaryFormat = options.preferredFormat;
  } else {
    const activeFormats = LIVE_FORMATS.filter((f) => formats[f].recentTotal >= 4);
    if (activeFormats.length > 0) {
      primaryFormat = activeFormats.sort(
        (a, b) => formats[b].formatProbability - formats[a].formatProbability
      )[0];
    } else if (maxFormatProb > 0) {
      primaryFormat = maxFormat;
    }
  }
  let probability = formats[primaryFormat].formatProbability;
  if (primaryFormat !== maxFormat && maxFormatProb >= 65 && maxFormatProb > probability + 20) {
    probability = Math.round(probability * 0.4 + maxFormatProb * 0.6);
    primaryFormat = maxFormat;
  }
  if (isBannedFairPlay) {
    probability = 100;
  }
  const signals = formatBreakdowns[primaryFormat];
  const pf = formats[primaryFormat];
  const totalSample = pf.recentTotal + Math.min(35, pf.overallTotal);
  let confidence = "low";
  if (isBannedFairPlay || totalSample >= 25 && (pacing.gamesAnalyzed >= 6 || pf.reviewedGames >= 5)) {
    confidence = "high";
  } else if (totalSample >= 12) {
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
  if (accountAgeDays !== null && accountAgeDays <= 35 && (pf.currentRating || 0) >= 1800) {
    flags.push({
      id: "fresh_high_elo",
      severity: probability >= 55 ? "danger" : "warning",
      icon: "\u{1F195}",
      params: { days: Math.max(1, accountAgeDays), rating: pf.currentRating || 0 }
    });
  } else if (accountAgeDays !== null && accountAgeDays <= 21 && probability >= 30) {
    flags.push({
      id: "fresh_account",
      severity: "warning",
      icon: "\u{1F195}",
      params: { days: Math.max(1, accountAgeDays) }
    });
  }
  if (pf.recentTotal >= 8 && pf.eloZScore >= 3) {
    flags.push({
      id: "extreme_recent_wr",
      severity: "danger",
      icon: "\u{1F6A9}",
      params: { games: pf.recentTotal, wr: pf.recentWinPct, z: pf.eloZScore }
    });
  } else if (pf.recentTotal >= 8 && pf.eloZScore >= 2) {
    flags.push({
      id: "elevated_recent_wr",
      severity: "warning",
      icon: "\u{1F4C8}",
      params: { games: pf.recentTotal, wr: pf.recentWinPct, z: pf.eloZScore }
    });
  }
  if ((signals.recentWinrate >= 18 || pf.eloZScore >= 2.65) && pacing.isConfirmedHumanPacing && signals.accuracyAnomaly < 35 && !isBannedFairPlay) {
    flags.push({
      id: "smurf_human_pacing",
      severity: "info",
      icon: "\u{1F9ED}"
    });
  }
  if (signals.accuracyAnomaly >= 42 && pf.avgAccuracy !== null) {
    const excess = Number((pf.avgAccuracy - pf.expectedAccuracy).toFixed(1));
    flags.push({
      id: "accuracy_excess",
      severity: signals.accuracyAnomaly >= 70 ? "danger" : "warning",
      icon: "\u{1F3AF}",
      params: { excess: Math.max(1.5, excess), avg: pf.avgAccuracy }
    });
  }
  if (signals.accuracyAnomaly >= 45 && pf.reviewedGames >= 4 && pf.highAccRate >= 0.3) {
    flags.push({
      id: "accuracy_spikes",
      severity: pf.highAccRate >= 0.45 ? "danger" : "warning",
      icon: "\u26A1",
      params: {
        games: pf.reviewedGames,
        rate: Math.round(pf.highAccRate * 100),
        ceil: pf.highAccCeiling
      }
    });
  }
  if (pacing.gamesAnalyzed >= 5 && signals.movePacing >= 50 && pacing.medianCV !== null && pacing.medianQCD !== null && pacing.meanEntropyBits !== null) {
    flags.push({
      id: "robotic_pacing",
      severity: signals.movePacing >= 72 ? "danger" : "warning",
      icon: "\u23F1\uFE0F",
      params: {
        cv: pacing.medianCV,
        qcd: pacing.medianQCD,
        ent: pacing.meanEntropyBits
      }
    });
  }
  if (pacing.toggleGames >= 2 && signals.movePacing >= 45) {
    flags.push({
      id: "midgame_toggle",
      severity: pacing.toggleGames >= 3 ? "danger" : "warning",
      icon: "\u{1F916}",
      params: { count: pacing.toggleGames }
    });
  }
  if (pf.eloDelta7d !== null && pf.eloDelta7d >= 115 && (pf.rd ?? 50) <= 95) {
    flags.push({
      id: "elo_surge",
      severity: pf.eloDelta7d >= 185 ? "danger" : "warning",
      icon: "\u{1F680}",
      params: { delta: pf.eloDelta7d }
    });
  }
  if (winStreak >= 8) {
    flags.push({
      id: "hot_streak",
      severity: winStreak >= 12 ? "danger" : "warning",
      icon: "\u{1F525}",
      params: { streak: winStreak }
    });
  }
  if (tacticsGapRating !== null) {
    flags.push({
      id: "tactics_gap",
      severity: "warning",
      icon: "\u{1F9E9}",
      params: { rating: pf.currentRating || bestLiveRating, tactics: tacticsGapRating }
    });
  }
  if (!isBannedFairPlay && probability < 25) {
    if (pacing.medianCV !== null && pacing.medianCV >= 0.75) {
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
  const shouldExposePinpoints = isBannedFairPlay || probability >= 45 || signals.movePacing >= 45 || signals.accuracyAnomaly >= 45;
  const suspectPinpoints = shouldExposePinpoints ? rawPinpoints : [];
  const finalRecentMatches = shouldExposePinpoints ? recentMatches : recentMatches.map((m) => ({ ...m, pinpointKind: null, pinpointMoveRange: null }));
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
    recentMatches: finalRecentMatches,
    suspectPinpoints,
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
