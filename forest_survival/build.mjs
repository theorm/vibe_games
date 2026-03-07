// Compile all src/*.ts → dist/*.js using @oxc-node/core
import { transform } from '@oxc-node/core';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const srcDir  = resolve('./src');
const distDir = resolve('./dist');

mkdirSync(distDir, { recursive: true });

const files = readdirSync(srcDir).filter(f => f.endsWith('.ts'));
let errors = 0;

for (const file of files) {
  const srcPath = join(srcDir, file);
  const outPath = join(distDir, file.replace(/\.ts$/, '.js'));
  try {
    const source = readFileSync(srcPath);
    const result = transform(srcPath, source);
    writeFileSync(outPath, result.source());
    console.log(`  compiled: src/${file} → dist/${file.replace(/\.ts$/, '.js')}`);
  } catch (err) {
    console.error(`  ERROR: ${file}:`, err.message);
    errors++;
  }
}

if (errors) {
  console.error(`\nBuild finished with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log(`\nBuild OK — ${files.length} file(s) compiled.`);
}
