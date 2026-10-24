<div align="center">

<img src="./assets/banner.svg" alt="Chess Sentinel — Real-Time Opponent Cheat Probability & Forensic HUD for Chess.com" width="100%" />

<br />

[![CI Status](https://github.com/fatihmehmettezcan5-ops/chess-sentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/fatihmehmettezcan5-ops/chess-sentinel/actions)
[![Release](https://img.shields.io/github/v/release/fatihmehmettezcan5-ops/chess-sentinel?color=10b981&label=Latest%20Release)](https://github.com/fatihmehmettezcan5-ops/chess-sentinel/releases)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-38bdf8?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%20Strict-3178c6?logo=typescript&logoColor=white)](./tsconfig.json)
[![Zero Telemetry](https://img.shields.io/badge/Privacy-100%25%20Local%20%2F%20Zero%20Tracking-10b981)](./PRIVACY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b.svg)](./LICENSE)

**Instant, forensic-grade opponent cheat probability (`0% – 100%`) rendered directly on Chess.com via an isolated Shadow-DOM Glassmorphic HUD & inline username badge.**

[🇬🇧 **English Documentation**](#-why-chess-sentinel) • [⚡ **30-Second Install**](#-installation) • [🧬 **6-Signal Math Model**](#-the-6-signal-bayesian-forensic-engine) • [🇹🇷 **Türkçe Rehber**](#-türkçe-dokümantasyon)

</div>

---

## 🛡️ Why Chess Sentinel?

Older Chess.com opponent-risk extensions stopped working in 2025–2026 due to four major shifts:
1. **SPA Route Changes:** Chess.com migrated live game URLs from `/game/live/{id}` to `/game/{id}`, `/play/online`, and dynamic SPA transitions.
2. **Web Component Shadow DOM:** Player bars moved inside `<cc-user-username-component>` custom elements, leaving legacy CSS selectors blind.
3. **Chrome `openPopup()` Restrictions:** Extensions relying on `chrome.action.openPopup()` silently failed or hung forever on `"Loading..."`.
4. **Missing Game Reviews (`CAPS2 = null`):** Over 70% of online games never have Paid Game Review run on them—causing accuracy-only extensions to severely underscore blatant Stockfish users.

**Chess Sentinel** was engineered from the ground up in strict TypeScript to solve every single one of those failure modes:

- **🪟 In-Page Glassmorphic HUD Pop-up (Shadow DOM Isolated):** Appears automatically right next to the Chess.com board the moment an opponent is matched—immune to Chess.com CSS updates, draggable anywhere, minimizable to a sleek floating pill (`Alt + S`), with **1-click `TR / EN` language switching**.
- **🏷️ Native Inline `%` Username Pill:** Injects a crisp, color-coded `[%89 • 42W/9L]` risk badge directly beside your opponent's username on the player bar.
- **⏱️ Breakthrough PGN `[%clk]` Move-Pacing Forensics:** Even when an opponent has **zero** Game Reviews, Chess Sentinel parses `0.1s`-precision `[%clk]` timestamps from their recent PGNs to detect **robotic Stockfish relay flatlines** (`CV ≤ 0.44` with zero instinctive `<1.8s` recaptures) and **mid-game engine toggles** (long alt-tab pause followed by mechanical perfection).
- **👁️ Suspect Ban Watchlist & Automated Fair-Play Monitor:** Flag suspicious opponents in 1 click. Chess Sentinel periodically checks `api.chess.com/pub/player/{user}` in the background and alerts you when Chess.com closes their account for `closed:fair_play_violations`!
- **⚡ Resilient Serial PubAPI Harvester:** Respects Chess.com's sequential rate-limit rules and automatically falls back to prior monthly archives if an oversized archive returns `{ code: 0 }` internal errors.

<div align="center">
  <img src="./assets/architecture.svg" alt="Chess Sentinel Telemetry Pipeline" width="100%" />
</div>

---

## ⚡ Installation

Works out of the box on **Google Chrome, Brave, Microsoft Edge, Arc, Opera, and Vivaldi**.

### Option A — Instant Install from Releases (No Node.js Required)
1. Download **`chess-sentinel-v1.0.1-chrome.zip`** from [**GitHub Releases**](https://github.com/fatihmehmettezcan5-ops/chess-sentinel/releases/latest) and extract the folder. *(Alternatively, clone this repo—the pre-built `./extension` folder is included ready-to-load!)*
2. Open `chrome://extensions` in your browser.
3. Toggle **Developer mode** ON in the top-right corner.
4. Click **Load unpacked** and select the extracted folder (or the `extension/` folder inside this repository).
5. Open [Chess.com](https://www.chess.com/play/online) and start or spectate any game!

### Option B — Build & Verify from Source (Developers)
```bash
git clone https://github.com/fatihmehmettezcan5-ops/chess-sentinel.git
cd chess-sentinel
npm install

# Run strict TypeScript check + Vitest unit suite + build ./extension
npm run typecheck
npm test
npm run package
```

---

## 🧬 The 6-Signal Bayesian Forensic Engine

Chess Sentinel computes a composite **Cheat Probability (`0% – 100%`)** by fusing six orthogonal public signals from Chess.com's official Published-Data API:

| # | Forensic Signal | Base Weight | What It Measures |
| :--- | :--- | :---: | :--- |
| **1** | **Recent Win-Rate Anomaly (`RWR`)** | `25%` | Sample-weighted (`n / (n + 14)`) win-rate deviation above the 50% Glicko-2 equilibrium in recent rated games. |
| **2** | **CAPS2 Accuracy Excess (`ACC`)** | `25%*` | Mean accuracy excess + ≥95th-percentile ceiling spikes calibrated per Elo band (`<800` to `2500+`) and speed (`Bullet`, `Blitz`, `Rapid`). *\*Dynamically redistributed if `<2` reviewed games exist.* |
| **3** | **PGN `[%clk]` Move Pacing (`PACE`)** | `18%` | Non-scramble middlegame (moves 9–38) Coefficient of Variation ($\text{CV} = \sigma/\mu$), absence of human `<1.8s` recaptures, `[2.3s, 8.8s]` mechanical band density, and mid-game engine launch pauses. |
| **4** | **Lifetime Glicko Deviation (`OWR`)** | `16%` | All-time format win-rate disequilibrium across total rated sample (`n / (n + 22)`). |
| **5** | **Elo Surge Velocity (`VEL`)** | `8%` | 7-day & 30-day vertical rating climb ($\Delta R$) damped by Glicko Rating Deviation (`RD`), plus consecutive rated win streaks. |
| **6** | **Account Trust & Smurf Prior (`TRUST`)** | `8%` | Account creation age (`joined`), high-Elo burner ratio, and massive Live-Elo vs. Tactics-Elo skill gaps (`Δ ≥ 900`). |

### Built-In Safeguards & Calibrations
- **Confirmed Fair-Play Bans (`100%`):** Accounts with `status: "closed:fair_play_violations"` immediately trigger a `100% BANNED` alert.
- **Verified FIDE Title Dampeners:** Official `GM`/`WGM` (`0.42×`), `IM`/`WIM` (`0.58×`), and `FM`/`NM`/`CM` (`0.78×`) accounts receive calibrated priors so elite masters are recognized accurately.
- **100% Fair-Play Compliant:** Strictly read-only public historical statistics. Never reads board FENs to suggest moves, never runs a chess engine, and collects **zero** user data.

---

<a id="-türkçe-dokümantasyon"></a>

## 🇹🇷 Türkçe Dokümantasyon

**Chess Sentinel**, Chess.com üzerinde maç başladığı anda rakibinizin **yüzde kaç olasılıkla hile / smurf olabileceğini (`%0 – %100`)** saniyeler içinde hesaplayan, ekranın sağ üstünde **cam efektli (glassmorphism) sürüklenebilir bir HUD Pop-up** ve **rakip isminin hemen yanında mini `%` rozeti** olarak gösteren yeni nesil açık kaynaklı Chrome eklentisidir.

### ✨ Öne Çıkan Özellikler
- **Eski Eklentilerin Neden Bozulduğunu Çözer:** Chess.com'un 2026 Web Component (`<cc-user-username-component>`) Shadow DOM yapısını, yeni `/game/{id}` ve `/play/online` SPA adreslerini kesintisiz algılar. Chrome'un engellediği `openPopup()` yerine doğrudan sayfa içi izole **Shadow-DOM HUD Pop-up** kullanır.
- **%clk Hamle Ritmi Analizi (Oyun İncelemesi Olmasa Bile Yakalar!):** Çoğu hilecinin maçlarında ücretli Game Review (CAPS2 doğruluk puanı) bulunmaz. Chess Sentinel, rakibin son maçlarının PGN kayıtlarındaki `0.1 sn` hassasiyetli `[%clk]` saat verilerini inceleyerek **robotik hamle sürelerini** (`CV ≤ 0.44`, sıfıra yakın anlık taş alma) ve **oyun ortası motor açma duraksamalarını** tespit eder.
- **Güvenli İptal (Abort) Penceresi Uyarısı:** Maçın ilk hamlelerinde rakip yüksek riskliyse HUD üzerinde anında uyarı vererek puan kaybetmeden maçı iptal (abort) etmenize yardımcı olur.
- **Şüpheli & Ban Takip Listesi (Watchlist):** Şüpheli rakipleri HUD üzerindeki `👁` ikonuyla listeye ekleyin. Eklenti arka planda bu hesapları kontrol eder ve Chess.com hesabı hileden kapattığında (`BANLANDI - HİLE`) size bildirir!
- **Tek Tıkla Çift Dil (`TR` / `EN`):** Hem sayfa içi HUD pop-up üzerinden hem de araç çubuğu menüsünden Türkçe ve İngilizce arasında anında geçiş yapabilirsiniz.

### 🚀 Kurulum (30 Saniye)
1. Sağ taraftaki [**Releases**](https://github.com/fatihmehmettezcan5-ops/chess-sentinel/releases/latest) bölümünden **`chess-sentinel-v1.0.1-chrome.zip`** dosyasını indirin ve klasöre çıkartın *(veya bu repoyu klonlayın; hazır derlenmiş `extension/` klasörü doğrudan içindedir)*.
2. Tarayıcınızda (Chrome, Brave, Edge, Opera) adres çubuğuna `chrome://extensions` yazıp açın.
3. Sağ üst köşedeki **Geliştirici modu (Developer mode)** anahtarını açın.
4. Sol üstteki **Paketlenmemiş öğe yükle (Load unpacked)** butonuna tıklayın ve çıkarttığınız klasörü (veya `extension` klasörünü) seçin.
5. [Chess.com](https://www.chess.com/play/online) üzerinde bir maça girin — HUD pop-up otomatik olarak açılacaktır! (`Alt + S` kısayolu ile istediğiniz an küçültüp büyütebilirsiniz.)

---

## ⌨️ Controls & Shortcuts

| Control | Action |
| :--- | :--- |
| **`Alt + S`** | Toggle / Minimize floating HUD pop-up on Chess.com |
| **Drag Header** | Reposition HUD anywhere on screen (automatically saved) |
| **`⇅` Button** | Swap analysis between Top Player (Opponent) and Bottom Player (Self) |
| **`👁` Button** | Add / remove player from the Fair-Play Ban Watchlist |
| **`TR / EN` Button** | Switch HUD & inline badge language instantaneously |

---

## 📄 License

Released under the [MIT License](./LICENSE). Not affiliated with or endorsed by Chess.com.
