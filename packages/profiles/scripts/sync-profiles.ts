// Generates src/generated/*.json from pinned slicer checkouts.
// Usage: node packages/profiles/scripts/sync-profiles.ts [--orca <dir>] [--flashstudio <dir>]
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRINTERS } from '../src/printers.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = join(ROOT, 'packages/profiles/src/generated');
const PRESET_TYPES = ['machine', 'process', 'filament'] as const;
type PresetType = (typeof PRESET_TYPES)[number];
type Json = Record<string, unknown>;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

function gitInfo(dir: string): { tag: string; commit: string } {
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim();
  return { tag: git('describe', '--tags', '--always'), commit: git('rev-parse', 'HEAD') };
}

function indexPresets(profilesDir: string, vendors: string[]): Map<string, Json> {
  const idx = new Map<string, Json>();
  // The preset type is the first directory under the vendor (filament/<brand>/x.json is still a filament).
  const walk = (dir: string, type: string | undefined): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p, type ?? e.name); continue; }
      if (!e.name.endsWith('.json') || !type) continue;
      const json = JSON.parse(readFileSync(p, 'utf8')) as Json;
      if (typeof json.name !== 'string' || !PRESET_TYPES.includes(type as PresetType)) continue;
      const key = `${type}|${json.name}`;
      if (!idx.has(key)) idx.set(key, json);
    }
  };
  for (const v of vendors) walk(join(profilesDir, v), undefined);
  return idx;
}

function flatten(idx: Map<string, Json>, type: PresetType, name: string): Json {
  const chain: Json[] = [];
  for (let cur = idx.get(`${type}|${name}`); cur; ) {
    chain.unshift(cur);
    const parent = cur.inherits;
    if (typeof parent !== 'string' || !parent) break;
    cur = idx.get(`${type}|${parent}`);
    if (!cur) throw new Error(`${type} "${name}": missing parent "${parent}"`);
  }
  if (chain.length === 0) throw new Error(`${type} "${name}" not found`);
  const flat = Object.assign({}, ...chain) as Json;
  flat.inherits = chain.at(-1)!.inherits ?? '';
  return flat;
}

function compatibleWith(idx: Map<string, Json>, type: PresetType, machine: string): string[] {
  const names: string[] = [];
  for (const [key, json] of idx) {
    if (!key.startsWith(`${type}|`) || json.instantiation !== 'true') continue;
    // compatible_printers is often inherited from a hidden base preset.
    const list = flatten(idx, type, json.name as string).compatible_printers;
    if (Array.isArray(list) && list.includes(machine)) names.push(json.name as string);
  }
  return names.sort();
}

interface OptionInfo { type: string; nullable: boolean; min?: number; max?: number; default?: string }

// First element of `set_default_value(new ConfigOptionXs { a, b })`, as the string a project file would hold.
function defaultValue(body: string): string | undefined {
  const m = body.match(/set_default_value\(\s*new ConfigOption\w+\s*[({]\s*([^)}]*)[)}]/);
  if (!m) return undefined;
  const first = m[1]!.split(',')[0]!.trim();
  if (first === 'true' || first === 'false') return first === 'true' ? '1' : '0';
  if (/^"/.test(first)) return first.replace(/^"|"$/g, '');
  if (/^-?[\d.]+(e-?\d+)?f?$/.test(first)) return String(Number(first.replace(/f$/, '')));
  return undefined;
}

// `this->add("key", coType)` / `add_nullable(...)` followed by `def->min = x;`; loop-generated keys are not covered.
function extractOptions(printConfigCpp: string): Record<string, OptionInfo> {
  const src = readFileSync(printConfigCpp, 'utf8');
  const matches = [...src.matchAll(/\badd(_nullable)?\("([a-z0-9_]+)",\s*(co[A-Za-z]+)\)/g)];
  const out: Record<string, OptionInfo> = {};
  matches.forEach((m, i) => {
    if (out[m[2]!]) return;
    const body = src.slice(m.index, matches[i + 1]?.index ?? src.length);
    const num = (field: string) => body.match(new RegExp(`def->${field}\\s*=\\s*(-?[\\d.]+)`))?.[1];
    const min = num('min');
    const max = num('max');
    const def = defaultValue(body);
    out[m[2]!] = { type: m[3]!, nullable: Boolean(m[1]), ...(min && { min: Number(min) }), ...(max && { max: Number(max) }), ...(def !== undefined && { default: def }) };
  });
  return out;
}

const orcaDir = arg('--orca', join(ROOT, 'research/OrcaSlicer-v2.4.2'));
const ffDir = arg('--flashstudio', join(ROOT, 'research/Orca-Flashforge'));
const orcaIdx = indexPresets(join(orcaDir, 'resources/profiles'), ['Flashforge', 'OrcaFilamentLibrary']);
const ffIdx = indexPresets(join(ffDir, 'resources/profiles'), ['Flashforge', 'OrcaFilamentLibrary']);

const machines: Record<string, Json> = {};
const processes: Record<string, Json> = {};
const filaments: Record<string, Json> = {};
const compat: Record<string, { processes: string[]; filaments: string[]; flashStudioFilaments: string[] }> = {};

for (const printer of PRINTERS) {
  const m = printer.machinePreset;
  machines[m] = flatten(orcaIdx, 'machine', m);
  const proc = compatibleWith(orcaIdx, 'process', m);
  const fil = compatibleWith(orcaIdx, 'filament', m);
  for (const n of proc) processes[n] = flatten(orcaIdx, 'process', n);
  for (const n of fil) filaments[n] = flatten(orcaIdx, 'filament', n);
  compat[m] = { processes: proc, filaments: fil, flashStudioFilaments: compatibleWith(ffIdx, 'filament', m) };
}

mkdirSync(OUT, { recursive: true });
const write = (file: string, data: unknown) => writeFileSync(join(OUT, file), JSON.stringify(data, null, 1) + '\n');
write('flashforge.json', { source: { orca: gitInfo(orcaDir), flashStudio: gitInfo(ffDir) }, compat, machines, processes, filaments });
write('options.json', {
  orca: extractOptions(join(orcaDir, 'src/libslic3r/PrintConfig.cpp')),
  flashstudio: extractOptions(join(ffDir, 'src/libslic3r/PrintConfig.cpp')),
});
console.log(`machines ${Object.keys(machines).length}, processes ${Object.keys(processes).length}, filaments ${Object.keys(filaments).length}`);
