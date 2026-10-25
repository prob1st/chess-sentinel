import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'extension');

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT_DIR, 'icons'), { recursive: true });

// 1. Copy static assets
fs.copyFileSync(path.join(ROOT, 'public', 'manifest.json'), path.join(OUT_DIR, 'manifest.json'));
fs.copyFileSync(path.join(ROOT, 'public', 'popup.html'), path.join(OUT_DIR, 'popup.html'));
fs.copyFileSync(path.join(ROOT, 'src', 'popup', 'popup.css'), path.join(OUT_DIR, 'popup.css'));
fs.cpSync(path.join(ROOT, 'public', '_locales'), path.join(OUT_DIR, '_locales'), { recursive: true });

for (const size of [16, 32, 48, 128]) {
  fs.copyFileSync(
    path.join(ROOT, 'public', 'icons', `icon${size}.png`),
    path.join(OUT_DIR, 'icons', `icon${size}.png`)
  );
}

// 2. Bundle Background Service Worker (ESM for MV3)
await esbuild.build({
  entryPoints: ['src/background/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'chrome116',
  minify: false,
  outfile: path.join(OUT_DIR, 'background.js'),
});

// 3. Bundle Content Script (IIFE for MV3 content_scripts)
await esbuild.build({
  entryPoints: ['src/content/index.ts'],
  bundle: true,
  format: 'iife',
  target: 'chrome116',
  minify: false,
  outfile: path.join(OUT_DIR, 'content.js'),
});

// 4. Bundle Toolbar Popup
await esbuild.build({
  entryPoints: ['src/popup/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'chrome116',
  minify: false,
  outfile: path.join(OUT_DIR, 'popup.js'),
});

// 5. Also bundle standalone browser engine+HUD for the interactive Live Demo playground
const DEMO_DIR = path.join(ROOT, 'demo');
fs.mkdirSync(DEMO_DIR, { recursive: true });
await esbuild.build({
  entryPoints: ['src/demo/entry.ts'],
  bundle: true,
  format: 'esm',
  target: 'chrome116',
  minify: false,
  outfile: path.join(DEMO_DIR, 'bundle.js'),
});

console.log('Successfully built unpacked Chrome Extension into ./extension/ and demo bundle.');
