import type { OptionInfo, Preset, SlicerId, TargetProfiles } from '@retarget3mf/profiles';
import { asList, first, sameValue, type Config, type ConfigValue } from '../config.ts';
import type { FilamentSummary, SettingChange } from '../report.ts';
import {
  BAMBU_TRANSLATIONS, FILAMENT_REF_KEYS, FLASHSTUDIO_VALUES, ORCA_VALUES, TEMPERATURE_KEYS,
  isBedTemperatureKey, ruleFor, type Section,
} from '../rules/index.ts';
import { remapRef, type FilamentPlan } from './filaments.ts';

export interface SettingsInput {
  source: Config;
  plan: FilamentPlan;
  target: TargetProfiles;
  slicer: SlicerId;
  options: { orca: Readonly<Record<string, OptionInfo>>; slicer: Readonly<Record<string, OptionInfo>> };
  wipeTower?: { x: string[]; y: string[] };
}

export interface SettingsResult {
  config: Config;
  changes: SettingChange[];
  warnings: string[];
  filaments: FilamentSummary[];
  /** Same rules for one per-object / per-part / height-range override; returns the entries to write. */
  convertOverride: (key: string, value: string, owner: string) => [string, string][];
}

// Preset bookkeeping that is not a slicer setting of the project.
const PRESET_META = new Set([
  'name', 'inherits', 'from', 'setting_id', 'instantiation', 'type', 'version', 'filament_id', 'renamed_from',
  'description', 'is_custom_defined', 'compatible_printers', 'compatible_printers_condition', 'compatible_prints',
  'compatible_prints_condition', 'print_settings_id', 'printer_settings_id', 'filament_settings_id',
]);
// Rebuilt for the target presets on every conversion; reporting them would only be noise.
const IDENTITY_KEYS = new Set(['name', 'from', 'version', 'inherits_group', 'different_settings_to_system', 'print_compatible_printers', 'filament_ids', 'filament_map', 'filament_map_mode', 'filament_self_index', 'filament_extruder_variant']);
const SLICER_NAMES: Record<SlicerId, string> = { orca: 'OrcaSlicer', flashstudio: 'Flash Studio' };
const PROJECT_PER_FILAMENT = new Set(['filament_colour', 'filament_colour_type', 'filament_multi_colour']);
const PINNED_LAYER_HEIGHT = 0.2;
const DEFAULT_VARIANT = 'Direct Drive Standard';

const isVectorType = (info: OptionInfo | undefined) => info !== undefined && /s$/.test(info.type) && info.type !== 'coPoints';

function pickProcess(target: TargetProfiles): [string, Preset] {
  const entries = Object.entries(target.processes);
  const pinned = entries.find(([, p]) => Number(first(p.layer_height)) === PINNED_LAYER_HEIGHT) ?? entries[0];
  if (!pinned) throw new Error(`No process preset for ${target.printer.machinePreset}`);
  return pinned;
}

function rankFilament(name: string): number {
  if (/\bBasic\b/.test(name)) return 0;
  if (/\bPro\b/.test(name)) return 1;
  if (/\bGeneric\b/.test(name)) return 2;
  return 3;
}

function pickFilament(type: string, target: TargetProfiles, slicer: SlicerId): { name: string; exact: boolean } {
  const names = target.filamentNames[slicer].filter((n) => target.filaments[n]);
  const byType = (t: string) => names
    .filter((n) => first(target.filaments[n]!.filament_type)?.toUpperCase() === t.toUpperCase())
    .sort((a, b) => rankFilament(a) - rankFilament(b) || a.localeCompare(b));
  const exact = byType(type)[0];
  if (exact) return { name: exact, exact: true };
  const fallback = byType('PLA')[0] ?? names[0];
  if (!fallback) throw new Error(`No filament presets for ${target.printer.machinePreset}`);
  return { name: fallback, exact: false };
}

