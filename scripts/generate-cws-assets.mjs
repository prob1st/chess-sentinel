import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'store-assets');
fs.mkdirSync(OUT, { recursive: true });

// Pure SVG filled ring-sector path (100% renderer-independent across all SVG engines!)
function describeDonutArc(cx, cy, rOuter, thickness, pct) {
  const rInner = rOuter - thickness;
  const clamped = Math.min(99.5, Math.max(2, pct));
  const endAngle = ((clamped / 100) * 360 - 90) * (Math.PI / 180);
  const largeArc = clamped > 50 ? 1 : 0;

  const ox1 = cx;
  const oy1 = cy - rOuter;
  const ox2 = cx + rOuter * Math.cos(endAngle);
  const oy2 = cy + rOuter * Math.sin(endAngle);

  const ix2 = cx + rInner * Math.cos(endAngle);
  const iy2 = cy + rInner * Math.sin(endAngle);
  const ix1 = cx;
  const iy1 = cy - rInner;

  return `M ${ox1.toFixed(2)} ${oy1.toFixed(2)} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${rInner} ${rInner} 0 ${largeArc} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`;
}

function renderGaugeSvg(cx, cy, rOuter, thickness, pct, color, bgRing = '#1e293b', innerBg = '#0c1422') {
  const rInner = rOuter - thickness;
  return `<circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="${bgRing}"/>
    <path d="${describeDonutArc(cx, cy, rOuter, thickness, pct)}" fill="${color}"/>
    <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="${innerBg}"/>`;
}

function renderChessboardSvg(x, y, size) {
  const sq = size / 8;
  let rects = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const fill = (r + c) % 2 === 0 ? '#ebecd0' : '#739552';
      rects += `<rect x="${(c * sq).toFixed(1)}" y="${(r * sq).toFixed(1)}" width="${sq.toFixed(1)}" height="${sq.toFixed(1)}" fill="${fill}"/>`;
    }
  }
  rects += `<rect x="${(4 * sq).toFixed(1)}" y="${(6 * sq).toFixed(1)}" width="${sq.toFixed(1)}" height="${sq.toFixed(1)}" fill="#f5f682"/>`;
  rects += `<rect x="${(4 * sq).toFixed(1)}" y="${(4 * sq).toFixed(1)}" width="${sq.toFixed(1)}" height="${sq.toFixed(1)}" fill="#f5f682"/>`;

  let pieces = '';
  const drawPiece = (col, row, isWhite, isRoyal = false) => {
    const cx = col * sq + sq / 2;
    const cy = row * sq + sq / 2;
    const fill = isWhite ? '#ffffff' : '#1e242b';
    const stroke = isWhite ? '#475569' : '#94a3b8';
    pieces += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(sq * 0.33).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="2.2"/>`;
    if (isRoyal) {
      pieces += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(sq * 0.13).toFixed(1)}" fill="${isWhite ? '#0ea5e9' : '#f59e0b'}"/>`;
    }
  };

  for (let c = 0; c < 8; c++) {
    drawPiece(c, 0, false, c === 3 || c === 4);
    if (c !== 4) drawPiece(c, 1, false, false);
    if (c !== 4) drawPiece(c, 6, true, false);
    drawPiece(c, 7, true, c === 3 || c === 4);
  }
  drawPiece(4, 3, false, false);
  drawPiece(4, 4, true, false);

  return `<g transform="translate(${x}, ${y})">
    <rect x="-4" y="-4" width="${size + 8}" height="${size + 8}" rx="10" fill="#1e293b"/>
    <g>${rects}${pieces}</g>
  </g>`;
}

