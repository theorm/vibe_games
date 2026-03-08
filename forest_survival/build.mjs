import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const distDir = resolve('./dist');
mkdirSync(distDir, { recursive: true });

// Keep dist focused on build output by removing previous JS artifacts first.
for (const file of readdirSync(distDir)) {
  if (file.endsWith('.js')) rmSync(join(distDir, file));
}

const cmd = ['rolldown', 'src/main.ts', '--file', 'dist/bundle.js', '--format', 'iife'];
const result = spawnSync('npx', cmd, { stdio: 'inherit' });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const indexPath = resolve('./index.html');
const cacheBustToken = randomBytes(6).toString('hex');
const indexHtml = readFileSync(indexPath, 'utf8');
const nextIndexHtml = indexHtml.replace(
  /src="dist\/bundle\.js(?:\?[^"]*)?"/,
  `src="dist/bundle.js?v=${cacheBustToken}"`
);

if (nextIndexHtml !== indexHtml) {
  writeFileSync(indexPath, nextIndexHtml);
  console.log(`Cache bust updated — dist/bundle.js?v=${cacheBustToken}`);
} else {
  console.warn('Cache bust update skipped — dist/bundle.js script tag not found in index.html');
}

console.log('\nBuild OK — src/main.ts -> dist/bundle.js');
