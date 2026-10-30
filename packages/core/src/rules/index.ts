import keyActions from './key-actions.json' with { type: 'json' };
import type { ConfigValue } from '../config.ts';

export type Action = 'keep' | 'keep-if-same-nozzle' | 'keep-if-multicolor' | 'transform' | 'replace' | 'drop';
export type Section = 'print' | 'filament' | 'printer' | 'project' | 'unlisted';
export interface KeyRule { section: Section; action: Action }

const OVERRIDES: Record<string, KeyRule> = {
  // Bed temperatures are chosen by plate type; the author's plate keeps their bed temperature meaningful.
  curr_bed_type: { section: 'project', action: 'keep' },
};

/** Rule for an OrcaSlicer key; undefined = not an OrcaSlicer setting. */
export function ruleFor(key: string): KeyRule | undefined {
  const entry = OVERRIDES[key] ?? (keyActions as Record<string, { section: string; action: string }>)[key];
  if (!entry) return undefined;
  return { section: entry.section.split(',')[0] as Section, action: entry.action as Action };
}

/** Keys holding a 1-based filament number (0 = default), in the global or per-object config. */
export const FILAMENT_REF_KEYS = [
  'extruder', 'support_filament', 'support_interface_filament', 'wipe_tower_filament',
  'sparse_infill_filament_id', 'internal_solid_filament_id', 'outer_wall_filament_id', 'inner_wall_filament_id',
  'top_surface_filament_id', 'bottom_surface_filament_id',
] as const;

// Preset bookkeeping that is not a slicer setting of the project.
export const PRESET_META: ReadonlySet<string> = new Set([
  'name', 'inherits', 'from', 'setting_id', 'instantiation', 'type', 'version', 'filament_id', 'renamed_from',
  'description', 'is_custom_defined', 'compatible_printers', 'compatible_printers_condition', 'compatible_prints',
  'compatible_prints_condition', 'print_settings_id', 'printer_settings_id', 'filament_settings_id',
]);

export const TEMPERATURE_KEYS = ['nozzle_temperature', 'nozzle_temperature_initial_layer'] as const;
export const isBedTemperatureKey = (key: string): boolean => /_plate_temp(_initial_layer)?$/.test(key);

type Translation = (value: ConfigValue) => [string, ConfigValue][];
const rename = (to: string): Translation => (v) => [[to, v]];
// Bambu "1" means "default filament" for feature filaments; Orca uses "0" (OrcaSlicer@v2.4.2:src/libslic3r/PrintConfig.cpp:8050-8075).
const featureFilament = (...to: string[]): Translation => (v) => {
  const value = v === '1' ? '0' : v;
  return to.map((k) => [k, value]);
};
const mapValue = (key: string, table: Record<string, string>): Translation => (v) =>
  [[key, typeof v === 'string' ? (table[v] ?? v) : v]];

/** Bambu → Orca renames the Orca loader does not do (or does lossily). */
export const BAMBU_TRANSLATIONS: Record<string, Translation> = {
  wall_filament: featureFilament('outer_wall_filament_id', 'inner_wall_filament_id'),
  sparse_infill_filament: featureFilament('sparse_infill_filament_id'),
  solid_infill_filament: featureFilament('internal_solid_filament_id', 'top_surface_filament_id', 'bottom_surface_filament_id'),
  enable_support_ironing: rename('support_ironing'),
  sparse_infill_anchor: rename('infill_anchor'),
  sparse_infill_anchor_max: rename('infill_anchor_max'),
  initial_layer_flow_ratio: rename('bottom_solid_infill_flow_ratio'),
  ironing_direction: rename('ironing_angle'),
  filament_prime_volume: (v) => [['prime_volume', typeof v === 'string' ? v : (v[0] ?? '45')]],
  support_style: mapValue('support_style', { tree_organic: 'organic' }),
  ensure_vertical_shell_thickness: mapValue('ensure_vertical_shell_thickness', { enabled: 'ensure_all', partial: 'ensure_moderate', disabled: 'none' }),
  top_one_wall_type: (v) => (v === 'none' ? [] : [['only_one_wall_top', '1']]),
  sparse_infill_lattice_angle_1: rename('lateral_lattice_angle_1'),
  sparse_infill_lattice_angle_2: rename('lateral_lattice_angle_2'),
};

/** Enum values written for Flash Studio, whose option tables are older. */
export const FLASHSTUDIO_VALUES: Record<string, Record<string, string>> = {
  sparse_infill_pattern: { rectilinear: 'zig-zag', 'lateral-lattice': '2dlattice', crosszag: 'zig-zag', lockedzag: 'zig-zag', tpmsd: 'gyroid', tpmsfk: 'gyroid', 'lateral-honeycomb': 'honeycomb' },
  top_surface_pattern: { rectilinear: 'zig-zag' },
  bottom_surface_pattern: { rectilinear: 'zig-zag' },
  internal_solid_infill_pattern: { rectilinear: 'zig-zag' },
  seam_position: { aligned_back: 'aligned' },
};

/** Enum values written for OrcaSlicer. */
export const ORCA_VALUES: Record<string, Record<string, string>> = {
  sparse_infill_pattern: { '2dlattice': 'lateral-lattice', ironingarchimedeanspiral: 'archimedeanchords', globalmonotonicline: 'monotonicline' },
};
