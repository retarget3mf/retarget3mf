import type { OptionInfo, Preset, TargetProfiles } from '@retarget3mf/profiles';
import { asList, first, sameValue, type Config, type ConfigValue } from '../config.ts';
import type { SettingChange } from '../report.ts';
import { PRESET_META } from '../rules/index.ts';

type Options = Readonly<Record<string, OptionInfo>>;
type Native = NonNullable<TargetProfiles['native']>;

/** OrcaSlicer key → Bambu Studio key; the inverse of rules BAMBU_TRANSLATIONS. */
const RENAMES: Record<string, string> = {
  support_ironing: 'enable_support_ironing',
  infill_anchor: 'sparse_infill_anchor',
  infill_anchor_max: 'sparse_infill_anchor_max',
  bottom_solid_infill_flow_ratio: 'initial_layer_flow_ratio',
  ironing_angle: 'ironing_direction',
  lateral_lattice_angle_1: 'sparse_infill_lattice_angle_1',
  lateral_lattice_angle_2: 'sparse_infill_lattice_angle_2',
  outer_wall_filament_id: 'wall_filament',
  sparse_infill_filament_id: 'sparse_infill_filament',
  internal_solid_filament_id: 'solid_infill_filament',
  prime_volume: 'filament_prime_volume',
  only_one_wall_top: 'top_one_wall_type',
};
// Orca "0" means "default filament" for feature filaments; Bambu Studio writes "1".
const FEATURE_FILAMENTS = new Set(['wall_filament', 'sparse_infill_filament', 'solid_infill_filament']);

/** Orca enum value → Bambu Studio value, where the names differ. */
const VALUES: Record<string, Record<string, string>> = {
  ensure_vertical_shell_thickness: { ensure_all: 'enabled', ensure_moderate: 'partial', ensure_critical_only: 'partial', none: 'disabled' },
  sparse_infill_pattern: { rectilinear: 'zig-zag', 'lateral-lattice': '2dlattice' },
  top_surface_pattern: { rectilinear: 'zig-zag' },
  bottom_surface_pattern: { rectilinear: 'zig-zag' },
  internal_solid_infill_pattern: { rectilinear: 'zig-zag' },
  ironing_pattern: { rectilinear: 'zig-zag' },
  support_ironing_pattern: { rectilinear: 'zig-zag' },
  support_style: { organic: 'tree_organic' },
  seam_position: { aligned_back: 'aligned' },
  top_one_wall_type: { '1': 'all top', '0': 'not apply' },
};

// Written for the target every time; never compared with the presets.
const PROJECT_KEYS = new Set([
  'name', 'from', 'version', 'printer_settings_id', 'print_settings_id', 'filament_settings_id', 'filament_ids',
  'inherits_group', 'different_settings_to_system', 'print_compatible_printers', 'filament_colour', 'filament_map',
  'filament_self_index', 'filament_extruder_variant',
]);

export function toBambuKey(key: string): string {
  return RENAMES[key] ?? key;
}

/** OrcaSlicer's option table restricted to keys Bambu Studio has (under its own name). */
export function bambuStudioOptionsInOrcaSpace(orca: Options, bambu: Options): Options {
  return Object.fromEntries(Object.entries(orca).filter(([k]) => bambu[toBambuKey(k)]));
}

/** One Orca-space key/value as Bambu Studio writes it. */
export function toBambuValue(key: string, value: ConfigValue): [string, ConfigValue] {
  const target = toBambuKey(key);
  const table = VALUES[target];
  let next: ConfigValue = table ? (typeof value === 'string' ? (table[value] ?? value) : value.map((v) => table[v] ?? v)) : value;
  if (FEATURE_FILAMENTS.has(target) && next === '0') next = '1';
  return [target, next];
}

function isAccepted(value: ConfigValue, info: OptionInfo): boolean {
  return asList(value).every((v) => {
    if (v === 'nil') return info.nullable;
    if (info.values) return info.values.includes(v);
    if (!/^co(Float|Int|Percent)s?$/.test(info.type)) return true;
    const n = Number(info.type.startsWith('coPercent') ? v.replace(/%$/, '') : v);
    return Number.isFinite(n) && (info.min === undefined || n >= info.min) && (info.max === undefined || n <= info.max);
  });
}

/** Fit a value to Bambu Studio's shape: its per-extruder-variant vectors repeat a scalar, its scalars take the first value. */
function reshape(value: ConfigValue, info: OptionInfo, nativeValue: ConfigValue | undefined): ConfigValue {
  const isVector = /s$/.test(info.type) && info.type !== 'coPoints';
  if (!isVector) return first(value) ?? '';
  const list = asList(value);
  const want = asList(nativeValue).length;
  return list.length === 1 && want > 1 ? Array.from({ length: want }, () => list[0]!) : [...list];
}

export interface BambuStudioInput {
  /** Final Orca-space project config, and its state right after the target presets were applied. */
  config: Config;
  baseline: Config;
  native: Native;
  processName: string;
  filamentNames: readonly string[];
  options: Options;
}

function nativeBaseline({ native, processName, filamentNames, options }: BambuStudioInput): Config {
  const out: Config = {};
  const process = native.processes[processName] ?? {};
  for (const preset of [native.machine, process]) {
    for (const [k, v] of Object.entries(preset)) if (options[k] && !PRESET_META.has(k)) out[k] = v as ConfigValue;
  }
  const filaments = filamentNames.map((n) => native.filaments[n]).filter((p): p is Preset => p !== undefined);
  if (filaments.length !== filamentNames.length) return out;
  // Bambu Studio joins filament presets by taking each preset's first value (ConfigOptionVector::set).
  for (const k of new Set(filaments.flatMap((p) => Object.keys(p)))) {
    const info = options[k];
    if (!info || PRESET_META.has(k) || !/s$/.test(info.type)) continue;
    const values = filaments.map((p) => first(p[k]) ?? info.default);
    if (values.every((v): v is string => v !== undefined)) out[k] = values;
  }
  return out;
}

/** Rewrites an Orca-space project for Bambu Studio: its presets fill everything the conversion did not decide. */
export function toBambuStudio(input: BambuStudioInput): { config: Config; changes: SettingChange[] } {
  const { config, baseline, options } = input;
  const out = nativeBaseline(input);
  const changes: SettingChange[] = [];
  for (const [key, value] of Object.entries(config)) {
    const fromPreset = !PROJECT_KEYS.has(key) && key in baseline && sameValue(value, baseline[key]);
    if (fromPreset && toBambuKey(key) in out) continue;
    const [target, mapped] = toBambuValue(key, value);
    const info = options[target];
    if (!info) continue;
    if (PROJECT_KEYS.has(key)) { out[target] = mapped; continue; }
    const next = reshape(mapped, info, out[target]);
    if (isAccepted(next, info)) { out[target] = next; continue; }
    changes.push({ key: target, outcome: 'replaced', reason: 'value is not accepted by Bambu Studio', from: value, ...(out[target] !== undefined && { to: out[target] }) });
  }
  out.different_settings_to_system = asList(config.different_settings_to_system).map((list) =>
    list.split(';').filter(Boolean).map(toBambuKey).filter((k) => options[k]).join(';'));
  return { config: out, changes };
}
