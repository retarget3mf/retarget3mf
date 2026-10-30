import type { OptionInfo } from '@retarget3mf/profiles';
import type { Config, ConfigValue } from '../config.ts';

// PrusaSlicer 2.x key → OrcaSlicer key.
const RENAMES: Record<string, string> = {
  layer_height: 'layer_height',
  perimeters: 'wall_loops',
  top_solid_layers: 'top_shell_layers',
  bottom_solid_layers: 'bottom_shell_layers',
  fill_density: 'sparse_infill_density',
  support_material_threshold: 'support_threshold_angle',
  support_material_contact_distance: 'support_top_z_distance',
  support_material_interface_layers: 'support_interface_top_layers',
  support_material_bottom_interface_layers: 'support_interface_bottom_layers',
  support_material_spacing: 'support_base_pattern_spacing',
  support_material_buildplate_only: 'support_on_build_plate_only',
  support_material_extruder: 'support_filament',
  support_material_interface_extruder: 'support_interface_filament',
  brim_separation: 'brim_object_gap',
  raft_layers: 'raft_layers',
  elefant_foot_compensation: 'elefant_foot_compensation',
  ironing_flowrate: 'ironing_flow',
  ironing_spacing: 'ironing_spacing',
  fuzzy_skin: 'fuzzy_skin',
  fuzzy_skin_thickness: 'fuzzy_skin_thickness',
  fuzzy_skin_point_dist: 'fuzzy_skin_point_distance',
  temperature: 'nozzle_temperature',
  first_layer_temperature: 'nozzle_temperature_initial_layer',
  filament_type: 'filament_type',
  nozzle_diameter: 'nozzle_diameter',
  wipe_tower: 'enable_prime_tower',
  extruder: 'extruder',
  bed_shape: 'printable_area',
  printer_settings_id: 'printer_settings_id',
  print_settings_id: 'print_settings_id',
  filament_settings_id: 'filament_settings_id',
};

const INFILL_PATTERNS: Record<string, string> = { stars: 'tri-hexagon', monotoniclines: 'monotonicline' };
const PATTERN_KEYS: Record<string, string> = { fill_pattern: 'sparse_infill_pattern', top_fill_pattern: 'top_surface_pattern', bottom_fill_pattern: 'bottom_surface_pattern' };
const PLATES = ['hot_plate_temp', 'textured_plate_temp', 'cool_plate_temp', 'eng_plate_temp', 'supertack_plate_temp', 'textured_cool_plate_temp'];
const SUPPORT_STYLES: Record<string, [string, string]> = {
  grid: ['normal', 'grid'], snug: ['normal', 'snug'], organic: ['tree', 'organic'], tree: ['tree', 'tree_hybrid'],
};
/** Keys consumed together by `combined()`; never passed through on their own. */
const COMBINED = new Set([
  'support_material', 'support_material_auto', 'support_material_style', 'brim_type', 'brim_width', 'ironing', 'ironing_type',
  'bed_temperature', 'first_layer_bed_temperature', 'extruder_colour', 'filament_colour', 'first_layer_height',
  'support_material_bottom_contact_distance', 'seam_position', 'infill_every_layers', 'wipe_tower_x', 'wipe_tower_y',
]);

/** `; key = value` lines of Metadata/Slic3r_PE.config (and the same format in G-code footers). */
export function parsePrusaIni(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^; ([a-z0-9_]+) = (.*)$/);
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

/** Splits a Prusa value the way the Orca option type expects (strings are `;`-separated and may be quoted, numbers `,`). */
function shape(value: string, info: OptionInfo | undefined): ConfigValue {
  if (!info || !/s$/.test(info.type)) return value;
  if (info.type === 'coStrings') return value.split(';').map((v) => v.replace(/^"|"$/g, ''));
  return value.split(',');
}

