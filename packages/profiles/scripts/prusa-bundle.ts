// PrusaSlicer's vendor bundle (resources/profiles/PrusaResearch.ini) → flattened presets for the Prusa printers.
import { readFileSync } from 'node:fs';
import { matchesCondition } from './condition.ts';

type Ini = Record<string, string>;
type Section = 'printer' | 'print' | 'filament';
export interface PrusaPrinterProfiles { printer: string; print: string; filaments: Record<string, string> }
export interface PrusaBundle { printers: Record<string, PrusaPrinterProfiles>; presets: Record<Section, Record<string, Ini>>; enums: Record<string, string[]> }

// Preset bookkeeping that a project config never carries.
const PRESET_ONLY = new Set(['inherits', 'alias', 'renamed_from', 'compatible_printers', 'compatible_printers_condition', 'compatible_prints', 'compatible_prints_condition']);
// Orca filament type → the name Prusa's presets use.
const TYPE_ALIASES: Record<string, string> = { TPU: 'FLEX' };

function parseBundle(text: string): Map<string, Ini> {
  const sections = new Map<string, Ini>();
  let current: Ini | undefined;
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^\[(\w+):(.+)\]\s*$/);
    if (header) { sections.set(`${header[1]}:${header[2]}`, (current = {})); continue; }
    const kv = line.match(/^([a-z0-9_]+) = ?(.*)$/);
    if (kv && current) current[kv[1]!] = kv[2]!;
  }
  return sections;
}

const unquote = (s: string) => s.trim().replace(/^"|"$/g, '');

function flatten(bundle: Map<string, Ini>, type: Section, name: string, seen: string[] = []): Ini {
  const own = bundle.get(`${type}:${name}`);
  if (!own) throw new Error(`${type} "${name}" not found${seen.length ? ` (from ${seen.at(-1)})` : ''}`);
  const parents = (own.inherits ?? '').split(';').map(unquote).filter(Boolean);
  return Object.assign({}, ...parents.map((p) => flatten(bundle, type, p, [...seen, name])), own) as Ini;
}

/** The condition evaluator reads real values: `\n` escapes unescaped, `;`-lists split. */
function conditionView(printer: Ini): Record<string, unknown> {
  return Object.fromEntries(Object.entries(printer).map(([k, v]) => [k, v.includes(',') && !v.includes(' ') ? v.split(',') : v.replace(/\\n/g, '\n')]));
}

function compatible(flat: Ini, printerName: string, view: Record<string, unknown>): boolean {
  const list = (flat.compatible_printers ?? '').split(';').map(unquote).filter(Boolean);
  if (list.length) return list.includes(printerName);
  const condition = flat.compatible_printers_condition ?? '';
  return condition === '' || matchesCondition(condition, view);
}

function instances(bundle: Map<string, Ini>, type: Section): string[] {
  return [...bundle.keys()].filter((k) => k.startsWith(`${type}:`) && !k.startsWith(`${type}:*`)).map((k) => k.slice(type.length + 1));
}

const rankFilament = (name: string) => (/^Prusament /.test(name) ? 0 : /^Generic /.test(name) ? 1 : 2);

/** 0.20 mm everyday process, as for the other slicers: the printer's default if it is one, else SPEED, STRUCTURAL, QUALITY. */
function pickPrint(names: string[], flats: Map<string, Ini>, preferred: string): string {
  const at020 = names.filter((n) => Number(flats.get(n)!.layer_height) === 0.2 && !/SOLUBLE/i.test(n));
  const pick = at020.includes(preferred) ? preferred : [/SPEED/, /STRUCTURAL/, /QUALITY/].map((re) => at020.find((n) => re.test(n))).find(Boolean) ?? at020[0];
  if (!pick) throw new Error('no 0.20 mm print preset');
  return pick;
}

/** One preset per filament type: Prusament, then Generic, then the shortest name; the printer's default wins for its type. */
function pickFilaments(names: string[], flats: Map<string, Ini>, preferred: string): Record<string, string> {
  const best: Record<string, string> = {};
  const sorted = [...names].sort((a, b) => Number(b === preferred) - Number(a === preferred) || rankFilament(a) - rankFilament(b) || a.length - b.length || a.localeCompare(b));
  for (const n of sorted) {
    const type = unquote(flats.get(n)!.filament_type ?? '').toUpperCase();
    if (type && !best[type]) best[type] = n;
  }
  for (const [orca, prusa] of Object.entries(TYPE_ALIASES)) if (best[prusa] && !best[orca]) best[orca] = best[prusa];
  return best;
}

/** `set_enum<T>({...})` values per enum option, falling back to the type's parse table. */
function extractEnums(printConfigCpp: string): Record<string, string[]> {
  const src = readFileSync(printConfigCpp, 'utf8');
  const keyMaps = Object.fromEntries([...src.matchAll(/s_keys_map_(\w+)\s*\{([\s\S]*?)\};/g)].map((m) => [m[1]!, [...m[2]!.matchAll(/\{\s*"([^"]+)"/g)].map((v) => v[1]!)]));
  const adds = [...src.matchAll(/\badd(?:_nullable)?\("([a-z0-9_]+)",\s*coEnum\)/g)];
  const out: Record<string, string[]> = {};
  adds.forEach((m, i) => {
    const body = src.slice(m.index, adds[i + 1]?.index ?? src.length);
    const set = body.match(/set_enum<(\w+)>\(\s*(\{[\s\S]*?\})\s*\)\s*;/);
    if (!set) return;
    const pairs = [...set[2]!.matchAll(/\{\s*"([^"]*)"\s*,/g)].map((v) => v[1]!);
    const plain = [...set[2]!.matchAll(/"([^"]*)"/g)].map((v) => v[1]!);
    const values = pairs.length ? pairs : plain.length ? plain : keyMaps[set[1]!];
    if (values?.length) out[m[1]!] = values;
  });
  return out;
}

const lean = (flat: Ini): Ini => Object.fromEntries(Object.entries(flat).filter(([k]) => !PRESET_ONLY.has(k)));

export function readPrusaBundle(dir: string, printers: readonly string[]): PrusaBundle {
  const bundle = parseBundle(readFileSync(`${dir}/resources/profiles/PrusaResearch.ini`, 'utf8'));
  const flats = (type: Section) => new Map(instances(bundle, type).map((n) => [n, flatten(bundle, type, n)]));
  const prints = flats('print');
  const filaments = flats('filament');
  const out: PrusaBundle = { printers: {}, presets: { printer: {}, print: {}, filament: {} }, enums: extractEnums(`${dir}/src/libslic3r/PrintConfig.cpp`) };
  for (const name of printers) {
    const printer = flatten(bundle, 'printer', name);
    const view = conditionView(printer);
    const printNames = [...prints].filter(([, f]) => compatible(f, name, view)).map(([n]) => n);
    const print = pickPrint(printNames, prints, unquote(printer.default_print_profile ?? ''));
    const filamentNames = [...filaments].filter(([, f]) => compatible(f, name, view)).map(([n]) => n);
    const picked = pickFilaments(filamentNames, filaments, unquote(printer.default_filament_profile ?? ''));
    if (!picked.PLA) throw new Error(`no PLA filament preset for ${name}`);
    out.printers[name] = { printer: name, print, filaments: picked };
    out.presets.printer[name] = lean(printer);
    out.presets.print[print] = lean(prints.get(print)!);
    for (const n of Object.values(picked)) out.presets.filament[n] = lean(filaments.get(n)!);
  }
  return out;
}