// 1. Screenshot 1 (1280x800): Live In-Game Floating HUD
const screenshot1Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" width="1280" height="800">
  <rect width="1280" height="800" fill="#070b14"/>

  <g transform="translate(68, 42)" font-family="sans-serif">
    <rect x="0" y="0" width="338" height="32" rx="16" fill="#0d2926" stroke="#10b981" stroke-width="1.5"/>
    <circle cx="18" cy="16" r="5" fill="#10b981"/>
    <text x="32" y="21" fill="#6ee7b7" font-size="12" font-weight="bold">REAL-TIME IN-GAME OVERLAY HUD</text>
    <text x="0" y="72" fill="#f8fafc" font-size="33" font-weight="bold">Instant Opponent Cheat Probability (%) on Chess.com</text>
    <text x="0" y="102" fill="#94a3b8" font-size="16.5">Detects Stockfish pacing flatlines &amp; statistical anomalies within 2 seconds — right inside your abort window.</text>
  </g>

  <g transform="translate(68, 176)" font-family="sans-serif">
    <rect x="0" y="0" width="520" height="52" rx="10" fill="#161d2b" stroke="#2d3748"/>
    <rect x="12" y="10" width="32" height="32" rx="6" fill="#2d3748"/>
    <text x="22" y="31" fill="#e2e8f0" font-size="15" font-weight="bold">S</text>
    <text x="54" y="31" fill="#f8fafc" font-size="15.5" font-weight="bold">SuspectEngine_99</text>
    <text x="214" y="31" fill="#94a3b8" font-size="14">(2185)</text>

    <rect x="272" y="13" width="138" height="26" rx="13" fill="#3a1620" stroke="#ef4444" stroke-width="1.4"/>
    <circle cx="287" cy="26" r="4" fill="#ef4444"/>
    <text x="298" y="30" fill="#fca5a5" font-size="12" font-weight="bold">94% • 41W/4L</text>

    <rect x="438" y="10" width="70" height="32" rx="6" fill="#0f172a"/>
    <text x="450" y="31" fill="#f8fafc" font-size="15" font-weight="bold">09:58</text>

    ${renderChessboardSvg(28, 64, 464)}

    <rect x="0" y="540" width="520" height="50" rx="10" fill="#161d2b" stroke="#2d3748"/>
    <rect x="12" y="549" width="32" height="32" rx="6" fill="#1e3a5f"/>
    <text x="22" y="570" fill="#bae6fd" font-size="15" font-weight="bold">Y</text>
    <text x="54" y="570" fill="#f8fafc" font-size="15.5" font-weight="bold">HonestPlayer_TR</text>
    <text x="204" y="570" fill="#94a3b8" font-size="14">(2140)</text>
    <rect x="438" y="549" width="70" height="32" rx="6" fill="#0f172a"/>
    <text x="450" y="570" fill="#f8fafc" font-size="15" font-weight="bold">10:00</text>
  </g>

  <g transform="translate(658, 174)" font-family="sans-serif">
    <rect x="0" y="0" width="554" height="590" rx="22" fill="#0c1220" stroke="#ef4444" stroke-width="2"/>
    <rect x="0" y="0" width="554" height="5" rx="2.5" fill="#ef4444"/>

    <polygon points="32,19 44,24 44,34 32,42 20,34 20,24" fill="#2d1219" stroke="#ef4444" stroke-width="2.2"/>
    <text x="54" y="36" fill="#f8fafc" font-size="15" font-weight="bold">CHESS SENTINEL</text>

    <rect x="404" y="18" width="54" height="26" rx="7" fill="#1e293b"/>
    <text x="431" y="35" text-anchor="middle" fill="#e2e8f0" font-size="11.5" font-weight="bold">TR/EN</text>
    <rect x="466" y="18" width="32" height="26" rx="7" fill="#1e293b"/>
    <text x="482" y="35" text-anchor="middle" fill="#e2e8f0" font-size="12" font-weight="bold">S</text>
    <rect x="506" y="18" width="32" height="26" rx="7" fill="#1e293b"/>
    <text x="522" y="35" text-anchor="middle" fill="#e2e8f0" font-size="14" font-weight="bold">-</text>
    <line x1="0" y1="56" x2="554" y2="56" stroke="#1e293b"/>

    <rect x="24" y="72" width="506" height="38" rx="9" fill="#2d1219" stroke="#ef4444"/>
    <text x="40" y="96" fill="#fca5a5" font-size="13" font-weight="bold">SAFE ABORT WINDOW OPEN — High Engine Probability</text>

    <!-- Radial Gauge -->
    ${renderGaugeSvg(88, 184, 54, 10, 94, '#ef4444', '#1e293b', '#0c1220')}
    <text x="88" y="191" text-anchor="middle" fill="#f8fafc" font-size="28" font-weight="bold">94%</text>
    <text x="88" y="209" text-anchor="middle" fill="#94a3b8" font-size="8.5" font-weight="bold">CHEAT PROB</text>

    <g transform="translate(164, 142)">
      <text x="0" y="22" fill="#f8fafc" font-size="22" font-weight="bold">@SuspectEngine_99</text>
      <rect x="0" y="36" width="194" height="26" rx="13" fill="#3a1620" stroke="#ef4444"/>
      <text x="97" y="53" text-anchor="middle" fill="#f87171" font-size="11" font-weight="bold">CRITICAL CHEAT RISK</text>
      <text x="206" y="53" fill="#94a3b8" font-size="12">High Confidence</text>
      <text x="0" y="84" fill="#cbd5e1" font-size="13.5">Rapid 2185 (+210 7d) • Age: 8 days</text>
    </g>

    <g transform="translate(24, 262)">
      <rect x="0" y="0" width="118" height="58" rx="10" fill="#131b2e" stroke="#1e293b"/>
      <text x="59" y="27" text-anchor="middle" fill="#f8fafc" font-size="16" font-weight="bold">8 days</text>
      <text x="59" y="46" text-anchor="middle" fill="#94a3b8" font-size="11">Account Age</text>

      <rect x="129" y="0" width="118" height="58" rx="10" fill="#131b2e" stroke="#1e293b"/>
      <text x="188" y="27" text-anchor="middle" fill="#f87171" font-size="16" font-weight="bold">94.8%</text>
      <text x="188" y="46" text-anchor="middle" fill="#94a3b8" font-size="11">CAPS2 Accuracy</text>

      <rect x="258" y="0" width="118" height="58" rx="10" fill="#131b2e" stroke="#1e293b"/>
      <text x="317" y="27" text-anchor="middle" fill="#f87171" font-size="16" font-weight="bold">0.19</text>
      <text x="317" y="46" text-anchor="middle" fill="#94a3b8" font-size="11">Move Pace QCD</text>

      <rect x="387" y="0" width="119" height="58" rx="10" fill="#131b2e" stroke="#1e293b"/>
      <text x="446" y="27" text-anchor="middle" fill="#fbbf24" font-size="16" font-weight="bold">+4.8s</text>
      <text x="446" y="46" text-anchor="middle" fill="#94a3b8" font-size="11">Elo Z-Score</text>
    </g>

    <g transform="translate(24, 336)">
      <rect x="0" y="0" width="506" height="32" rx="8" fill="#2b141a" stroke="#7f1d1d"/>
      <text x="14" y="21" fill="#fecaca" font-size="12" font-weight="bold">! 91% win rate across last 45 rated games (+4.8 sigma Elo excess)</text>

      <rect x="0" y="38" width="506" height="32" rx="8" fill="#2b141a" stroke="#7f1d1d"/>
      <text x="14" y="59" fill="#fecaca" font-size="12" font-weight="bold">! Collapsed chronometric entropy (1.31 bits) &amp; flatline QCD (0.19)</text>
    </g>

    <g transform="translate(24, 422)" font-size="12">
      <text x="0" y="14" fill="#cbd5e1" font-weight="bold">Elo-Adjusted Performance Z-Score</text>
      <text x="506" y="14" text-anchor="end" fill="#f8fafc" font-weight="bold">93/100</text>
      <rect x="0" y="21" width="506" height="7" rx="3.5" fill="#1e293b"/>
      <rect x="0" y="21" width="470" height="7" rx="3.5" fill="#ef4444"/>

      <text x="0" y="52" fill="#cbd5e1" font-weight="bold">Long-Game Bias-Adjusted CAPS2 Excess</text>
      <text x="506" y="52" text-anchor="end" fill="#f8fafc" font-weight="bold">91/100</text>
      <rect x="0" y="59" width="506" height="7" rx="3.5" fill="#1e293b"/>
      <rect x="0" y="59" width="460" height="7" rx="3.5" fill="#ef4444"/>

      <text x="0" y="90" fill="#cbd5e1" font-weight="bold">PGN [%clk] Chronometric Entropy &amp; QCD</text>
      <text x="506" y="90" text-anchor="end" fill="#f8fafc" font-weight="bold">89/100</text>
      <rect x="0" y="97" width="506" height="7" rx="3.5" fill="#1e293b"/>
      <rect x="0" y="97" width="450" height="7" rx="3.5" fill="#ef4444"/>

      <text x="0" y="128" fill="#cbd5e1" font-weight="bold">Account Provenance &amp; Burner Risk</text>
      <text x="506" y="128" text-anchor="end" fill="#f8fafc" font-weight="bold">86/100</text>
      <rect x="0" y="135" width="506" height="7" rx="3.5" fill="#1e293b"/>
      <rect x="0" y="135" width="435" height="7" rx="3.5" fill="#f97316"/>
    </g>
  </g>
