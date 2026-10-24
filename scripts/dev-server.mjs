import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 4173);
const DEMO_DIR = path.join(process.cwd(), 'demo');

const apiCache = new Map();

async function fetchJson(url) {
  if (apiCache.has(url)) return apiCache.get(url);
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ChessSentinelDemo/1.0',
    },
  });
  if (res.status === 404) throw new Error('PLAYER_NOT_FOUND');
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const data = await res.json();
  if (typeof data.code === 'number' && data.code === 0 && data.message) {
    throw new Error('CHESSCOM_ARCHIVE_ERROR');
  }
  apiCache.set(url, data);
  return data;
}

async function buildBundle(username, mode) {
  const clean = username.trim().toLowerCase();
  const profile = structuredClone(
    await fetchJson(`https://api.chess.com/pub/player/${encodeURIComponent(clean)}`)
  );
  const stats = await fetchJson(
    `https://api.chess.com/pub/player/${encodeURIComponent(clean)}/stats`
  ).catch(() => ({}));
  const archData = await fetchJson(
    `https://api.chess.com/pub/player/${encodeURIComponent(clean)}/games/archives`
  ).catch(() => ({ archives: [] }));

  const archives = (archData.archives || []).slice(-3).reverse();
  const recentGames = [];
  for (const a of archives) {
    try {
      const m = await fetchJson(a.replace(/^http:/i, 'https:'));
      if (Array.isArray(m.games)) recentGames.push(...m.games);
      if (recentGames.length >= 35) break;
    } catch {
      continue;
    }
  }

  let fakeNowMs = undefined;
  if (mode === 'preban_cheater' && clean === 'sumitgm000') {
    profile.status = 'basic';
    fakeNowMs = 1735050794000;
  }

  return {
    bundle: {
      username: clean,
      profile,
      stats,
      recentGames: recentGames.slice(-120),
      fetchedAt: Date.now(),
    },
    fakeNowMs,
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (reqUrl.pathname === '/api/player-bundle') {
      const username = reqUrl.searchParams.get('username') || 'hikaru';
      const mode = reqUrl.searchParams.get('mode') || 'normal';
      try {
        const { bundle, fakeNowMs } = await buildBundle(username, mode);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, bundle, fakeNowMs }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Error' }));
      }
      return;
    }

    const relPath = reqUrl.pathname === '/' ? 'index.html' : reqUrl.pathname.replace(/^\/+/, '');
    const safePath = path.normalize(path.join(DEMO_DIR, relPath));
    if (!safePath.startsWith(DEMO_DIR) || !fs.existsSync(safePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(safePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(safePath).pipe(res);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal server error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Chess Sentinel Live HUD Preview running on http://0.0.0.0:${PORT}`);
});