/** Extruder whose settings a single-nozzle target inherits: the one most kept filaments print on (1-based). */
function sourceExtruder(source: Config, plan: FilamentPlan): number {
  const filamentMap = asList(source.filament_map).map(Number);
  const votes = new Map<number, number>();
  for (const f of plan.keep) {
    const e = filamentMap[f - 1] || 1;
    votes.set(e, (votes.get(e) ?? 0) + 1);
  }
  return [...votes].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 1;
}

/** H2D-style projects store one row per filament *variant*; keep the row of the chosen extruder's variant. */
function filamentRows(source: Config, plan: FilamentPlan, extruder: number): (v: readonly string[]) => string[] {
  const count = asList(source.filament_colour).length;
  const selfIndex = asList(source.filament_self_index).map(Number);
  const variants = asList(source.filament_extruder_variant);
  const extruderType = asList(source.extruder_type)[extruder - 1];
  const volumeType = asList(source.nozzle_volume_type)[extruder - 1];
  const variant = extruderType && volumeType ? `${extruderType} ${volumeType}` : DEFAULT_VARIANT;
  const rowOf = (f: number) => {
    const rows = selfIndex.flatMap((s, i) => (s === f ? [i] : []));
    return rows.find((i) => variants[i] === variant) ?? rows[0] ?? f - 1;
  };
  return (v) => {
    if (selfIndex.length > count && v.length === selfIndex.length) return plan.keep.map((f) => v[rowOf(f)]!);
    if (v.length === count) return plan.keep.map((f) => v[f - 1]!);
    if (v.length === 1) return plan.keep.map(() => v[0]!);
    return [...v];
  };
}

function isValid(value: ConfigValue, info: OptionInfo | undefined): boolean {
  if (!info) return true;
  return asList(value).every((v) => {
    if (v === 'nil') return info.nullable;
    if (!/^co(Float|Int|Percent|FloatOrPercent)s?$/.test(info.type)) return true;
    const n = Number(v.replace(/%$/, ''));
    if (!Number.isFinite(n)) return false;
    return (info.min === undefined || n >= info.min) && (info.max === undefined || n <= info.max);
  });
}

/** One n×n block per source nozzle; keep the chosen extruder's block, restricted to kept filaments. */
function flushMatrix(source: Config, plan: FilamentPlan, extruder: number): { matrix?: string[]; vector?: string[]; multiplier?: string[] } {
  const count = asList(source.filament_colour).length;
  const m = asList(source.flush_volumes_matrix);
  const blocks = m.length / (count * count);
  if (!Number.isInteger(blocks) || blocks < 1) return {};
  const block = Math.min(extruder, blocks) - 1;
  const matrix = plan.keep.flatMap((from) => plan.keep.map((to) => m[block * count * count + (from - 1) * count + (to - 1)]!));
  const v = asList(source.flush_volumes_vector);
  const vector = v.length === 2 * count ? plan.keep.flatMap((f) => [v[2 * (f - 1)]!, v[2 * (f - 1) + 1]!]) : undefined;
  return { matrix, ...(vector && { vector }), multiplier: [asList(source.flush_multiplier)[block] ?? '1'] };
}

interface ChosenFilament { name: string; preset: Preset; type: string }

/** Working state of one conversion; every step below reads and extends it. */
interface Ctx {
  input: SettingsInput;
  config: Config;
  changes: SettingChange[];
  warnings: string[];
  kept: Record<'print' | 'filament', Set<string>>;
  chosen: ChosenFilament[];
  extruder: number;
  collapse: (v: readonly string[]) => string[];
  isMulticolor: boolean;
  sameNozzle: boolean;
}

function record(ctx: Ctx, key: string, outcome: SettingChange['outcome'], reason: string, from?: ConfigValue, to?: ConfigValue): void {
  ctx.changes.push({ key, outcome, reason, ...(from !== undefined && { from }), ...(to !== undefined && { to }) });
}

const supported = (ctx: Ctx, key: string) => !PRESET_META.has(key) && ctx.input.options.slicer[key] !== undefined;

