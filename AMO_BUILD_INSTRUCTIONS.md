# Mozilla Add-ons (AMO) Reproducible Build Instructions - Chess Sentinel v4.1.0

This document provides exact step-by-step instructions for Mozilla Add-ons reviewers to reproduce the submitted Firefox extension package (`chess-sentinel-v4.1.0-firefox.zip`) from TypeScript source code.

## Build Environment
- **Operating System:** Linux (Ubuntu 22.04 / 24.04 x86_64) or macOS / Windows
- **Node.js:** `v20.x` or `v22.x` LTS (with `npm 10.x`)
- **Bundler:** `esbuild` `^0.24.2` (`minify: false` - human-readable unminified output)

## Exact Build Steps

```bash
# 1. Install exact locked dependencies from package-lock.json
npm ci

# 2. (Optional) Verify strict TypeScript types and run the Vitest test suite
npm run typecheck
npm test

# 3. Build the Firefox Manifest V3 extension into ./extension-firefox/
npm run build
```

## Output Directory
The complete unpacked Firefox extension is generated inside:
- **`./extension-firefox/`**
  - `manifest.json` (copied from `public/manifest.firefox.json`)
  - `background.js` (bundled from `src/background/index.ts`, unminified)
  - `content.js` (bundled from `src/content/index.ts`, unminified)
  - `popup.js` (bundled from `src/popup/index.ts`, unminified)
  - `popup.html`, `popup.css`, `_locales/`, `icons/`

## Privacy & Network Behavior
- **Zero personal data collection:** Declared via `browser_specific_settings.gecko.data_collection_permissions.required: ["none"]`.
- **No remote code, analytics, or external servers:** Only makes read-only `GET` requests to Chess.com's public endpoints (`https://api.chess.com/pub/...` and `https://www.chess.com/callback/live/game/...`).
