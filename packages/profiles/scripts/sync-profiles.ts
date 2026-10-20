// Generates src/generated/*.json from pinned slicer checkouts.
// Usage: node packages/profiles/scripts/sync-profiles.ts [--orca <dir>] [--flashstudio <dir>] [--bambustudio <dir>]
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
      // A file's own `type` wins: vendors occasionally misfile presets (Flash Studio 1.7.15 has a machine under filament/).
      const declared = json.type === 'machine' || json.type === 'process' || json.type === 'filament' ? json.type : type;
      if (typeof json.name !== 'string' || !PRESET_TYPES.includes(declared as PresetType)) continue;
      const key = `${declared}|${json.name}`;
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
  // Bambu Studio machines pull their G-code from `include` template presets.
  for (const inc of chain.flatMap((p) => (Array.isArray(p.include) ? p.include as string[] : []))) {
    const { name: _n, instantiation: _i, ...values } = idx.get(`${type}|${inc}`) ?? {};
    if (!_n) throw new Error(`${type} "${name}": missing include "${inc}"`);
    Object.assign(flat, values);
  }
  delete flat.include;
  return flat;
}

function compatibleWith(idx: Map<string, Json>, type: PresetType, machine: string): string[] {
  const names: string[] = [];
  for (const [key, json] of idx) {
    if (!key.startsWith(`${type}|`) || json.instantiation !== 'true') continue;
    // compatible_printers is often inherited from a hidden base preset.
    let list: unknown;
    try {
      list = flatten(idx, type, json.name as string).compatible_printers;
    } catch (error) {
      console.warn(`skipping ${type} "${String(json.name)}": ${(error as Error).message}`);
      continue;
    }
    if (Array.isArray(list) && list.includes(machine)) names.push(json.name as string);
  }
  return names.sort();
}

function rankFilament(name: string): number {
  if (/\bBasic\b/.test(name)) return 0;
  if (/\bPro\b/.test(name)) return 1;
  if (/\bGeneric\b/.test(name)) return 2;
  return 3;
}

/** The converter picks one preset per filament type, so only each type's best-ranked preset is shipped. */
function bestPerType(idx: Map<string, Json>, names: string[]): string[] {
  const best = new Map<string, string>();
  const sorted = names.filter((n) => idx.has(`filament|${n}`)).sort((a, b) => rankFilament(a) - rankFilament(b) || a.localeCompare(b));
  for (const n of sorted) {
    const type = flatten(idx, 'filament', n).filament_type;
    const key = String(Array.isArray(type) ? type[0] : type).toUpperCase();
    if (!best.has(key)) best.set(key, n);
  }
  return [...best.values()].sort();
}

/** Conversions pin the 0.20 mm standard process (docs/research.md §1), so only that one ships. */
function pinnedProcess(idx: Map<string, Json>, names: string[], machine: string): string {
  const at020 = names.filter((n) => Number([flatten(idx, 'process', n).layer_height].flat()[0]) === 0.2);
  const pick = at020.find((n) => /Standard/.test(n)) ?? at020[0];
  if (!pick) throw new Error(`No 0.20 mm process for ${machine}`);
  return pick;
}

// Bookkeeping the converter never reads; it only bloats the bundle.
const lean = ({ compatible_printers: _c, compatible_prints: _p, description: _d, ...rest }: Json): Json => rest;

interface OptionInfo { type: string; nullable: boolean; min?: number; max?: number; default?: string; values?: string[] }

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
    const values = m[3] === 'coEnum' ? [...body.matchAll(/enum_values\.push_back\("([^"]*)"\)/g)].map((v) => v[1]!) : [];
    out[m[2]!] = {
      type: m[3]!, nullable: Boolean(m[1]), ...(min && { min: Number(min) }), ...(max && { max: Number(max) }),
      ...(def !== undefined && { default: def }), ...(values.length && { values }),
    };
  });
  return out;
}

