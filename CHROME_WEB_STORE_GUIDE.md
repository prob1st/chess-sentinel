# Chrome Web Store Yayınlama Kılavuzu / Submission Guide (`v2.0.1`)

Bu depo, **Google Chrome Web Store (CWS)** incelemesinden **ilk seferde onay alacak** şekilde eksiksiz hazırlanmıştır:
- **Manifest V3 (`v2.0.1`)**: Daraltılmış açık `host_permissions` (`www.chess.com`, `chess.com`, `api.chess.com`), çoklu dil desteği (`_locales/en` & `_locales/tr`, 132 karakter sınırına tam uyumlu) ve sıfır uzak kod (`Remote Code = No`).
- **Hazır Mağaza Görselleri (`store-assets/`)**: Google'ın zorunlu tuttuğu **24-bit RGB (alfa kanalsız / no-alpha)** formatında milimetrik boyutlandırılmış `1280x800` ekran görüntüleri, `440x280` küçük tanıtım kartı ve `1400x560` geniş vitrin görseli.
- **Hazır Gizlilik Politikası & İzin Gerekçeleri**: Aşağıdaki kutucuklardan doğrudan **Kopyala-Yapıştır** yaparak 3 dakikada başvuruyu tamamlayabilirsiniz.

---

## Adım 1: Google Geliştirici Hesabı Açılışı (Tek Seferlik)

Google güvenlik kuralları gereği eklentiler yalnızca kişisel **Google Developer Console** hesabınız üzerinden yayınlanabilir:
1. **[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)** adresine Google hesabınızla giriş yapın.
2. Tek seferlik **$5 USD** geliştirici kayıt ücretini ödeyin ve Google hesabınızda **2 Adımlı Doğrulama (2FA)** açık olduğundan emin olun.
3. Sağ üstteki **"New Item" (Yeni Öğe)** butonuna tıklayın ve **`chess-sentinel-v2.0.1-chrome.zip`** dosyasını sürükleyip bırakın.

---

## Adım 2: "Store Listing" (Mağaza Kaydı) Sekmesi — Kopyala & Yapıştır

### Kategori & Dil
- **Category (Kategori):** `Fun` (Eğlence) veya `Tools` (Araçlar)
- **Language (Dil):** Varsayılan `English` otomatik gelir; ek olarak `Türkçe` dilini de ekleyebilirsiniz.

### İngilizce Detaylı Açıklama (English Description — Copy & Paste)
```text
Chess Sentinel displays a real-time, non-intrusive Fair-Play Telemetry HUD on Chess.com showing your opponent's statistical cheat probability (0%–100%) within 2 seconds of game start.

Designed with a v2.0 Multi-Pillar Bayesian Log-Odds Engine, Chess Sentinel catches mechanical engine assistance while keeping false positives near zero on legitimate human streaks, club veterans, and FIDE titled players.

KEY FEATURES:
• Live In-Game Floating HUD & Inline % Badge: Automatically detects your live opponent on Chess.com (Bullet, Blitz, Rapid, Daily), including board flips and Shadow DOM web components.
• Chronometric PGN [%clk] Entropy & QCD Analysis: Measures move-time Shannon Entropy (bits) and Quartile Coefficient of Dispersion (QCD) to distinguish organic human premoves/deep thinks from flatline 3–6s engine relay pacing.
• Elo-Adjusted Performance Z-Score: Evaluates every recent win, draw, and loss against exact opponent Elo expectations rather than naive raw win rates.
• Survivorship-Bias-Adjusted CAPS2 Accuracy: Filters miniature openings (<15 moves) and discounts sparse Game Review samples so free-tier players reviewing only their best wins are never falsely flagged.
• Suspect & Fair-Play Ban Watchlist: Track suspicious opponents locally and automatically get notified when Chess.com closes an account for fair_play_violations.
• 1-Click Bilingual UI: Instant English (EN) and Turkish (TR) interface switching.
• 100% Local & Private: Uses only Chess.com's official read-only public API (api.chess.com/pub). Zero analytics, zero tracking, zero external servers.

Disclaimer: Chess Sentinel is an independent open-source statistical tool and is not affiliated with or endorsed by Chess.com. Probability scores represent statistical telemetry, not definitive proof of rule violations.
```

### Türkçe Detaylı Açıklama (Turkish Description — Kopyala & Yapıştır)
```text
Chess Sentinel, Chess.com canlı maçlarınızda rakibinizin istatistiksel hile olasılığını (%0–%100) maç başlar başlamaz 2 saniye içinde gösteren gerçek zamanlı bir Adil Oyun (Fair-Play) analiz arayüzüdür (HUD).

v2.0 Bayesyen Log-Odds Motoru sayesinde gerçek insan galibiyet serilerini, ücretsiz maç analizi (Game Review) önyargısını ve FIDE unvanlı ustaları korurken mekanik motor (Stockfish) destekli profilleri yüksek isabetle yakalar.

ÖNE ÇIKAN ÖZELLİKLER:
• Canlı Maç İçi Yüzen HUD ve Mini % Rozeti: Bullet, Blitz, Rapid ve Günlük maçlarda rakibi (tahta çevrilse bile) otomatik algılar; güvenli iptal (abort) penceresinde uyarır.
• Kronometrik PGN [%clk] Shannon Entropisi & QCD: Hamle sürelerinin biyomekanik dağılımını ölçerek doğal insan düşüncesini robotik 3–6 saniyelik motor aktarım temposundan ayırır.
• Rakip Elo'suna Göre Z-Skoru: Ham kazanma oranı yerine her maçı rakibin gerçek Elo beklentisine göre standart sapma (sigma) cinsinden değerlendirir.
• Önyargı Korumalı Uzun Maç CAPS2 Analizi: 15 hamleden kısa minyatürleri filtreler; yalnızca kazandığı maçları analiz ettiren ücretsiz üyeleri yanlış pozitiften korur.
• Şüpheli ve Ban Takip Listesi: Şüphelendiğiniz rakipleri kaydedin; Chess.com hesabı adil oyun ihlalinden (fair_play_violations) kapattığında otomatik bildirim alın.
• Tek Tıkla Türkçe / İngilizce (TR / EN) Arayüz.
• %100 Yerel ve Gizli: Yalnızca resmi açık Chess.com PubAPI kullanılır. Hiçbir veri toplanmaz veya üçüncü taraf sunuculara gönderilmez.

Yasal Uyarı: Chess Sentinel bağımsız ve açık kaynaklı bir istatistiksel analiz aracıdır; Chess.com ile resmi bir bağlantısı yoktur.
```

