import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const chromeZipName = `chess-sentinel-v${pkg.version}-chrome-brave-edge.zip`;
const firefoxZipName = `chess-sentinel-v${pkg.version}-firefox.zip`;
const sourceZipName = `chess-sentinel-v${pkg.version}-source.zip`;

const chromeZipPath = path.join(ROOT, chromeZipName);
const firefoxZipPath = path.join(ROOT, firefoxZipName);
const sourceZipPath = path.join(ROOT, sourceZipName);

for (const p of [chromeZipPath, firefoxZipPath, sourceZipPath]) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// 1. Package ready-to-run Chromium Extension (Chrome, Brave, Edge, Opera, Vivaldi)
execFileSync('zip', ['-r', '-q', chromeZipPath, '.'], {
  cwd: path.join(ROOT, 'extension'),
});

// 2. Package ready-to-run Firefox Add-on (.zip with manifest.json + compiled JS at root)
execFileSync('zip', ['-r', '-q', firefoxZipPath, '.'], {
  cwd: path.join(ROOT, 'extension-firefox'),
});

// 3. Package clean Source Code Archive required by Mozilla AMO reviewers for TypeScript/esbuild
execFileSync(
  'zip',
  [
    '-r',
    '-q',
    sourceZipPath,
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'AMO_BUILD_INSTRUCTIONS.md',
    'README.md',
    'PRIVACY.md',
    'LICENSE',
    'public',
    'src',
    'scripts',
    'tests',
  ],
  { cwd: ROOT }
);

console.log(`Packaged Chromium Extension (Ready-to-Run): ${chromeZipName}`);
console.log(`Packaged Firefox Add-on (Ready-to-Run):    ${firefoxZipName}`);
console.log(`Packaged AMO Source Archive (Reviewers):   ${sourceZipName}`);
