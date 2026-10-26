import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_CHROME = path.join(ROOT, 'extension');
const OUT_FIREFOX = path.join(ROOT, 'extension-firefox');

for (const dir of [OUT_CHROME, OUT_FIREFOX]) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'icons'), { recursive: true });
}

// 1. Copy static assets for Chromium unpacked & Firefox AMO builds
fs.copyFileSync(path.join(ROOT, 'public', 'manifest.json'), path.join(OUT_CHROME, 'manifest.json'));
fs.copyFileSync(
  path.join(ROOT, 'public', 'manifest.firefox.json'),
  path.join(OUT_FIREFOX, 'manifest.json')
);

for (const dir of [OUT_CHROME, OUT_FIREFOX]) {
  fs.copyFileSync(path.join(ROOT, 'public', 'popup.html'), path.join(dir, 'popup.html'));
  fs.copyFileSync(path.join(ROOT, 'src', 'popup', 'popup.css'), path.join(dir, 'popup.css'));
  fs.cpSync(path.join(ROOT, 'public', '_locales'), path.join(dir, '_locales'), { recursive: true });

  for (const size of [16, 32, 48, 128]) {
    fs.copyFileSync(
      path.join(ROOT, 'public', 'icons', `icon${size}.png`),
      path.join(dir, 'icons', `icon${size}.png`)
    );
  }
}

// 2. Bundle Background Worker (unminified ESM for Firefox MV3 & Chromium MV3)
for (const dir of [OUT_CHROME, OUT_FIREFOX]) {
  await esbuild.build({
    entryPoints: ['src/background/index.ts'],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: false,
    outfile: path.join(dir, 'background.js'),
  });

  // 3. Bundle Content Script (IIFE for content_scripts)
  await esbuild.build({
    entryPoints: ['src/content/index.ts'],
    bundle: true,
    format: 'iife',
    target: 'es2022',
    minify: false,
    outfile: path.join(dir, 'content.js'),
  });

  // 4. Bundle Toolbar Popup
  await esbuild.build({
    entryPoints: ['src/popup/index.ts'],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: false,
    outfile: path.join(dir, 'popup.js'),
  });
}

// 5. Standalone bundle for the interactive Live Demo playground
const DEMO_DIR = path.join(ROOT, 'demo');
fs.mkdirSync(DEMO_DIR, { recursive: true });
await esbuild.build({
  entryPoints: ['src/demo/entry.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: false,
  outfile: path.join(DEMO_DIR, 'bundle.js'),
});

console.log('Successfully built ./extension-firefox/ (AMO MV3), ./extension/ (Chromium), and demo bundle.');
