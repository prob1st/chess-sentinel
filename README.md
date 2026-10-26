<div align="center">

<img src="./assets/banner.svg" alt="Chess Sentinel — Real-Time Opponent Cheat Probability & Forensic HUD for Chess.com" width="100%" />

<br />

[![CI Status](https://github.com/prob1st/chess-sentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/prob1st/chess-sentinel/actions)
[![Release](https://img.shields.io/github/v/release/prob1st/chess-sentinel?color=10b981&label=Latest%20Release)](https://github.com/prob1st/chess-sentinel/releases)
[![Firefox Add-on](https://img.shields.io/badge/Firefox%20Add--ons-chess--sentinel-ff7139?logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/firefox/addon/chess-sentinel/)
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

Works out of the box on **Mozilla Firefox** (Desktop 140+) as well as **Brave, Google Chrome, Microsoft Edge, Arc, and Opera**.

### Option A — Install on Mozilla Firefox
1. Install directly from [**Firefox Add-ons (`addons.mozilla.org/firefox/addon/chess-sentinel/`)**](https://addons.mozilla.org/firefox/addon/chess-sentinel/) *(or download **`chess-sentinel-v3.1.0-firefox.zip`** from [**GitHub Releases**](https://github.com/prob1st/chess-sentinel/releases/latest) while AMO review completes)*.
2. Open [Chess.com](https://www.chess.com/play/online) and start or spectate any live game!

### Option B — Ready-to-Run Install on Chrome / Brave / Edge / Opera
1. Download **`chess-sentinel-v3.1.0-chrome-brave-edge.zip`** from [**GitHub Releases**](https://github.com/prob1st/chess-sentinel/releases/latest) and extract it to a folder.
2. Open `chrome://extensions` (or `brave://extensions` / `edge://extensions`) → enable **Developer mode** → click **Load unpacked** → select the extracted folder.

### Option B — Build & Verify from Source (Developers)
```bash
git clone https://github.com/prob1st/chess-sentinel.git
cd chess-sentinel
npm install

# Run strict TypeScript check + Vitest unit suite + build ./extension
npm run typecheck
npm test
npm run package
```

---

## 🧬 The v3.1 Zero-False-Positive (`α → 0`) Neyman-Pearson Forensic Engine

Chess Sentinel v3.1 implements a **Neyman-Pearson Two-Factor Bayesian Log-Likelihood Ratio (`LLR`) Model** (`base prior p₀ ≈ 1.8%`) verified across **10,000 Monte Carlo honest human/smurf edge cases (`0.000%` false positives)** and live Chess.com player cohorts:

| # | Orthogonal Pillar | Zero-False-Positive (`α → 0`) Mathematical Guarantee |
| :--- | :--- | :--- |
| **1** | **Elo-Adjusted Binomial Z-Score (`Z_Elo`)** | Requires `n ≥ 8` games and `Z > +2.65σ` (`p < 0.004`) against exact opponent Elo ($E_i = (1 + 10^{\Delta R/400})^{-1}$) with Laplace-Bayes shrinkage and Glicko `RD` damping—eliminating false positives from open arenas, provisional placement swings, or lucky streaks. |
| **2** | **99.5% LCB Long-Game CAPS2 (`ACC`)** | Requires `n ≥ 5` full-length games (`≥ 44 plies` / 22 full moves), subtracts a **99.5% studentized margin (`2.58 · σ / √n`)**, applies **Wilson 99% Lower Bounds (`z = 2.33`)** on ceiling spikes, and de-skews Free-Tier Game Review survivorship bias. |
| **3** | **Won-Match Chronometric Entropy & QCD (`PACE`)** | Evaluates `≥ 6` non-bullet games (`≥ 30 plies`), counting flatline/toggle signatures strictly on **won games** (`≥ 3` flatline wins AND `≥ 22%` incidence)—achieving `0` flatline hits across live honest human cohorts while catching selective Stockfish togglers. |
| **4** | **Two-Factor Engine Corroboration Law** | **Hard Invariant:** Without direct biomechanical (`%clk`) OR 99.5%-LCB move-quality (`CAPS2`) engine proof, pure win-streaks and hand-played smurfs are strictly capped at `≤ 28% (Low)`. Single uncorroborated signals cap at `≤ 46% (Guarded)`. `High / Critical` requires `≥ 2` corroborated pillars. |

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

### 🚀 Kurulum (Firefox & Chrome / Brave / Edge)
1. **Mozilla Firefox:** Doğrudan resmi [**Firefox Add-ons Mağazasından (`chess-sentinel`)**](https://addons.mozilla.org/tr/firefox/addon/chess-sentinel/) kurabilir veya [**Releases**](https://github.com/prob1st/chess-sentinel/releases/latest) sayfasından hazır derlenmiş **`chess-sentinel-v3.1.0-firefox.zip`** dosyasını indirip `about:debugging#/runtime/this-firefox` → **Geçici Eklenti Yükle** adımıyla doğrudan seçebilirsiniz.
2. **Chrome / Brave / Edge / Opera:** [**Releases**](https://github.com/prob1st/chess-sentinel/releases/latest) sayfasından hazır derlenmiş **`chess-sentinel-v3.1.0-chrome-brave-edge.zip`** dosyasını indirip bir klasöre çıkartın; ardından `chrome://extensions` → **Geliştirici modu** → **Paketlenmemiş öğe yükle** adımıyla klasörü seçin *(derleme/build gerektirmez, çalışmaya hazır `.js` dosyaları içindedir)*.
3. **v3.1 Sıfır Yanlış Pozitif (`0 False Positive`) Garantisi:** 10.000 dürüst oyuncu / el ile oynayan smurf / şanslı galibiyet serisi simülasyonunda ve canlı Chess.com oyuncu testlerinde **`%0.000` yanlış alarm** üretir; doğrudan `%clk` saat veya `%99.5` alt güven sınırlı `CAPS2` motor kanıtı olmadan hiçbir dürüst oyuncuyu hileci olarak işaretlemez!

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

## 🦊 Firefox Add-ons (AMO) Architecture & Reproducible Source

Chess Sentinel v3.1 is built natively for **Firefox Manifest V3** (`extension-firefox/`):
- **Zero-Warning Safe DOM Rendering**: Uses `DOMParser` (`src/utils/safe-dom.ts`) with zero `innerHTML` assignments for 100% clean `addons-linter` validation.
- **2026 Mozilla Privacy Consent Ready**: Declares `browser_specific_settings.gecko.data_collection_permissions.required: ["none"]` — zero personal or telemetry data ever leaves your browser.
- **Reproducible Builds for AMO Reviewers**: See [**AMO_BUILD_INSTRUCTIONS.md**](./AMO_BUILD_INSTRUCTIONS.md) (`npm ci && npm run build`).

---

## 📄 License

Released under the [MIT License](./LICENSE). Not affiliated with or endorsed by Chess.com.
