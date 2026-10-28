import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const ICONS_DIR = path.join(ROOT, 'public', 'icons');
const ASSETS_DIR = path.join(ROOT, 'assets');

fs.mkdirSync(ICONS_DIR, { recursive: true });
fs.mkdirSync(ASSETS_DIR, { recursive: true });

// Pure JS CRC32 table for valid PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // Filter None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Signed distance / supersampled vector rasterizer for Sentinel Shield Icon
function pointInShield(nx, ny) {
  // Normalized coords in [-1, 1]
  // Shield top at y = -0.78, shoulders at y = -0.50, bottom tip at y = 0.82
  if (ny < -0.78 || ny > 0.82) return false;
  let halfW;
  if (ny < -0.48) {
    // Sloped top crest
    const t = (ny - -0.78) / 0.3;
    halfW = 0.12 + t * 0.58;
  } else if (ny < 0.05) {
    halfW = 0.70 - (ny - -0.48) * 0.06;
  } else {
    const t = (ny - 0.05) / 0.77;
    halfW = 0.67 * (1 - t * t * 0.98);
  }
  return Math.abs(nx) <= halfW;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const b = c1 / c2;
  return Math.hypot(px - (ax + b * vx), py - (ay + b * vy));
}

function renderShieldIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 4; // 4x4 MSAA supersampling

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        aSum = 0;

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const ux = ((x + (sx + 0.5) / samples) / size) * 2 - 1;
          const uy = ((y + (sy + 0.5) / samples) / size) * 2 - 1;

          // Rounded squircle dark card background
          const cornerR = 0.42;
          const qx = Math.max(0, Math.abs(ux) - (0.94 - cornerR));
          const qy = Math.max(0, Math.abs(uy) - (0.94 - cornerR));
          const inCard = Math.hypot(qx, qy) <= cornerR;

          if (!inCard) continue;

          // Native Chess.com warm dark matte card (#21201d)
          let r = 33;
          let g = 32;
          let b = 29;

          const inOuter = pointInShield(ux, uy);
          const inInner = pointInShield(ux * 1.15, uy * 1.15);

          if (inOuter && !inInner) {
            // Crisp Chess.com olive green rim (#81b64c)
            r = 129;
            g = 182;
            b = 76;
          } else if (inInner) {
            // Subtle dark olive-charcoal core
            r = 25;
            g = 28;
            b = 22;
          }

          // Clean check mark inside shield
          const d1 = distToSegment(ux, uy, -0.26, 0.02, -0.05, 0.24);
          const d2 = distToSegment(ux, uy, -0.05, 0.24, 0.30, -0.18);
          const strokeD = Math.min(d1, d2);
          if (strokeD <= 0.105) {
            r = 149;
            g = 201;
            b = 95;
          }

          rSum += Math.min(255, r);
          gSum += Math.min(255, g);
          bSum += Math.min(255, b);
          aSum += 255;
        }
      }

      const totalSamples = samples * samples;
      const idx = (y * size + x) * 4;
      const alpha = Math.round(aSum / totalSamples);
      if (alpha > 0) {
        const cov = aSum / 255;
        rgba[idx] = Math.round(rSum / cov);
        rgba[idx + 1] = Math.round(gSum / cov);
        rgba[idx + 2] = Math.round(bSum / cov);
        rgba[idx + 3] = alpha;
      }
    }
  }

  return encodePng(size, size, rgba);
}

for (const size of [16, 32, 48, 128]) {
  const buf = renderShieldIcon(size);
  fs.writeFileSync(path.join(ICONS_DIR, `icon${size}.png`), buf);
}