function chooseFilaments(input: SettingsInput, warnings: string[]): ChosenFilament[] {
  const { source, plan, target, slicer } = input;
  const types = asList(source.filament_type);
  const fallbacks = new Map<string, { preset: string; slots: number[] }>();
  const chosen = plan.keep.map((f, i) => {
    const type = types[f - 1] ?? 'PLA';
    const pick = pickFilament(type, target, slicer);
    if (!pick.exact) fallbacks.set(type, { preset: pick.name, slots: [...(fallbacks.get(type)?.slots ?? []), i + 1] });
    return { name: pick.name, preset: target.filaments[pick.name]!, type };
  });
  for (const [type, { preset, slots }] of fallbacks) {
    warnings.push(`${type} (filament ${slots.join(', ')}) has no ${target.printer.displayName} profile in this slicer; "${preset}" is used instead. Check its temperatures before printing.`);
  }
  return chosen;
}

/** Target profile values first; author intent is layered on top. */
function baseline(ctx: Ctx, process: Preset): void {
  for (const [k, v] of Object.entries(ctx.input.target.machine)) if (supported(ctx, k)) ctx.config[k] = v;
  for (const [k, v] of Object.entries(process)) if (supported(ctx, k)) ctx.config[k] = v;
  // Every per-filament option gets one value per slot (preset value, else the slicer default):
  // the slicer's CLI rejects per-filament vectors shorter than filament_colour.
  for (const [k, info] of Object.entries(ctx.input.options.slicer)) {
    if (!supported(ctx, k) || ruleFor(k)?.section !== 'filament' || !isVectorType(info)) continue;
    const values = ctx.chosen.map((c) => first(c.preset[k]) ?? info.default);
    if (values.every((v): v is string => v !== undefined)) ctx.config[k] = values;
  }
}

function applySourceKey(ctx: Ctx, rawKey: string, rawValue: ConfigValue): void {
  const translate = BAMBU_TRANSLATIONS[rawKey];
  const pairs = translate ? translate(rawValue) : [[rawKey, rawValue] as [string, ConfigValue]];
  if (translate && pairs.length === 0) record(ctx, rawKey, 'dropped', 'no equivalent setting in the target slicer', rawValue);
  for (const [key, value] of pairs) {
    if (IDENTITY_KEYS.has(key)) continue;
    if (translate && key !== rawKey) record(ctx, rawKey, 'translated', `renamed to ${key}`, rawValue, value);
    const rule = ruleFor(key);
    if (!rule) { record(ctx, key, 'dropped', 'not an OrcaSlicer setting', value); continue; }
    if (rule.action === 'transform' || PRESET_META.has(key)) continue;
    if (key === 'post_process') { record(ctx, key, 'dropped', 'post-processing scripts are never carried over (they run programs on your computer)', value); continue; }
    if (rule.action === 'drop') { record(ctx, key, 'dropped', 'printer-specific tuning; the target profile decides', value, ctx.config[key]); continue; }
    if (!supported(ctx, key) && rule.action !== 'replace') { record(ctx, key, 'dropped', `not supported by ${SLICER_NAMES[ctx.input.slicer]}`, value); continue; }
    const keep = rule.action === 'keep'
      || (rule.action === 'keep-if-same-nozzle' && ctx.sameNozzle)
      || (rule.action === 'keep-if-multicolor' && ctx.isMulticolor);
    if (keep) { applyKept(ctx, key, rule.section, value); continue; }
    if (sameValue(value, ctx.config[key])) continue;
    const why = rule.action === 'replace' ? 'comes from the target printer profile' : rule.action === 'keep-if-same-nozzle' ? 'depends on nozzle size' : 'only used for multi-colour prints';
    record(ctx, key, 'replaced', why, value, ctx.config[key]);
  }
}