</svg>`;

// 2. Screenshot 2 (1280x800): Bayesian Anti-False-Positive Shield
const screenshot2Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" width="1280" height="800">
  <rect width="1280" height="800" fill="#070c16"/>

  <g transform="translate(68, 52)" font-family="sans-serif">
    <rect x="0" y="0" width="352" height="32" rx="16" fill="#0d2926" stroke="#10b981" stroke-width="1.5"/>
    <text x="20" y="21" fill="#6ee7b7" font-size="12" font-weight="bold">BAYESIAN LOG-ODDS ENGINE v2.0</text>
    <text x="0" y="74" fill="#f8fafc" font-size="33" font-weight="bold">Ultra-Low False Positives via Biomechanical Clock Entropy</text>
    <text x="0" y="106" fill="#94a3b8" font-size="16.5">Distinguishes honest hot streaks, free-review bias, and FIDE masters from mechanical engine play.</text>
  </g>

  <g transform="translate(68, 196)" font-family="sans-serif">
    <!-- Card 1: Honest Player -->
    <g transform="translate(0, 0)">
      <rect x="0" y="0" width="364" height="528" rx="20" fill="#0c1422" stroke="#10b981" stroke-width="2"/>
      ${renderGaugeSvg(182, 94, 50, 9, 6, '#10b981', '#1e293b', '#0c1422')}
      <text x="182" y="104" text-anchor="middle" fill="#f8fafc" font-size="28" font-weight="bold">2%</text>
      <text x="182" y="174" text-anchor="middle" fill="#34d399" font-size="14" font-weight="bold">LOW RISK • HONEST HUMAN</text>
      <text x="182" y="200" text-anchor="middle" fill="#94a3b8" font-size="13">@ClubVeteran_2019 (1840 Elo)</text>

      <g transform="translate(24, 234)" font-size="12.5">
        <rect x="0" y="0" width="316" height="46" rx="9" fill="#111d2e"/>
        <text x="14" y="28" fill="#cbd5e1">Shannon Time Entropy</text>
        <text x="302" y="28" text-anchor="end" fill="#34d399" font-weight="bold">2.42 bits</text>

        <rect x="0" y="58" width="316" height="46" rx="9" fill="#111d2e"/>
        <text x="14" y="86" fill="#cbd5e1">Quartile Dispersion (QCD)</text>
        <text x="302" y="86" text-anchor="end" fill="#34d399" font-weight="bold">0.61 (Organic)</text>

        <rect x="0" y="116" width="316" height="46" rx="9" fill="#111d2e"/>
        <text x="14" y="144" fill="#cbd5e1">Free-Review Bias Filter</text>
        <text x="302" y="144" text-anchor="end" fill="#34d399" font-weight="bold">Protected</text>

        <rect x="0" y="180" width="316" height="72" rx="10" fill="#0c2922" stroke="#10b981"/>
        <text x="16" y="208" fill="#a7f3d0" font-weight="bold">Human Veto Applied (-0.85 LLR)</text>
        <text x="16" y="232" fill="#6ee7b7" font-size="11.5">Natural premoves &amp; deep thinks verified.</text>
      </g>
    </g>

    <!-- Card 2: Smurf / Streak -->
    <g transform="translate(390, 0)">
      <rect x="0" y="0" width="364" height="528" rx="20" fill="#0c1422" stroke="#38bdf8" stroke-width="2"/>
      ${renderGaugeSvg(182, 94, 50, 9, 30, '#38bdf8', '#1e293b', '#0c1422')}
      <text x="182" y="104" text-anchor="middle" fill="#f8fafc" font-size="28" font-weight="bold">30%</text>
      <text x="182" y="174" text-anchor="middle" fill="#38bdf8" font-size="14" font-weight="bold">GUARDED • SMURF / STREAK</text>
      <text x="182" y="200" text-anchor="middle" fill="#94a3b8" font-size="13">@NewClimber_12 (1690 Elo)</text>

      <g transform="translate(24, 234)" font-size="12.5">
        <rect x="0" y="0" width="316" height="46" rx="9" fill="#111d2e"/>
        <text x="14" y="28" fill="#cbd5e1">Elo Win Z-Score</text>
        <text x="302" y="28" text-anchor="end" fill="#fbbf24" font-weight="bold">+3.4s (18W/2L)</text>

        <rect x="0" y="58" width="316" height="46" rx="9" fill="#111d2e"/>
        <text x="14" y="86" fill="#cbd5e1">Shannon Time Entropy</text>
        <text x="302" y="86" text-anchor="end" fill="#34d399" font-weight="bold">2.28 bits</text>

        <rect x="0" y="116" width="316" height="46" rx="9" fill="#111d2e"/>
        <text x="14" y="144" fill="#cbd5e1">Long-Game CAPS2</text>
        <text x="302" y="144" text-anchor="end" fill="#34d399" font-weight="bold">81.4% (Normal)</text>

        <rect x="0" y="180" width="316" height="72" rx="10" fill="#0f2438" stroke="#38bdf8"/>
        <text x="16" y="208" fill="#bae6fd" font-weight="bold">Corroboration Gate Capped</text>
        <text x="16" y="232" fill="#7dd3fc" font-size="11.5">No false Critical alarm on human streaks!</text>
      </g>
    </g>

    <!-- Card 3: Confirmed Engine -->
    <g transform="translate(780, 0)">
      <rect x="0" y="0" width="364" height="528" rx="20" fill="#0c1422" stroke="#ef4444" stroke-width="2"/>
      ${renderGaugeSvg(182, 94, 50, 9, 94, '#ef4444', '#1e293b', '#0c1422')}
      <text x="182" y="104" text-anchor="middle" fill="#f8fafc" font-size="28" font-weight="bold">94%</text>
      <text x="182" y="174" text-anchor="middle" fill="#f87171" font-size="14" font-weight="bold">CRITICAL • ENGINE DETECTED</text>
      <text x="182" y="200" text-anchor="middle" fill="#94a3b8" font-size="13">@StockfishRelay_01 (2240 Elo)</text>

      <g transform="translate(24, 234)" font-size="12.5">
        <rect x="0" y="0" width="316" height="46" rx="9" fill="#111d2e"/>
        <text x="14" y="28" fill="#cbd5e1">Elo Win Z-Score</text>
        <text x="302" y="28" text-anchor="end" fill="#f87171" font-weight="bold">+4.9s (44W/5L)</text>

        <rect x="0" y="58" width="316" height="46" rx="9" fill="#111d2e"/>
        <text x="14" y="86" fill="#cbd5e1">Shannon Time Entropy</text>
        <text x="302" y="86" text-anchor="end" fill="#f87171" font-weight="bold">1.29b (Flatline)</text>

        <rect x="0" y="116" width="316" height="46" rx="9" fill="#111d2e"/>
        <text x="14" y="144" fill="#cbd5e1">Long-Game CAPS2</text>
        <text x="302" y="144" text-anchor="end" fill="#f87171" font-weight="bold">95.2% (+10.7%)</text>

        <rect x="0" y="180" width="316" height="72" rx="10" fill="#2d1219" stroke="#ef4444"/>
        <text x="16" y="208" fill="#fecaca" font-weight="bold">Multi-Pillar Corroborated (+LLR)</text>
        <text x="16" y="232" fill="#fca5a5" font-size="11.5">Results + Clock + Accuracy aligned.</text>
      </g>
    </g>
  </g>
</svg>`;