// Generate flagship GitHub Hero Banner SVG (`assets/banner.svg`)
const bannerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 420" width="1200" height="420">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060911"/>
      <stop offset="50%" stop-color="#0b1221"/>
      <stop offset="100%" stop-color="#081b26"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <linearGradient id="danger" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
    <radialGradient id="glow1" cx="78%" cy="48%" r="42%">
      <stop offset="0%" stop-color="#ef4444" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="20%" cy="30%" r="45%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="420" rx="24" fill="url(#bg)"/>
  <rect width="1200" height="420" rx="24" fill="url(#glow1)"/>
  <rect width="1200" height="420" rx="24" fill="url(#glow2)"/>
  <rect x="1" y="1" width="1198" height="418" rx="23" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="2"/>

  <!-- Subtle Tactical Grid -->
  <g stroke="rgba(255,255,255,0.03)" stroke-width="1">
    <line x1="0" y1="84" x2="1200" y2="84"/>
    <line x1="0" y1="168" x2="1200" y2="168"/>
    <line x1="0" y1="252" x2="1200" y2="252"/>
    <line x1="0" y1="336" x2="1200" y2="336"/>
    <line x1="240" y1="0" x2="240" y2="420"/>
    <line x1="480" y1="0" x2="480" y2="420"/>
    <line x1="720" y1="0" x2="720" y2="420"/>
    <line x1="960" y1="0" x2="960" y2="420"/>
  </g>

  <!-- Left Hero Copy -->
  <g transform="translate(64, 72)">
    <rect x="0" y="0" width="248" height="30" rx="15" fill="rgba(16,185,129,0.14)" stroke="rgba(16,185,129,0.4)"/>
    <circle cx="18" cy="15" r="4.5" fill="#10b981"/>
    <text x="31" y="19.5" fill="#6ee7b7" font-family="Inter, system-ui, sans-serif" font-size="11.5" font-weight="800" letter-spacing="1.2">MANIFEST V3 • CHESS.COM 2026</text>

    <text x="0" y="88" fill="#f8fafc" font-family="Inter, system-ui, sans-serif" font-size="52" font-weight="900" letter-spacing="-1.2">Chess Sentinel</text>
    <text x="0" y="132" fill="#94a3b8" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="500">Real-Time Opponent Cheat Probability (%) &amp; Forensic HUD</text>
    <text x="0" y="162" fill="#64748b" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="500">PGN [%clk] Metronome Detection • CAPS2 Elo Calibration • Suspect Ban Watchlist</text>

    <!-- Feature Pills -->
    <g transform="translate(0, 202)" font-family="Inter, system-ui, sans-serif" font-size="12.5" font-weight="700">
      <rect x="0" y="0" width="166" height="36" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)"/>
      <text x="16" y="22.5" fill="#e2e8f0">⏱️ PGN Clock Pacing</text>

      <rect x="178" y="0" width="166" height="36" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)"/>
      <text x="194" y="22.5" fill="#e2e8f0">🎯 CAPS2 Telemetry</text>

      <rect x="356" y="0" width="168" height="36" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)"/>
      <text x="372" y="22.5" fill="#e2e8f0">🇹🇷 / 🇬🇧 Bilingual UI</text>
    </g>
  </g>

  <!-- Right Floating HUD Mockup Card -->
  <g transform="translate(748, 36)">
    <rect x="0" y="0" width="388" height="348" rx="20" fill="#0c111d" stroke="rgba(239,68,68,0.52)" stroke-width="1.5"/>
    <rect x="0" y="0" width="388" height="4" rx="2" fill="url(#danger)"/>

    <!-- Card Header -->
    <text x="20" y="28" fill="#f1f5f9" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="800" letter-spacing="1.4">🛡️ CHESS SENTINEL</text>
    <rect x="306" y="13" width="32" height="20" rx="5" fill="rgba(255,255,255,0.07)"/>
    <text x="314" y="26.5" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="700">TR</text>
    <rect x="344" y="13" width="24" height="20" rx="5" fill="rgba(255,255,255,0.07)"/>
    <text x="351" y="26.5" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="700">⇅</text>
    <line x1="0" y1="42" x2="388" y2="42" stroke="rgba(255,255,255,0.07)"/>

    <!-- Abort Warning -->
    <rect x="18" y="54" width="352" height="28" rx="7" fill="rgba(239,68,68,0.16)" stroke="rgba(239,68,68,0.4)"/>
    <text x="30" y="72" fill="#fca5a5" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="700">⚠️ Safe Abort Window Open — High Engine Probability</text>

    <!-- Gauge -->
    <g transform="translate(64, 138)">
      <circle cx="0" cy="0" r="38" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"/>
      <circle cx="0" cy="0" r="38" fill="none" stroke="#ef4444" stroke-width="8" stroke-linecap="round" stroke-dasharray="238.76" stroke-dashoffset="26.2" transform="rotate(-90)"/>
      <text x="0" y="5" text-anchor="middle" fill="#f8fafc" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="900">89%</text>
      <text x="0" y="19" text-anchor="middle" fill="#94a3b8" font-family="Inter, system-ui, sans-serif" font-size="7.5" font-weight="800" letter-spacing="0.8">CHEAT PROB</text>
    </g>

    <!-- Identity -->
    <g transform="translate(122, 108)">
      <text x="0" y="16" fill="#f8fafc" font-family="Inter, system-ui, sans-serif" font-size="17" font-weight="800">@SuspectGM_09</text>
      <rect x="0" y="26" width="136" height="21" rx="10.5" fill="rgba(239,68,68,0.18)" stroke="rgba(239,68,68,0.45)"/>
      <text x="11" y="40" fill="#f87171" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="800" letter-spacing="0.7">CRITICAL CHEAT RISK</text>
      <text x="0" y="64" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="11.5">Rapid 2190 (+194 7d) • 11d old</text>
    </g>

    <!-- Forensic Bars -->
    <g transform="translate(20, 198)" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="600">
      <text x="0" y="12" fill="#cbd5e1">Recent Win-Rate Anomaly (78% / 46g)</text>
      <text x="348" y="12" text-anchor="end" fill="#f8fafc" font-weight="800">88/100</text>
      <rect x="0" y="18" width="348" height="6" rx="3" fill="rgba(255,255,255,0.08)"/>
      <rect x="0" y="18" width="306" height="6" rx="3" fill="#ef4444"/>

      <text x="0" y="44" fill="#cbd5e1">Engine Move Pacing (%clk CV: 0.24)</text>
      <text x="348" y="44" text-anchor="end" fill="#f8fafc" font-weight="800">95/100</text>
      <rect x="0" y="50" width="348" height="6" rx="3" fill="rgba(255,255,255,0.08)"/>
      <rect x="0" y="50" width="330" height="6" rx="3" fill="#ef4444"/>

      <text x="0" y="76" fill="#cbd5e1">CAPS2 Accuracy Excess (93.8% vs 84.5%)</text>
      <text x="348" y="76" text-anchor="end" fill="#f8fafc" font-weight="800">91/100</text>
      <rect x="0" y="82" width="348" height="6" rx="3" fill="rgba(255,255,255,0.08)"/>
      <rect x="0" y="82" width="316" height="6" rx="3" fill="#ef4444"/>

      <text x="0" y="108" fill="#cbd5e1">Account Age &amp; Smurf Factor (11 days)</text>
      <text x="348" y="108" text-anchor="end" fill="#f8fafc" font-weight="800">84/100</text>
      <rect x="0" y="114" width="348" height="6" rx="3" fill="rgba(255,255,255,0.08)"/>
      <rect x="0" y="114" width="292" height="6" rx="3" fill="#f97316"/>
    </g>
  </g>
