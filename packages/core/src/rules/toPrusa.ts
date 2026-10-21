// OrcaSlicer key → PrusaSlicer 2.9 key, the reverse of rules/prusa.ts for the settings an author's project keeps.
const RENAMES: Record<string, string> = {
  layer_height: 'layer_height',
  initial_layer_print_height: 'first_layer_height',
  wall_loops: 'perimeters',
  top_shell_layers: 'top_solid_layers',
  bottom_shell_layers: 'bottom_solid_layers',
  top_shell_thickness: 'top_solid_min_thickness',
  bottom_shell_thickness: 'bottom_solid_min_thickness',
  sparse_infill_density: 'fill_density',
  infill_direction: 'fill_angle',
  infill_anchor: 'infill_anchor',
  infill_anchor_max: 'infill_anchor_max',
  bridge_angle: 'bridge_angle',
  thick_bridges: 'thick_bridges',
  interface_shells: 'interface_shells',
  is_infill_first: 'infill_first',
  extra_perimeters_on_overhangs: 'extra_perimeters_on_overhangs',
  detect_thin_wall: 'thin_walls',
  wall_generator: 'perimeter_generator',
  xy_contour_compensation: 'xy_size_compensation',
  elefant_foot_compensation: 'elefant_foot_compensation',
  slice_closing_radius: 'slice_closing_radius',
  only_one_wall_first_layer: 'only_one_perimeter_first_layer',
  staggered_inner_seams: 'staggered_inner_seams',
  seam_gap: 'seam_gap_distance',
  enable_support: 'support_material',
  support_threshold_angle: 'support_material_threshold',
  support_top_z_distance: 'support_material_contact_distance',
  support_bottom_z_distance: 'support_material_bottom_contact_distance',
  support_interface_top_layers: 'support_material_interface_layers',
  support_interface_bottom_layers: 'support_material_bottom_interface_layers',
  support_base_pattern_spacing: 'support_material_spacing',
  support_interface_spacing: 'support_material_interface_spacing',
  support_on_build_plate_only: 'support_material_buildplate_only',
  support_object_xy_distance: 'support_material_xy_spacing',
  support_angle: 'support_material_angle',
  tree_support_branch_angle_organic: 'support_tree_angle',
  tree_support_branch_diameter_organic: 'support_tree_branch_diameter',
  raft_layers: 'raft_layers',
  raft_contact_distance: 'raft_contact_distance',
  raft_expansion: 'raft_expansion',
  raft_first_layer_density: 'raft_first_layer_density',
  raft_first_layer_expansion: 'raft_first_layer_expansion',
  brim_width: 'brim_width',
  brim_object_gap: 'brim_separation',
  ironing_flow: 'ironing_flowrate',
  ironing_spacing: 'ironing_spacing',
  fuzzy_skin_thickness: 'fuzzy_skin_thickness',
  fuzzy_skin_point_distance: 'fuzzy_skin_point_dist',
  spiral_mode: 'spiral_vase',
  skirt_loops: 'skirts',
  skirt_distance: 'skirt_distance',
  skirt_height: 'skirt_height',
  min_skirt_length: 'min_skirt_length',
  nozzle_temperature: 'temperature',
  nozzle_temperature_initial_layer: 'first_layer_temperature',
  line_width: 'extrusion_width',
  outer_wall_line_width: 'external_perimeter_extrusion_width',
  inner_wall_line_width: 'perimeter_extrusion_width',
  sparse_infill_line_width: 'infill_extrusion_width',
  internal_solid_infill_line_width: 'solid_infill_extrusion_width',
  top_surface_line_width: 'top_infill_extrusion_width',
  initial_layer_line_width: 'first_layer_extrusion_width',
  support_line_width: 'support_material_extrusion_width',
  extruder: 'extruder',
  resolution: 'resolution',
  min_bead_width: 'min_bead_width',
  min_feature_size: 'min_feature_size',
  wall_transition_length: 'wall_transition_length',
  wall_transition_filter_deviation: 'wall_transition_filter_deviation',
  wall_transition_angle: 'wall_transition_angle',
  wall_distribution_count: 'wall_distribution_count',
};