// 3. Screenshot 3 (1280x800): Live Player Scanner + Automated Ban Watchlist
const screenshot3Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" width="1280" height="800">
  <rect width="1280" height="800" fill="#070b14"/>
  <g transform="translate(68, 52)" font-family="sans-serif">
    <rect x="0" y="0" width="336" height="32" rx="16" fill="#112238" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="20" y="21" fill="#7dd3fc" font-size="12" font-weight="bold">LIVE SCANNER &amp; BAN WATCHLIST</text>
    <text x="0" y="74" fill="#f8fafc" font-size="33" font-weight="bold">Search Any Player &amp; Track Fair-Play Bans Automatically</text>
    <text x="0" y="106" fill="#94a3b8" font-size="16.5">100% local privacy • Zero external servers • Instant 1-click English &amp; Turkish interface.</text>
  </g>

  <g transform="translate(110, 196)" font-family="sans-serif">
    <rect x="0" y="0" width="490" height="530" rx="20" fill="#0b111e" stroke="#1e293b" stroke-width="2"/>
    <text x="24" y="38" fill="#f8fafc" font-size="15.5" font-weight="bold">CHESS SENTINEL — LIVE PLAYER SCANNER</text>
    <line x1="0" y1="56" x2="490" y2="56" stroke="#1e293b"/>

    <rect x="24" y="76" width="334" height="42" rx="9" fill="#131c2e" stroke="#38bdf8"/>
    <text x="40" y="102" fill="#f8fafc" font-size="14">GothamChess</text>
    <rect x="368" y="76" width="98" height="42" rx="9" fill="#10b981"/>
    <text x="417" y="102" text-anchor="middle" fill="#041812" font-size="14" font-weight="bold">Analyze</text>

    <rect x="24" y="138" width="442" height="164" rx="14" fill="#111a2c" stroke="#10b981"/>
    <rect x="42" y="158" width="34" height="22" rx="5" fill="#dc2626"/>
    <text x="59" y="174" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="bold">IM</text>
    <text x="84" y="175" fill="#f8fafc" font-size="18" font-weight="bold">@GothamChess</text>
    <text x="42" y="200" fill="#94a3b8" font-size="12.5">BLITZ 2884 • 9.6 yr • FIDE Master Calibration</text>
    <rect x="372" y="156" width="74" height="44" rx="10" fill="#0d2e24" stroke="#10b981"/>
    <text x="409" y="185" text-anchor="middle" fill="#34d399" font-size="22" font-weight="bold">1%</text>
    <text x="42" y="242" fill="#a7f3d0" font-size="12.5">+ Verified FIDE IM — elite statistical dampener active</text>
    <text x="42" y="268" fill="#a7f3d0" font-size="12.5">+ Organic human move-time variance (Entropy: 1.94 bits)</text>

    <text x="24" y="336" fill="#94a3b8" font-size="11.5" font-weight="bold">RECENTLY SCANNED OPPONENTS</text>
    <rect x="24" y="350" width="442" height="48" rx="9" fill="#111a2c"/>
    <text x="40" y="379" fill="#f1f5f9" font-size="14" font-weight="bold">@chessleopard1969</text>
    <text x="442" y="379" text-anchor="end" fill="#34d399" font-size="14" font-weight="bold">2%</text>

    <rect x="24" y="408" width="442" height="48" rx="9" fill="#111a2c"/>
    <text x="40" y="437" fill="#f1f5f9" font-size="14" font-weight="bold">@SuspectEngine_99</text>
    <text x="442" y="437" text-anchor="end" fill="#f87171" font-size="14" font-weight="bold">94%</text>

    <rect x="24" y="466" width="442" height="48" rx="9" fill="#111a2c"/>
    <text x="40" y="495" fill="#f1f5f9" font-size="14" font-weight="bold">@SumitGM000</text>
    <text x="442" y="495" text-anchor="end" fill="#fb7185" font-size="14" font-weight="bold">100% BANNED</text>
  </g>

  <g transform="translate(670, 196)" font-family="sans-serif">
    <rect x="0" y="0" width="490" height="530" rx="20" fill="#0b111e" stroke="#1e293b" stroke-width="2"/>
    <text x="24" y="38" fill="#f8fafc" font-size="15.5" font-weight="bold">SUSPECT &amp; FAIR-PLAY BAN WATCHLIST</text>
    <line x1="0" y1="56" x2="490" y2="56" stroke="#1e293b"/>

    <text x="24" y="96" fill="#94a3b8" font-size="13">Tracked Suspects (2 Confirmed Bans)</text>
    <rect x="304" y="72" width="162" height="36" rx="9" fill="#0ea5e9"/>
    <text x="385" y="95" text-anchor="middle" fill="#031520" font-size="12.5" font-weight="bold">Check Ban Status</text>

    <g transform="translate(24, 128)">
      <rect x="0" y="0" width="442" height="72" rx="11" fill="#241119" stroke="#f43f5e"/>
      <text x="18" y="30" fill="#f8fafc" font-size="15" font-weight="bold">@SumitGM000</text>
      <text x="18" y="52" fill="#fda4af" font-size="12">Initial risk: 96% • 2385 Elo Rapid</text>
      <rect x="262" y="21" width="162" height="28" rx="14" fill="#4c0519" stroke="#f43f5e"/>
      <text x="343" y="39" text-anchor="middle" fill="#fda4af" font-size="11" font-weight="bold">BANNED (FAIR PLAY)</text>

      <rect x="0" y="88" width="442" height="72" rx="11" fill="#241119" stroke="#f43f5e"/>
      <text x="18" y="118" fill="#f8fafc" font-size="15" font-weight="bold">@BurnerTactics_04</text>
      <text x="18" y="140" fill="#fda4af" font-size="12">Initial risk: 88% • 2040 Elo Blitz</text>
      <rect x="262" y="109" width="162" height="28" rx="14" fill="#4c0519" stroke="#f43f5e"/>
      <text x="343" y="127" text-anchor="middle" fill="#fda4af" font-size="11" font-weight="bold">BANNED (FAIR PLAY)</text>

      <rect x="0" y="176" width="442" height="72" rx="11" fill="#111a2c" stroke="#1e293b"/>
      <text x="18" y="206" fill="#f8fafc" font-size="15" font-weight="bold">@MonitoringUser_77</text>
      <text x="18" y="228" fill="#94a3b8" font-size="12">Initial risk: 74% • Checked 10m ago</text>
      <rect x="296" y="197" width="128" height="28" rx="14" fill="#1e293b"/>
      <text x="360" y="215" text-anchor="middle" fill="#cbd5e1" font-size="11.5" font-weight="bold">Monitoring...</text>
    </g>

    <rect x="24" y="424" width="442" height="82" rx="12" fill="#0f2234" stroke="#38bdf8"/>
    <text x="42" y="454" fill="#f8fafc" font-size="14" font-weight="bold">Bilingual Interface: English &amp; Türkçe (TR / EN)</text>
    <text x="42" y="480" fill="#94a3b8" font-size="12.5">Switch languages in 1 click from the HUD or Toolbar Settings.</text>
  </g>