function combined(ini: Record<string, string>): Config {
  const out: Config = {};
  const layer = Number(ini.layer_height) || 0.2;
  const first = ini.first_layer_height;
  if (first) out.initial_layer_print_height = first.endsWith('%') ? String(Number((layer * parseFloat(first) / 100).toFixed(3))) : first;

  if (ini.support_material !== undefined) {
    // 2.x: bool + auto flag; 3.0 enum values are handled the same way when present.
    const on = ini.support_material === '1' || ini.support_material === 'everywhere' || ini.support_material === 'enforcers_only';
    const auto = ini.support_material === 'everywhere' || (ini.support_material === '1' && ini.support_material_auto !== '0');
    const [kind, style] = SUPPORT_STYLES[ini.support_material_style ?? 'grid'] ?? SUPPORT_STYLES.grid!;
    out.enable_support = on ? '1' : '0';
    out.support_type = `${kind}(${auto ? 'auto' : 'manual'})`;
    out.support_style = style;
  }
  const top = ini.support_material_contact_distance;
  const bottom = ini.support_material_bottom_contact_distance;
  // Prusa 0 = "same as top"; Orca has no such meaning.
  if (bottom !== undefined) out.support_bottom_z_distance = Number(bottom) === 0 && top !== undefined ? top : bottom;

  if (ini.brim_width !== undefined) {
    out.brim_width = ini.brim_width;
    out.brim_type = Number(ini.brim_width) <= 0 ? 'no_brim' : (ini.brim_type ?? 'outer_only');
  }
  if (ini.ironing !== undefined) out.ironing_type = ini.ironing === '1' ? (ini.ironing_type ?? 'top') : 'no ironing';
  if (ini.seam_position) out.seam_position = ini.seam_position === 'rear' ? 'back' : ini.seam_position;
  if (ini.infill_every_layers) out.infill_combination = Number(ini.infill_every_layers) > 1 ? '1' : '0';

  for (const [from, suffix] of [['bed_temperature', ''], ['first_layer_bed_temperature', '_initial_layer']] as const) {
    const temps = ini[from]?.split(',');
    if (temps) for (const plate of PLATES) out[`${plate}${suffix}`] = temps;
  }
  // A non-empty extruder colour overrides the filament colour in PrusaSlicer's UI.
  const extruderColours = ini.extruder_colour?.split(';') ?? [];
  const filamentColours = ini.filament_colour?.split(';') ?? [];
  const count = Math.max(extruderColours.length, filamentColours.length, ini.nozzle_diameter?.split(',').length ?? 1);
  out.filament_colour = Array.from({ length: count }, (_, i) => extruderColours[i] || filamentColours[i] || '#FFFFFF');
  if (ini.wipe_tower_x) out.wipe_tower_x = [ini.wipe_tower_x];
  if (ini.wipe_tower_y) out.wipe_tower_y = [ini.wipe_tower_y];
  return out;
}

/**
 * Translates a PrusaSlicer config into OrcaSlicer keys and value formats. Keys with no translation are passed through
 * unchanged, so the conversion report lists them as dropped instead of silently losing them.
 */
export function translatePrusaConfig(ini: Record<string, string>, options: Readonly<Record<string, OptionInfo>>): Config {
  const out: Config = { curr_bed_type: 'Textured PEI Plate' };
  for (const [key, value] of Object.entries(ini)) {
    if (COMBINED.has(key)) continue;
    const pattern = PATTERN_KEYS[key];
    if (pattern) { out[pattern] = INFILL_PATTERNS[value] ?? value; continue; }
    const target = RENAMES[key] ?? key;
    out[target] = shape(value, options[target]);
  }
  return { ...out, ...combined(ini) };
}

/** Per-object / per-volume / height-range keys use the same names; values are always scalars there. */
export function translatePrusaKey(key: string, value: string): [string, string][] {
  const pattern = PATTERN_KEYS[key];
  if (pattern) return [[pattern, INFILL_PATTERNS[value] ?? value]];
  if (key === 'seam_position') return [[key, value === 'rear' ? 'back' : value]];
  return [[RENAMES[key] ?? key, value]];
}
