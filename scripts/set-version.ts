// Writes a version into every app's package.json (desktop installers, extension manifest, web, site).
// Usage: node scripts/set-version.ts 1.2.3[-alpha.4]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APPS = ['desktop', 'extension', 'web', 'site'];
const version = process.argv[2] ?? '';
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Not a SemVer version: "${version}"`);
  process.exit(1);
}
for (const app of APPS) {
  const file = join(import.meta.dirname, '..', 'apps', app, 'package.json');
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...pkg, version }, null, 2)}\n`);
  console.log(`apps/${app}: ${version}`);
}
