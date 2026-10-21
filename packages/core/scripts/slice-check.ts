// Converts fixtures for each target and slices them with the real slicer CLIs; the G-code header must show the
// values the converted project carries. Usage: node packages/core/scripts/slice-check.ts [--quick]
// Slicer binaries: ORCA_CLI, BAMBU_CLI, FLASHSTUDIO_CLI (default: the macOS app bundles). Missing ones are skipped.
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { convert, PRINTERS, type SlicerId } from '../src/index.ts';
import { bambuProject } from '../test/fixtures.ts';

const MAC_APPS: Record<SlicerId, string> = {
  orca: '/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer',
  bambustudio: '/Applications/BambuStudio.app/Contents/MacOS/BambuStudio',
  flashstudio: '/Applications/Flash Studio.app/Contents/MacOS/Flash Studio',
  crealityprint: '/Applications/CrealityPrint.app/Contents/MacOS/CrealityPrint',
};
const ENV: Record<SlicerId, string> = { orca: 'ORCA_CLI', bambustudio: 'BAMBU_CLI', flashstudio: 'FLASHSTUDIO_CLI', crealityprint: 'CREALITY_CLI' };
const SLICE_TIMEOUT_MS = 10 * 60_000;
const PARALLEL = Number(process.env.SLICE_PARALLEL) || 3;
// Values every slicer writes into the G-code config block, compared with what the converted project holds.
const CHECKED_KEYS = ['printer_settings_id', 'print_settings_id', 'layer_height', 'wall_loops', 'sparse_infill_density', 'filament_type', 'nozzle_temperature', 'enable_prime_tower'];

const fixture = (path: string) => new Uint8Array(readFileSync(new URL(`../test/fixtures/${path}`, import.meta.url)));
const FIXTURES: Record<string, () => Uint8Array> = {
  'bambu-cube': () => bambuProject(),
  'prusa-wipe-tower': () => fixture('prusa/wipe_tower.3mf'),
  'creality-multicolor': () => fixture('creality/creality-print-7-multicolor.3mf'),
  'prusa-roundtrip': () => fixture('prusa/fdm_roundtrip1.3mf'),
};
const quick = process.argv.includes('--quick');
// Every printer with the small cube; the heavier fixtures on one printer of each kind.
const REPRESENTATIVE = ['ad5x-0.4', 'adventurer-5m-pro-0.4', 'creator-5-0.4', 'bambu-a1-mini-0.4', 'bambu-x1c-0.4', 'creality-k2-plus-0.4', 'anycubic-kobra-s1-0.4', 'prusa-mk4s-0.4', 'elegoo-centauri-carbon-0.4'];

interface Case { fixture: string; printer: string; slicer: SlicerId }
function cases(available: SlicerId[]): Case[] {
  const out: Case[] = [];
  for (const p of PRINTERS) {
    for (const slicer of p.slicers.filter((s) => available.includes(s))) {
      out.push({ fixture: 'bambu-cube', printer: p.id, slicer });
      if (quick || !REPRESENTATIVE.includes(p.id)) continue;
      out.push({ fixture: 'prusa-wipe-tower', printer: p.id, slicer }, { fixture: 'creality-multicolor', printer: p.id, slicer });
      if (p.id === 'bambu-x1c-0.4' || p.id === 'ad5x-0.4') out.push({ fixture: 'prusa-roundtrip', printer: p.id, slicer });
    }
  }
  return out;
}

const norm = (v: string | readonly string[] | undefined) =>
  (typeof v === 'string' ? v.split(/[;,]/) : [...(v ?? [])]).map((x) => x.trim().replace(/^"|"$/g, '').replace(/%$/, '')).map((x) => (/^-?\d+(\.\d+)?$/.test(x) ? String(Number(x)) : x));

function gcodeConfig(gcode: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of gcode.matchAll(/^; ([a-z0-9_]+) = (.*)$/gm)) out[m[1]!] = m[2]!;
  return out;
}

function run(bin: string, args: string[], cwd: string): Promise<{ code: number; log: string }> {
  return new Promise((resolve) => {
    execFile(bin, args, { cwd, timeout: SLICE_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : -1) : 0, log: `${stdout}\n${stderr}` }));
  });
}

async function check(c: Case, bin: string, root: string): Promise<string[]> {
  const { output } = await convert(FIXTURES[c.fixture]!(), { printer: c.printer as never, slicer: c.slicer });
  const dir = join(root, `${c.fixture}-${c.printer}-${c.slicer}`);
  mkdirSync(dir, { recursive: true });
  const input = join(dir, 'project.3mf');
  writeFileSync(input, output);
  const project = JSON.parse(strFromU8(unzipSync(output)['Metadata/project_settings.config']!)) as Record<string, string | string[]>;
  // The slicer's working directory is the case folder: some profiles make it write files relative to it.
  const { code, log } = await run(bin, ['--slice', '0', '--outputdir', dir, input], dir);
  writeFileSync(join(dir, 'slicer.log'), log);
  const gcodes = readdirSync(dir).filter((f) => f.endsWith('.gcode'));
  if (code !== 0 || gcodes.length === 0) {
    const tail = log.trim().split('\n').slice(-6).map((l) => `  | ${l.slice(0, 200)}`);
    return [`slicer exit ${code}, ${gcodes.length} G-code file(s); log ${dir}/slicer.log ends with:`, ...tail];
  }
  const header = gcodeConfig(readFileSync(join(dir, gcodes[0]!), 'utf8'));
  return CHECKED_KEYS.flatMap((k) => {
    if (project[k] === undefined) return [];
    const [want, got] = [norm(project[k]), norm(header[k])];
    return JSON.stringify(want) === JSON.stringify(got) ? [] : [`${k}: project ${want.join(';')} ≠ G-code ${got.join(';') || '(missing)'}`];
  });
}

const available = (Object.keys(MAC_APPS) as SlicerId[]).filter((s) => existsSync(process.env[ENV[s]] ?? MAC_APPS[s]));
const all = cases(available);
const root = mkdtempSync(join(tmpdir(), 'slice-check-'));
console.log(`Slicers: ${available.join(', ') || 'none'} · ${all.length} case(s) · output in ${root}`);
let failed = 0;
const queue = [...all];
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  for (let c = queue.shift(); c; c = queue.shift()) {
    const label = `${c.fixture} → ${c.printer} (${c.slicer})`;
    const problems = await check(c, process.env[ENV[c.slicer]] ?? MAC_APPS[c.slicer], root).catch((e: Error) => [`conversion failed: ${e.message}`]);
    if (problems.length) failed++;
    console.log(`${problems.length ? '✗' : '✓'} ${label}${problems.map((p) => `\n    ${p}`).join('')}`);
  }
}));
console.log(`${all.length - failed}/${all.length} passed`);
if (available.length === 0 || failed) process.exit(1);