const VALUE_RENAMES: Record<string, [string, Record<string, string>]> = {
  sparse_infill_pattern: ['fill_pattern', { 'tri-hexagon': 'stars' }],
  top_surface_pattern: ['top_fill_pattern', { monotonicline: 'monotoniclines' }],
  bottom_surface_pattern: ['bottom_fill_pattern', { monotonicline: 'monotoniclines' }],
  support_base_pattern: ['support_material_pattern', {}],
  support_interface_pattern: ['support_material_interface_pattern', {}],
  seam_position: ['seam_position', { back: 'rear', aligned_back: 'aligned' }],
  fuzzy_skin: ['fuzzy_skin', { allwalls: 'all', disabled_fuzzy: 'none' }],
  brim_type: ['brim_type', { auto_brim: 'outer_only', brim_ears: 'outer_only', painted: 'outer_only' }],
  only_one_wall_top: ['top_one_perimeter_type', { 0: 'none', 1: 'top' }],
  print_sequence: ['complete_objects', { 'by layer': '0', 'by object': '1' }],
  draft_shield: ['draft_shield', {}],
  wall_sequence: ['external_perimeters_first', { 'inner wall/outer wall': '0', 'outer wall/inner wall': '1', 'inner-outer-inner wall': '0' }],
  ensure_vertical_shell_thickness: ['ensure_vertical_shell_thickness', { none: 'disabled', ensure_critical_only: 'partial', ensure_moderate: 'partial', ensure_all: 'enabled' }],
};

const SUPPORT_STYLES: Record<string, string> = { grid: 'grid', snug: 'snug', organic: 'organic', tree_slim: 'organic', tree_strong: 'organic', tree_hybrid: 'organic' };
const PLATE_TEMPS: Record<string, string> = {
  'Cool Plate': 'cool_plate_temp', 'Engineering Plate': 'eng_plate_temp', 'High Temp Plate': 'hot_plate_temp',
  'Textured PEI Plate': 'textured_plate_temp', 'Supertack Plate': 'supertack_plate_temp', 'Textured Cool Plate': 'textured_cool_plate_temp',
};

// Orca gives line widths in % of the nozzle; PrusaSlicer reads % of the layer height, so they go as millimetres.
const WIDTHS = new Set(Object.values(RENAMES).filter((k) => k.endsWith('extrusion_width')));

/** Orca keys read together by `combined()`; listed so callers know they carry over. */
const COMBINED = new Set(['support_type', 'support_style', 'ironing_type']);

/** Filament slot data and the bed type travel with the chosen Prusa presets and colours. */
const IMPLIED = /^(filament_|default_filament_colour$|curr_bed_type$)/;

export const carriesToPrusa = (key: string) => IMPLIED.test(key) || key in RENAMES || key in VALUE_RENAMES || COMBINED.has(key) || Object.values(PLATE_TEMPS).some((t) => key.startsWith(t));

function combined(orca: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  const type = orca.support_type;
  if (type) out.support_material_auto = type.endsWith('(auto)') ? '1' : '0';
  const style = orca.support_style && SUPPORT_STYLES[orca.support_style];
  if (style) out.support_material_style = style;
  else if (type) out.support_material_style = type.startsWith('tree') ? 'organic' : 'grid';
  const ironing = orca.ironing_type;
  if (ironing) {
    out.ironing = ironing === 'no ironing' ? '0' : '1';
    if (ironing !== 'no ironing') out.ironing_type = ironing;
  }
  return out;
}

/**
 * Translates scalar Orca settings (global first values, or one object's / part's overrides) into PrusaSlicer keys.
 * Values outside `enums` (PrusaSlicer's accepted values per enum option) are left out, so the Prusa preset decides.
 */
export function toPrusaSettings(orca: Readonly<Record<string, string>>, enums: Readonly<Record<string, readonly string[]>>, nozzle: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(orca)) {
    const renamed = RENAMES[key];
    if (renamed) {
      out[renamed] = WIDTHS.has(renamed) && value.endsWith('%') ? String(Number((parseFloat(value) / 100 * nozzle).toFixed(4))) : value;
      continue;
    }
    const mapped = VALUE_RENAMES[key];
    if (mapped) out[mapped[0]] = mapped[1][value] ?? value;
  }
  const bed = PLATE_TEMPS[orca.curr_bed_type ?? ''] ?? 'hot_plate_temp';
  if (orca[bed]) out.bed_temperature = orca[bed]!;
  if (orca[`${bed}_initial_layer`]) out.first_layer_bed_temperature = orca[`${bed}_initial_layer`]!;
  return Object.fromEntries(Object.entries({ ...out, ...combined(orca) }).filter(([k, v]) => !enums[k] || enums[k]!.includes(v)));
}
