import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const zipName = `chess-sentinel-v${pkg.version}-chrome.zip`;
const zipPath = path.join(ROOT, zipName);

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

execFileSync('zip', ['-r', '-q', zipPath, '.'], {
  cwd: path.join(ROOT, 'extension'),
});

console.log(`Packaged release archive: ${zipName}`);