const orcaDir = arg('--orca', join(ROOT, 'research/OrcaSlicer-v2.4.2'));
const ffDir = arg('--flashstudio', join(ROOT, 'research/Orca-Flashforge-1.7.15'));
const bambuDir = arg('--bambustudio', join(ROOT, 'research/BambuStudio'));
const profilesOf = (dir: string, vendors: string[]) => indexPresets(join(dir, 'resources/profiles'), vendors);

type SlicerId = 'orca' | 'flashstudio' | 'bambustudio';

const orcaFlashforge = profilesOf(orcaDir, ['Flashforge', 'OrcaFilamentLibrary']);
const orcaBambu = profilesOf(orcaDir, ['BBL', 'OrcaFilamentLibrary']);
const bambuStudio = profilesOf(bambuDir, ['BBL']);

/**
 * Per vendor: `presets` are in OrcaSlicer's option space (the pipeline's working space); `native` are the
 * vendor slicer's own presets, kept where its options differ in name or shape; `slicers` list filament names per slicer.
 */
const VENDORS: Record<string, { presets: Map<string, Json>; native?: Map<string, Json>; slicers: Partial<Record<SlicerId, Map<string, Json>>> }> = {
  Flashforge: {
    presets: orcaFlashforge,
    slicers: { orca: orcaFlashforge, flashstudio: profilesOf(ffDir, ['Flashforge', 'OrcaFilamentLibrary']) },
  },
  'Bambu Lab': { presets: orcaBambu, native: bambuStudio, slicers: { bambustudio: bambuStudio, orca: orcaBambu } },
};

const machines: Record<string, Json> = {};
const processes: Record<string, Json> = {};
const filaments: Record<string, Json> = {};
const compat: Record<string, { processes: string[]; filaments: Partial<Record<SlicerId, string[]>> }> = {};
const native: Record<'machines' | 'processes' | 'filaments', Record<string, Json>> = { machines: {}, processes: {}, filaments: {} };

for (const printer of PRINTERS) {
  const vendor = VENDORS[printer.vendor];
  if (!vendor) throw new Error(`No profile source for vendor ${printer.vendor}`);
  const m = printer.machinePreset;
  machines[m] = flatten(vendor.presets, 'machine', m);
  const proc = [pinnedProcess(vendor.presets, compatibleWith(vendor.presets, 'process', m), m)];
  // Values always come from `presets`, so a slicer's name list only offers presets that exist there too.
  const names = Object.fromEntries(printer.slicers.map((id) => [id, bestPerType(vendor.presets, compatibleWith(vendor.slicers[id]!, 'filament', m))]));
  for (const n of proc) processes[n] = flatten(vendor.presets, 'process', n);
  for (const n of new Set(Object.values(names).flat())) filaments[n] = lean(flatten(vendor.presets, 'filament', n));
  compat[m] = { processes: proc, filaments: names };
  if (!vendor.native) continue;
  native.machines[m] = flatten(vendor.native, 'machine', m);
  for (const n of proc) if (vendor.native.has(`process|${n}`)) native.processes[n] = flatten(vendor.native, 'process', n);
  for (const n of names.bambustudio ?? []) native.filaments[n] = lean(flatten(vendor.native, 'filament', n));
}

mkdirSync(OUT, { recursive: true });
const write = (file: string, data: unknown) => writeFileSync(join(OUT, file), JSON.stringify(data, null, 1) + '\n');
write('profiles.json', { source: { orca: gitInfo(orcaDir), flashStudio: gitInfo(ffDir), bambuStudio: gitInfo(bambuDir) }, compat, machines, processes, filaments, native });
write('options.json', {
  orca: extractOptions(join(orcaDir, 'src/libslic3r/PrintConfig.cpp')),
  flashstudio: extractOptions(join(ffDir, 'src/libslic3r/PrintConfig.cpp')),
  bambustudio: extractOptions(join(bambuDir, 'src/libslic3r/PrintConfig.cpp')),
});
console.log(`machines ${Object.keys(machines).length}, processes ${Object.keys(processes).length}, filaments ${Object.keys(filaments).length}`);
