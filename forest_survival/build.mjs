import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
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

console.log('\nBuild OK — src/main.ts -> dist/bundle.js');