### Görseller (`store-assets/` Klasöründen Yükleyin)
| Alan | Yüklenecek Dosya | Boyut & Format |
| :--- | :--- | :--- |
| **Store Icon** | `store-assets/store-icon-128x128.png` | `128x128` PNG |
| **Screenshot 1** | `store-assets/screenshot-1-live-hud-1280x800.png` | `1280x800` 24-bit RGB PNG |
| **Screenshot 2** | `store-assets/screenshot-2-false-positive-shield-1280x800.png` | `1280x800` 24-bit RGB PNG |
| **Screenshot 3** | `store-assets/screenshot-3-popup-watchlist-1280x800.png` | `1280x800` 24-bit RGB PNG |
| **Small Promo Tile** | `store-assets/promo-small-440x280.png` | `440x280` 24-bit RGB PNG |
| **Marquee Promo Tile** | `store-assets/promo-marquee-1400x560.png` | `1400x560` 24-bit RGB PNG |

### Ek URL Alanları
- **Homepage URL:** `https://github.com/prob1st/chess-sentinel`
- **Support URL:** `https://github.com/prob1st/chess-sentinel/issues`

---

## Adım 3: "Privacy Practices" (Gizlilik Uygulamaları) Sekmesi — Kopyala & Yapıştır

Google inceleme ekibi bu sekmeyi çok dikkatli kontrol eder. Aşağıdaki yanıtları birebir yapıştırın:

### 1. Single Purpose Description (Tek Amaç Açıklaması)
```text
Displays real-time statistical fair-play telemetry and historical game performance indicators for public opponent profiles on Chess.com using Chess.com's official read-only public API.
```

### 2. Permission Justifications (İzin Gerekçeleri)

- **`storage` justification:**
```text
Stores the user's local UI preferences (language TR/EN, HUD coordinates, compact mode), short-lived local cache of public Chess.com API responses to minimize network requests, and the user's local suspect watchlist exclusively in chrome.storage.local on the user's device.
```

- **`alarms` justification:**
```text
Schedules a lightweight 30-minute periodic background check in the Manifest V3 service worker to refresh public account status for usernames saved in the user's local watchlist.
```

- **`Host permission` (`chess.com`, `www.chess.com`, `api.chess.com`) justification:**
```text
Required to render the in-game opponent telemetry HUD on Chess.com game pages (https://www.chess.com/* and https://chess.com/*) and fetch read-only public player profiles, ratings, and PGN game archives from Chess.com's official public API (https://api.chess.com/*).
```

### 3. Remote Code (Uzak Kod Kullanımı)
- **Are you using remote code?** → **`No, I am not using Remote code`** seçeneğini işaretleyin. *(Tüm kodlar derlenmiş paket içindedir; harici script yüklenmez.)*

### 4. Data Usage (Veri Kullanımı) & Sertifikasyon
- Hiçbir kişisel veri kutucuğunu **işaretlemeyin** (uzantı hiçbir kullanıcı verisi toplamaz).
- Üç onay kutusunu (**Certify compliance with Chrome Web Store Developer Program Policies**) işaretleyin.
- **Privacy Policy URL (Gizlilik Politikası Bağlantısı):**
```text
https://github.com/prob1st/chess-sentinel/blob/main/PRIVACY.md
```

---

## Adım 4: Gönderim & İnceleme Süresi
1. Sağ üstteki **"Save Draft"** ve ardından **"Submit for Review"** butonuna tıklayın.
2. Uzantı hiçbir geniş `<all_urls>` izni istemediği ve uzak kod barındırmadığı için Google incelemesi genellikle **24–72 saat** içinde onaylanır!

---

## Opsiyonel: GitHub Actions ile Otomatik Chrome Web Store Güncellemesi

İlk sürümü mağazaya yükleyip bir **Extension ID** aldıktan sonra sonraki sürümleri (`v2.0.2`, `v2.1.0` vb.) tek komutla otomatik yayınlamak isterseniz GitHub deponuzun **Settings → Secrets and variables → Actions** bölümüne şu 4 anahtarı ekleyebilirsiniz:
- `CWS_EXTENSION_ID`
- `CWS_CLIENT_ID`
- `CWS_CLIENT_SECRET`
- `CWS_REFRESH_TOKEN`

Hazırladığımız `.github/workflows/chrome-web-store.yml` iş akışı bu anahtarları algıladığında her yeni `v*` etiketinde mağaza paketini otomatik olarak güncelleyecektir.