</svg>`;

// 4. Small Promo Tile (440x280)
const promoSmallSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 280" width="440" height="280">
  <rect width="440" height="280" fill="#070c16"/>
  <g transform="translate(28, 32)" font-family="sans-serif">
    <polygon points="22,2 42,11 42,29 22,44 2,29 2,11" fill="#10b981"/>
    <polygon points="22,6 38,13 38,27 22,39 6,27 6,13" fill="#0d2926"/>
    <polygon points="19,25 13,19 10,22 19,31 34,16 31,13" fill="#34d399"/>
    <text x="52" y="30" fill="#f8fafc" font-size="24" font-weight="bold">Chess Sentinel</text>
    <text x="0" y="70" fill="#38bdf8" font-size="14" font-weight="bold">Opponent Cheat Probability HUD</text>
    <text x="0" y="96" fill="#94a3b8" font-size="12">Bayesian Fair-Play Radar for Chess.com</text>

    <g transform="translate(0, 124)">
      <rect x="0" y="0" width="184" height="76" rx="12" fill="#111a2c" stroke="#10b981"/>
      <text x="16" y="34" fill="#34d399" font-size="23" font-weight="bold">2%</text>
      <text x="66" y="31" fill="#e2e8f0" font-size="11.5" font-weight="bold">LOW RISK</text>
      <text x="16" y="57" fill="#94a3b8" font-size="10.5">Human Clock Verified</text>

      <rect x="198" y="0" width="186" height="76" rx="12" fill="#241119" stroke="#ef4444"/>
      <text x="214" y="34" fill="#f87171" font-size="23" font-weight="bold">94%</text>
      <text x="278" y="31" fill="#fecaca" font-size="11.5" font-weight="bold">CRITICAL</text>
      <text x="214" y="57" fill="#fca5a5" font-size="10.5">Engine Pacing Alert</text>
    </g>
  </g>
</svg>`;

