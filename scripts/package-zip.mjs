import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const firefoxZipName = `chess-sentinel-v${pkg.version}-firefox.zip`;
const sourceZipName = `chess-sentinel-v${pkg.version}-source.zip`;

const firefoxZipPath = path.join(ROOT, firefoxZipName);
const sourceZipPath = path.join(ROOT, sourceZipName);

for (const p of [firefoxZipPath, sourceZipPath]) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// 1. Package Firefox Add-on (.zip with manifest.json at root)
execFileSync('zip', ['-r', '-q', firefoxZipPath, '.'], {
  cwd: path.join(ROOT, 'extension-firefox'),
});

// 2. Package clean Source Code Archive required by Mozilla AMO for TypeScript/esbuild projects
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

console.log(`Packaged Firefox Add-on: ${firefoxZipName}`);
console.log(`Packaged AMO Source Archive: ${sourceZipName}`);
