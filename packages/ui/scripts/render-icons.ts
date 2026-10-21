// Renders src/brand/icon.svg (Claude Design "1d Target, dark") to the PNG sizes each app ships.
// Usage: pnpm icons
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = join(import.meta.dirname, '../../..');
const source = join(import.meta.dirname, '../src/brand/icon.svg');
const svg = readFileSync(source, 'utf8');
const TARGETS: [string, number][] = [
  ['apps/desktop/build/icon.png', 1024],
  ...[16, 32, 48, 128].map((s): [string, number] => [`apps/extension/public/icon/${s}.png`, s]),
  ['apps/web/public/icon-192.png', 192],
  ['apps/web/public/icon-512.png', 512],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size] of TARGETS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  const out = join(ROOT, file);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: true });
  console.log(`${file} (${size}px)`);
}
await browser.close();
copyFileSync(source, join(ROOT, 'apps/web/public/favicon.svg'));
console.log('apps/web/public/favicon.svg');