function normalizeKept(ctx: Ctx, key: string, section: Section, value: ConfigValue): ConfigValue {
  const { plan, slicer, options } = ctx.input;
  let next: ConfigValue = value;
  if (section === 'filament' || PROJECT_PER_FILAMENT.has(key)) next = ctx.collapse(asList(value));
  else if (typeof value !== 'string' && !isVectorType(options.orca[key])) next = value[ctx.extruder - 1] ?? value[0] ?? '';
  if ((FILAMENT_REF_KEYS as readonly string[]).includes(key)) next = typeof next === 'string' ? remapRef(next, plan.map) : next.map((v) => remapRef(v, plan.map));
  const enumFix = (slicer === 'flashstudio' ? FLASHSTUDIO_VALUES : ORCA_VALUES)[key];
  const fixed = typeof next === 'string' ? enumFix?.[next] : undefined;
  if (fixed) {
    record(ctx, key, 'translated', `"${next}" is called "${fixed}" in this slicer`, next, fixed);
    next = fixed;
  }
  return next;
}

function applyKept(ctx: Ctx, key: string, section: Section, value: ConfigValue): void {
  const next = normalizeKept(ctx, key, section, value);
  if (!isValid(next, ctx.input.options.slicer[key])) {
    record(ctx, key, 'replaced', 'value is not accepted by the target slicer', next, ctx.config[key]);
    return;
  }
  const clamped = clampTemperatures(ctx, key, next);
  if (sameValue(clamped, next)) record(ctx, key, 'kept', 'author setting', value, clamped);
  else record(ctx, key, 'clamped', 'outside the safe range of the target printer or filament', next, clamped);
  ctx.config[key] = clamped;
  if (section === 'print' || section === 'filament') ctx.kept[section].add(key);
}

function clampTemperatures(ctx: Ctx, key: string, value: ConfigValue): ConfigValue {
  const { printer } = ctx.input.target;
  if ((TEMPERATURE_KEYS as readonly string[]).includes(key)) {
    return asList(value).map((v, i) => {
      const preset = ctx.chosen[i]?.preset;
      const lo = Number(first(preset?.nozzle_temperature_range_low)) || 0;
      const hi = Math.min(Number(first(preset?.nozzle_temperature_range_high)) || Infinity, printer.maxNozzleTemp);
      return String(Math.min(Math.max(Number(v), lo), hi));
    });
  }
  if (isBedTemperatureKey(key)) return asList(value).map((v) => String(Math.min(Number(v), printer.maxBedTemp)));
  return value;
}

function applySpecialCases(ctx: Ctx): void {
  const { config, input } = ctx;
  if (input.plan.hasPaintedSupports && config.enable_support === '0') {
    ctx.changes = ctx.changes.filter((c) => !(c.key === 'enable_support' && c.outcome === 'kept'));
    record(ctx, 'enable_support', 'replaced', 'the model has painted supports, which need support generation on', '0', '1');
    config.enable_support = '1';
    ctx.kept.print.add('enable_support');
    ctx.warnings.push('The author painted supports but had support generation off; supports were turned on so the painted areas print.');
  }
  if (!ctx.isMulticolor) config.enable_prime_tower = '0';
  const flush = flushMatrix(input.source, input.plan, ctx.extruder);
  if (!flush.matrix) {
    // Wrong-sized matrices fail G-code export; without one the slicer computes defaults for the filament count.
    for (const k of ['flush_volumes_matrix', 'flush_volumes_vector', 'flush_multiplier']) delete config[k];
  }
  if (flush.matrix) config.flush_volumes_matrix = flush.matrix;
  if (flush.vector) config.flush_volumes_vector = flush.vector;
  if (flush.multiplier) config.flush_multiplier = flush.multiplier;
  if (input.wipeTower && ctx.isMulticolor) {
    config.wipe_tower_x = input.wipeTower.x;
    config.wipe_tower_y = input.wipeTower.y;
  }
}

