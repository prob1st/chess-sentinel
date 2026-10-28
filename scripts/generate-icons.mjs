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
  if (ny < -0.78 || ny > 0.82) return false;
  let halfW;
  if (ny < -0.48) {
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

          // Rounded squircle obsidian card
          const cornerR = 0.42;
          const qx = Math.max(0, Math.abs(ux) - (0.94 - cornerR));
          const qy = Math.max(0, Math.abs(uy) - (0.94 - cornerR));
          const distEdge = Math.hypot(qx, qy) - cornerR;
          if (distEdge > 0) continue;

          // Subtle top-to-bottom obsidian gradient (#1c1d24 -> #101116)
          const tGrad = (uy + 1) * 0.5;
          let r = 28 * (1 - tGrad) + 16 * tGrad;
          let g = 29 * (1 - tGrad) + 17 * tGrad;
          let b = 36 * (1 - tGrad) + 22 * tGrad;

          // Subtle ambient emerald top-right glow
          const glowD = Math.hypot(ux - 0.35, uy + 0.45);
          const glow = Math.max(0, 1 - glowD / 1.15) * 0.16;
          r += 52 * glow;
          g += 211 * glow;
          b += 153 * glow;

          // Smoothly fading specular hairline rim (top-lit, zero hard step)
          if (distEdge > -0.05) {
            const rimFade = Math.max(0, Math.min(1, (0.35 - uy) / 1.15));
            r += 28 * rimFade;
            g += 30 * rimFade;
            b += 36 * rimFade;
          }

          const inOuter = pointInShield(ux, uy);
          const inInner = pointInShield(ux * 1.16, uy * 1.16);

          if (inOuter && !inInner) {
            // Precision emerald rim (#34d399)
            r = 52;
            g = 211;
            b = 153;
          } else if (inInner) {
            // Deep emerald-tinted obsidian core
            r = 16;
            g = 27;
            b = 25;
          }

          // Clean check mark inside shield
          const d1 = distToSegment(ux, uy, -0.26, 0.02, -0.05, 0.24);
          const d2 = distToSegment(ux, uy, -0.05, 0.24, 0.30, -0.18);
          const strokeD = Math.min(d1, d2);
          if (strokeD <= 0.105) {
            r = 110;
            g = 231;
            b = 183;
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

// Generate flagship GitHub Hero Banner SVG (`assets/banner.svg`) - Zero Emoji, High-Craft Obsidian
const bannerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 420" width="1200" height="420">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14151a"/>
      <stop offset="55%" stop-color="#101116"/>
      <stop offset="100%" stop-color="#0b0c10"/>
    </linearGradient>
    <radialGradient id="glowRose" cx="82%" cy="32%" r="38%">
      <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#f43f5e" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowEmerald" cx="16%" cy="24%" r="42%">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.11"/>
      <stop offset="100%" stop-color="#34d399" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="areaChrono" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#f43f5e" stop-opacity="0.0"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="420" rx="22" fill="url(#bg)"/>
  <rect width="1200" height="420" rx="22" fill="url(#glowRose)"/>
  <rect width="1200" height="420" rx="22" fill="url(#glowEmerald)"/>
  <rect x="1" y="1" width="1198" height="418" rx="21" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>

  <!-- Left Copy -->
  <g transform="translate(64, 72)">
    <rect x="0" y="0" width="256" height="28" rx="8" fill="rgba(52,211,153,0.1)" stroke="rgba(52,211,153,0.28)"/>
    <circle cx="15" cy="14" r="3.5" fill="#34d399"/>
    <text x="27" y="18" fill="#6ee7b7" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing="0.4">Chess Sentinel v4.1 · Zero-FP Calibrated</text>

    <text x="0" y="86" fill="#fafafa" font-family="Inter, system-ui, sans-serif" font-size="52" font-weight="750" letter-spacing="-1.6">Chess Sentinel</text>
    <text x="0" y="128" fill="#a1a1aa" font-family="Inter, system-ui, sans-serif" font-size="19" font-weight="500">Live Fair-Play Telemetry &amp; Move-Range Pinpointer for Chess.com</text>
    <text x="0" y="158" fill="#71717a" font-family="Inter, system-ui, sans-serif" font-size="14.5" font-weight="500">0.1s Server Clock Hydration · CAPS2 Elo Excess · Suspect Ban Watchlist</text>

    <g transform="translate(0, 198)" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600">
      <rect x="0" y="0" width="174" height="34" rx="8" fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.09)"/>
      <text x="16" y="21.5" fill="#e4e4e7">0 / 10,000 Honest FPs</text>

      <rect x="186" y="0" width="184" height="34" rx="8" fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.09)"/>
      <text x="202" y="21.5" fill="#e4e4e7">0.1s Live Clock Pacing</text>

      <rect x="382" y="0" width="152" height="34" rx="8" fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.09)"/>
      <text x="398" y="21.5" fill="#e4e4e7">TR / EN Instant UI</text>
    </g>
  </g>

  <!-- Right Floating v4.1 Obsidian HUD Card -->
  <g transform="translate(756, 36)">
    <rect x="0" y="0" width="380" height="348" rx="14" fill="#131419" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <line x1="14" y1="1" x2="366" y2="1" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>

    <!-- Header -->
    <rect x="14" y="12" width="22" height="22" rx="6" fill="rgba(244,63,94,0.14)" stroke="rgba(244,63,94,0.32)"/>
    <path d="M25 16.5L30.5 19v4.2c0 3.3-2.3 6.2-5.5 7.2-3.2-1-5.5-3.9-5.5-7.2V19L25 16.5z" fill="none" stroke="#f43f5e" stroke-width="1.4"/>
    <text x="44" y="27" fill="#f4f4f5" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="650">Chess Sentinel</text>
    <rect x="306" y="12" width="28" height="22" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.09)"/>
    <text x="313" y="26.5" fill="#d4d4d8" font-family="ui-monospace, SFMono-Regular, monospace" font-size="10" font-weight="600">TR</text>
    <rect x="339" y="12" width="26" height="22" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.09)"/>
    <text x="348" y="26.5" fill="#d4d4d8" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600">-</text>
    <line x1="0" y1="45" x2="380" y2="45" stroke="rgba(255,255,255,0.06)"/>

    <!-- Identity + 240 deg Instrument Arc -->
    <g transform="translate(16, 62)">
      <rect x="0" y="4" width="42" height="42" rx="10" fill="#1e2028" stroke="rgba(255,255,255,0.12)"/>
      <text x="21" y="30" text-anchor="middle" fill="#e4e4e7" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="700">G</text>

      <text x="54" y="19" fill="#fafafa" font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="650">@gamer-rahUL</text>
      <rect x="54" y="26" width="96" height="19" rx="9.5" fill="rgba(244,63,94,0.14)" stroke="rgba(244,63,94,0.34)"/>
      <circle cx="64" cy="35.5" r="2.8" fill="#f43f5e"/>
      <text x="72" y="39" fill="#fda4af" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="600">Critical Risk</text>
      <text x="54" y="60" fill="#a1a1aa" font-family="Inter, system-ui, sans-serif" font-size="11">BLITZ 1642 (+184 7d) · 14d</text>

      <!-- 240 deg Open Arc -->
      <g transform="translate(274, -2)">
        <circle cx="38" cy="38" r="29" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="121.47 200" transform="rotate(150 38 38)"/>
        <circle cx="38" cy="38" r="29" fill="none" stroke="#f43f5e" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="106.9 200" transform="rotate(150 38 38)"/>
        <text x="38" y="42" text-anchor="middle" fill="#fafafa" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="750">88%</text>
        <text x="38" y="56" text-anchor="middle" fill="#a1a1aa" font-family="Inter, system-ui, sans-serif" font-size="8.5" font-weight="500">Confidence 92%</text>
      </g>
    </g>

    <!-- Smooth SVG Chronogram Card -->
    <g transform="translate(16, 140)">
      <rect x="0" y="0" width="348" height="92" rx="10" fill="rgba(255,255,255,0.026)" stroke="rgba(255,255,255,0.07)"/>
      <text x="12" y="20" fill="#d4d4d8" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="600">Live Game Clock (18 moves)</text>
      <text x="336" y="20" text-anchor="end" fill="#fda4af" font-family="ui-monospace, SFMono-Regular, monospace" font-size="10" font-weight="600">CV 0.21 · Mean 4.8s</text>

      <rect x="128" y="30" width="196" height="44" rx="4" fill="rgba(244,63,94,0.09)"/>
      <path d="M 14 42 C 36 38, 62 66, 94 58 C 118 52, 134 55, 160 55 C 194 55, 240 54, 286 55 C 308 55, 322 54, 334 55 L 334 74 L 14 74 Z" fill="url(#areaChrono)"/>
      <path d="M 14 42 C 36 38, 62 66, 94 58 C 118 52, 134 55, 160 55 C 194 55, 240 54, 286 55 C 308 55, 322 54, 334 55" fill="none" stroke="#f43f5e" stroke-width="1.8"/>
      <text x="14" y="85" fill="#71717a" font-family="ui-monospace, SFMono-Regular, monospace" font-size="9">M1</text>
      <text x="334" y="85" text-anchor="end" fill="#fda4af" font-family="ui-monospace, SFMono-Regular, monospace" font-size="9">Window M8-M18</text>
    </g>

    <!-- Pinpoint Card -->
    <g transform="translate(16, 244)">
      <rect x="0" y="0" width="348" height="86" rx="10" fill="rgba(255,255,255,0.026)" stroke="rgba(255,255,255,0.07)"/>
      <text x="12" y="20" fill="#d4d4d8" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="600">Suspect Move Ranges</text>
      <rect x="292" y="8" width="44" height="17" rx="8.5" fill="rgba(244,63,94,0.16)"/>
      <text x="314" y="19.5" text-anchor="middle" fill="#fda4af" font-family="ui-monospace, SFMono-Regular, monospace" font-size="9.5" font-weight="700">3 / 6</text>

      <text x="12" y="44" fill="#fafafa" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600">vs @Prob1st · Blitz · 96.4% acc</text>
      <rect x="228" y="32" width="108" height="18" rx="5" fill="rgba(244,63,94,0.14)" stroke="rgba(244,63,94,0.32)"/>
      <text x="282" y="44" text-anchor="middle" fill="#fda4af" font-family="ui-monospace, SFMono-Regular, monospace" font-size="9.5" font-weight="600">Moves 9-24</text>

      <text x="12" y="67" fill="#a1a1aa" font-family="Inter, system-ui, sans-serif" font-size="10.5">Metronomic move pacing (4.7s avg, CV 0.19)</text>
    </g>
  </g>