// 5. Marquee Promo Tile (1400x560)
const promoMarqueeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 560" width="1400" height="560">
  <rect width="1400" height="560" fill="#070b14"/>
  <g transform="translate(88, 96)" font-family="sans-serif">
    <rect x="0" y="0" width="352" height="36" rx="18" fill="#0d2926" stroke="#10b981" stroke-width="1.5"/>
    <text x="22" y="23" fill="#6ee7b7" font-size="13" font-weight="bold">BAYESIAN FAIR-PLAY TELEMETRY v2.0</text>
    <text x="0" y="106" fill="#f8fafc" font-size="60" font-weight="bold">Chess Sentinel</text>
    <text x="0" y="156" fill="#cbd5e1" font-size="20.5">Real-Time Opponent Cheat Probability (%) &amp; Forensic HUD for Chess.com</text>
    <text x="0" y="198" fill="#94a3b8" font-size="16.5">PGN [%clk] Shannon Entropy • Bias-Corrected CAPS2 • Elo Z-Score • Ban Watchlist</text>

    <g transform="translate(0, 256)" font-size="15" font-weight="bold">
      <rect x="0" y="0" width="236" height="48" rx="12" fill="#111d2e" stroke="#38bdf8"/>
      <text x="118" y="30" text-anchor="middle" fill="#e2e8f0">Ultra-Low False Positives</text>

      <rect x="254" y="0" width="214" height="48" rx="12" fill="#111d2e" stroke="#10b981"/>
      <text x="361" y="30" text-anchor="middle" fill="#e2e8f0">100% Local &amp; Private</text>

      <rect x="486" y="0" width="214" height="48" rx="12" fill="#111d2e" stroke="#f59e0b"/>
      <text x="593" y="30" text-anchor="middle" fill="#e2e8f0">English &amp; Türkçe UI</text>
    </g>
  </g>

  <g transform="translate(1152, 280)" font-family="sans-serif">
    <circle cx="0" cy="0" r="158" fill="#0b111e" stroke="#1e293b" stroke-width="4"/>
    ${renderGaugeSvg(0, 0, 126, 18, 92, '#ef4444', '#1e293b', '#0b111e')}
    <text x="0" y="16" text-anchor="middle" fill="#f8fafc" font-size="64" font-weight="bold">92%</text>
    <text x="0" y="54" text-anchor="middle" fill="#f87171" font-size="15" font-weight="bold">CHEAT PROBABILITY</text>
  </g>