function makeOverrideConverter(ctx: Ctx): SettingsResult['convertOverride'] {
  const { plan, slicer, options } = ctx.input;
  return (rawKey, rawValue, owner) => {
    const translate = BAMBU_TRANSLATIONS[rawKey];
    const pairs = translate ? translate(rawValue) : [[rawKey, rawValue] as [string, ConfigValue]];
    const out: [string, string][] = [];
    for (const [key, value] of pairs) {
      const label = `${owner}: ${key}`;
      if (typeof value !== 'string') continue;
      if ((FILAMENT_REF_KEYS as readonly string[]).includes(key)) { out.push([key, remapRef(value, plan.map)]); continue; }
      const rule = ruleFor(key);
      const keep = rule && options.slicer[key] && (rule.action === 'keep'
        || (rule.action === 'keep-if-same-nozzle' && ctx.sameNozzle)
        || (rule.action === 'keep-if-multicolor' && ctx.isMulticolor));
      if (!keep) { record(ctx, label, 'dropped', 'per-object override not carried over; the target profile decides', value); continue; }
      const fixed = (slicer === 'flashstudio' ? FLASHSTUDIO_VALUES : ORCA_VALUES)[key]?.[value] ?? value;
      if (!isValid(fixed, options.slicer[key])) { record(ctx, label, 'dropped', 'value is not accepted by the target slicer', value); continue; }
      if (fixed !== value || key !== rawKey) record(ctx, label, 'translated', `written as ${key}=${fixed}`, value, fixed);
      out.push([key, fixed]);
    }
    return out;
  };
}

function setIdentity(ctx: Ctx, processName: string, process: Preset): void {
  const { target, options, source, plan } = ctx.input;
  const names = ctx.chosen.map((c) => c.name);
  const filamentList = [...ctx.kept.filament].sort().join(';');
  Object.assign(ctx.config, {
    name: 'project_settings',
    from: 'project',
    version: '2.3.0.0',
    printer_settings_id: target.printer.machinePreset,
    print_settings_id: processName,
    filament_settings_id: names,
    filament_ids: ctx.chosen.map((c) => first(c.preset.filament_id) ?? ''),
    inherits_group: [processName, ...names, target.printer.machinePreset],
    // Keys listed here survive the slicer re-basing the project on its installed presets (docs/research.md §1).
    different_settings_to_system: [[...ctx.kept.print].sort().join(';'), ...names.map(() => filamentList), ''],
    print_compatible_printers: asList(process.compatible_printers),
  } satisfies Config);
  if (options.slicer.filament_map) ctx.config.filament_map = names.map(() => '1');
  const colours = asList(source.filament_colour);
  if (!ctx.config.filament_colour) ctx.config.filament_colour = plan.keep.map((f) => colours[f - 1] ?? '#FFFFFF');
}

export function buildSettings(input: SettingsInput): SettingsResult {
  const { source, plan, target } = input;
  const warnings: string[] = [];
  const extruder = sourceExtruder(source, plan);
  const ctx: Ctx = {
    input,
    config: {},
    changes: [],
    warnings,
    kept: { print: new Set(), filament: new Set() },
    chosen: chooseFilaments(input, warnings),
    extruder,
    collapse: filamentRows(source, plan, extruder),
    isMulticolor: plan.keep.length > 1 && target.printer.slots.kind === 'semm',
    sameNozzle: Number(first(source.nozzle_diameter)) === Number(first(target.machine.nozzle_diameter)),
  };
  const [processName, process] = pickProcess(target);
  baseline(ctx, process);
  for (const key of Object.keys(source).sort()) applySourceKey(ctx, key, source[key]!);
  applySpecialCases(ctx);
  setIdentity(ctx, processName, process);

  const filaments = plan.keep.map((f, i) => ({
    from: f, to: i + 1, type: ctx.chosen[i]!.type, colour: asList(ctx.config.filament_colour)[i] ?? '', preset: ctx.chosen[i]!.name,
  }));
  return { config: ctx.config, changes: ctx.changes, warnings: ctx.warnings, filaments, convertOverride: makeOverrideConverter(ctx) };
}