</svg>`;

fs.writeFileSync(path.join(ASSETS_DIR, 'banner.svg'), bannerSvg, 'utf8');

// Generate Architecture Telemetry Pipeline Diagram (`assets/architecture.svg`)
const archSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 250" width="1080" height="250">
  <rect width="1080" height="250" rx="16" fill="#121318" stroke="rgba(255,255,255,0.08)"/>
  <g font-family="Inter, system-ui, sans-serif">
    <rect x="28" y="38" width="225" height="174" rx="12" fill="rgba(255,255,255,0.025)" stroke="rgba(96,165,250,0.3)"/>
    <text x="46" y="68" fill="#60a5fa" font-size="11" font-weight="700">1. DOM &amp; CALLBACK MONITOR</text>
    <text x="46" y="94" fill="#f4f4f5" font-size="13" font-weight="650">Chess.com Watcher</text>
    <text x="46" y="120" fill="#a1a1aa" font-size="11.5">· /game/*, /play/*, /member/*</text>
    <text x="46" y="142" fill="#a1a1aa" font-size="11.5">· 0.1s Server moveTimestamps</text>
    <text x="46" y="164" fill="#a1a1aa" font-size="11.5">· Safe Abort Window Detector</text>
    <text x="46" y="186" fill="#a1a1aa" font-size="11.5">· Zero Board Interference</text>

    <path d="M258 125 L292 125" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="4 3"/>

    <rect x="298" y="38" width="235" height="174" rx="12" fill="rgba(255,255,255,0.025)" stroke="rgba(52,211,153,0.3)"/>
    <text x="316" y="68" fill="#34d399" font-size="11" font-weight="700">2. SERIAL PUBAPI CLIENT</text>
    <text x="316" y="94" fill="#f4f4f5" font-size="13" font-weight="650">Resilient Data Harvester</text>
    <text x="316" y="120" fill="#a1a1aa" font-size="11.5">· /pub/player &amp; /stats</text>
    <text x="316" y="142" fill="#a1a1aa" font-size="11.5">· Monthly PGN [%clk] Archives</text>
    <text x="316" y="164" fill="#a1a1aa" font-size="11.5">· Persistent storage.local Cache</text>
    <text x="316" y="186" fill="#a1a1aa" font-size="11.5">· Retry &amp; Rate-Limit Guard</text>

    <path d="M538 125 L572 125" stroke="#34d399" stroke-width="1.5" stroke-dasharray="4 3"/>

    <rect x="578" y="38" width="245" height="174" rx="12" fill="rgba(255,255,255,0.025)" stroke="rgba(251,191,36,0.32)"/>
    <text x="596" y="68" fill="#fbbf24" font-size="11" font-weight="700">3. ZERO-FP ENGINE</text>
    <text x="596" y="94" fill="#f4f4f5" font-size="13" font-weight="650">6-Signal Forensic Model</text>
    <text x="596" y="120" fill="#a1a1aa" font-size="11.5">· Multi-Signal Corroboration</text>
    <text x="596" y="142" fill="#a1a1aa" font-size="11.5">· CAPS2 vs Elo Band Excess</text>
    <text x="596" y="164" fill="#a1a1aa" font-size="11.5">· Exact Move-Range Pinpointer</text>
    <text x="596" y="186" fill="#a1a1aa" font-size="11.5">· Live Clock Fusion (+12% cap)</text>

    <path d="M828 125 L862 125" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="4 3"/>

    <rect x="868" y="38" width="184" height="174" rx="12" fill="rgba(255,255,255,0.025)" stroke="rgba(244,63,94,0.32)"/>
    <text x="886" y="68" fill="#f43f5e" font-size="11" font-weight="700">4. OBSIDIAN HUD</text>
    <text x="886" y="94" fill="#f4f4f5" font-size="13" font-weight="650">Isolated Shadow UI</text>
    <text x="886" y="120" fill="#a1a1aa" font-size="11.5">· 240 deg Instrument Dial</text>
    <text x="886" y="142" fill="#a1a1aa" font-size="11.5">· Smooth SVG Chronograms</text>
    <text x="886" y="164" fill="#a1a1aa" font-size="11.5">· Inline Username % Pill</text>
    <text x="886" y="186" fill="#a1a1aa" font-size="11.5">· Instant TR / EN Switch</text>
  </g>
</svg>`;

fs.writeFileSync(path.join(ASSETS_DIR, 'architecture.svg'), archSvg, 'utf8');
console.log('Generated extension icons (16, 32, 48, 128) and GitHub SVG assets.');