</svg>`;

const jobs = [
  { name: 'screenshot-1-live-hud-1280x800.png', svg: screenshot1Svg, w: 1280, h: 800 },
  { name: 'screenshot-2-false-positive-shield-1280x800.png', svg: screenshot2Svg, w: 1280, h: 800 },
  { name: 'screenshot-3-popup-watchlist-1280x800.png', svg: screenshot3Svg, w: 1280, h: 800 },
  { name: 'promo-small-440x280.png', svg: promoSmallSvg, w: 440, h: 280 },
  { name: 'promo-marquee-1400x560.png', svg: promoMarqueeSvg, w: 1400, h: 560 },
];

for (const job of jobs) {
  const tmpSvg = path.join('/tmp', `${job.name}.svg`);
  const outPng = path.join(OUT, job.name);
  fs.writeFileSync(tmpSvg, job.svg, 'utf8');
  execFileSync('convert', [
    tmpSvg,
    '-resize',
    `${job.w}x${job.h}!`,
    '-background',
    '#070b14',
    '-flatten',
    '-alpha',
    'off',
    '-depth',
    '8',
    `PNG24:${outPng}`,
  ]);
  fs.unlinkSync(tmpSvg);
}

fs.copyFileSync(
  path.join(ROOT, 'public', 'icons', 'icon128.png'),
  path.join(OUT, 'store-icon-128x128.png')
);

console.log('Generated all 6 Chrome Web Store 24-bit RGB submission assets in ./store-assets/');