</svg>`;

fs.writeFileSync(path.join(ASSETS_DIR, 'banner.svg'), bannerSvg, 'utf8');

// Generate Architecture Telemetry Pipeline Diagram (`assets/architecture.svg`)
const archSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 260" width="1080" height="260">
  <rect width="1080" height="260" rx="18" fill="#090d16" stroke="rgba(255,255,255,0.09)"/>
  <g font-family="Inter, system-ui, sans-serif">
    <!-- Node 1 -->
    <rect x="28" y="44" width="225" height="172" rx="14" fill="#0f172a" stroke="rgba(56,189,248,0.35)"/>
    <text x="46" y="76" fill="#38bdf8" font-size="11" font-weight="800" letter-spacing="1">1. DOM &amp; SPA DETECTOR</text>
    <text x="46" y="102" fill="#e2e8f0" font-size="13" font-weight="700">Chess.com 2026 Watcher</text>
    <text x="46" y="128" fill="#94a3b8" font-size="11.5">• Web Component ShadowRoot</text>
    <text x="46" y="148" fill="#94a3b8" font-size="11.5">• /game/* &amp; /play/online SPA</text>
    <text x="46" y="168" fill="#94a3b8" font-size="11.5">• Active Clock Speed &amp; Abort</text>
    <text x="46" y="188" fill="#94a3b8" font-size="11.5">• Zero Board Interference</text>

    <path d="M258 130 L292 130" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4 3"/>

    <!-- Node 2 -->
    <rect x="298" y="44" width="235" height="172" rx="14" fill="#0f172a" stroke="rgba(16,185,129,0.35)"/>
    <text x="316" y="76" fill="#10b981" font-size="11" font-weight="800" letter-spacing="1">2. SERIAL PUBAPI CLIENT</text>
    <text x="316" y="102" fill="#e2e8f0" font-size="13" font-weight="700">Resilient Data Harvester</text>
    <text x="316" y="128" fill="#94a3b8" font-size="11.5">• /pub/player &amp; /stats</text>
    <text x="316" y="148" fill="#94a3b8" font-size="11.5">• Monthly PGN [%clk] Archives</text>
    <text x="316" y="168" fill="#94a3b8" font-size="11.5">• Auto-Fallback on HTTP 500</text>
    <text x="316" y="188" fill="#94a3b8" font-size="11.5">• 5-Min Smart LRU Cache</text>

    <path d="M538 130 L572 130" stroke="#10b981" stroke-width="2" stroke-dasharray="4 3"/>

    <!-- Node 3 -->
    <rect x="578" y="44" width="245" height="172" rx="14" fill="#0f172a" stroke="rgba(245,158,11,0.4)"/>
    <text x="596" y="76" fill="#f59e0b" font-size="11" font-weight="800" letter-spacing="1">3. BAYESIAN ENGINE</text>
    <text x="596" y="102" fill="#e2e8f0" font-size="13" font-weight="700">6-Signal Forensic Model</text>
    <text x="596" y="128" fill="#94a3b8" font-size="11.5">• Recent &amp; Lifetime Glicko WR</text>
    <text x="596" y="148" fill="#94a3b8" font-size="11.5">• CAPS2 vs Elo Band Excess</text>
    <text x="596" y="168" fill="#94a3b8" font-size="11.5">• PGN [%clk] Metronome &amp; Toggle</text>
    <text x="596" y="188" fill="#94a3b8" font-size="11.5">• FIDE Title &amp; FairPlay Check</text>

    <path d="M828 130 L862 130" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 3"/>

    <!-- Node 4 -->
    <rect x="868" y="44" width="184" height="172" rx="14" fill="#0f172a" stroke="rgba(239,68,68,0.4)"/>
    <text x="886" y="76" fill="#f87171" font-size="11" font-weight="800" letter-spacing="1">4. SHADOW HUD</text>
    <text x="886" y="102" fill="#e2e8f0" font-size="13" font-weight="700">Live Overlay + Badge</text>
    <text x="886" y="128" fill="#94a3b8" font-size="11.5">• Floating Glass HUD</text>
    <text x="886" y="148" fill="#94a3b8" font-size="11.5">• Inline % Name Pill</text>
    <text x="886" y="168" fill="#94a3b8" font-size="11.5">• Ban Watchlist Alarm</text>
    <text x="886" y="188" fill="#94a3b8" font-size="11.5">• Instant TR / EN UI</text>
  </g>
</svg>`;

fs.writeFileSync(path.join(ASSETS_DIR, 'architecture.svg'), archSvg, 'utf8');
console.log('Generated extension icons (16, 32, 48, 128) and GitHub SVG assets.');
