import { strToU8, zipSync } from 'fflate';

// A minimal Bambu Studio project: one 20 mm cube, half painted with filament 3, one triangle with painted supports,
// four filaments of which 2 and 4 are unused, laid out on a 256 mm bed.
const CUBE_VERTICES = [
  [-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0],
  [-10, -10, 20], [10, -10, 20], [10, 10, 20], [-10, 10, 20],
];
const CUBE_TRIANGLES = [
  [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
  [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
];

function subModel(): string {
  const vertices = CUBE_VERTICES.map(([x, y, z]) => `<vertex x="${x}" y="${y}" z="${z}"/>`).join('');
  const triangles = CUBE_TRIANGLES.map(([a, b, c], i) => {
    const paint = i < 6 ? ' paint_color="0C"' : '';
    const support = i === 11 ? ' paint_supports="4"' : '';
    return `<triangle v1="${a}" v2="${b}" v3="${c}"${paint}${support}/>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources>
  <object id="1" type="model"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>
 </resources>
</model>`;
}

const MAIN_MODEL = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">
 <metadata name="Application">BambuStudio-02.08.04.57</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="Title">Test cube</metadata>
 <resources>
  <object id="2" p:UUID="00000001-61cb-4c03-9d28-80fed5dfa1dc" type="model">
   <components>
    <component p:path="/3D/Objects/object_1.model" objectid="1" p:UUID="00010000-b206-40ff-9872-83e8017abed1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
   </components>
  </object>
 </resources>
 <build p:UUID="2c7c17d8-22b5-4d84-8835-1976022ea369">
  <item objectid="2" p:UUID="00000002-b1ec-4553-aec9-835e5b724bb4" transform="1 0 0 0 1 0 0 0 1 100 140 0" printable="1"/>
 </build>
</model>`;

const MODEL_SETTINGS = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="2">
    <metadata key="name" value="Cube"/>
    <metadata key="extruder" value="1"/>
    <metadata key="wall_loops" value="4"/>
    <metadata key="outer_wall_speed" value="150"/>
    <part id="1" subtype="normal_part">
      <metadata key="name" value="Cube"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
    </part>
  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value=""/>
    <metadata key="locked" value="false"/>
    <metadata key="filament_map_mode" value="Auto For Flush"/>
    <metadata key="filament_maps" value="1 1 1 1"/>
    <metadata key="gcode_file" value="Metadata/plate_1.gcode"/>
    <metadata key="thumbnail_file" value="Metadata/plate_1.png"/>
    <model_instance>
      <metadata key="object_id" value="2"/>
      <metadata key="instance_id" value="0"/>
      <metadata key="identify_id" value="77"/>
    </model_instance>
  </plate>
</config>
`;

export const SOURCE_CONFIG = {
  name: 'project_settings',
  from: 'project',
  version: '02.08.04.57',
  printer_settings_id: 'Bambu Lab X1 Carbon 0.4 nozzle',
  print_settings_id: '0.16mm Optimal @BBL X1C',
  filament_settings_id: ['Bambu PLA Basic @BBL X1C', 'Bambu PETG HF @BBL X1C', 'Bambu PLA Matte @BBL X1C', 'Bambu ABS @BBL X1C'],
  inherits_group: ['0.16mm Optimal @BBL X1C', '', '', '', '', 'Bambu Lab X1 Carbon 0.4 nozzle'],
  different_settings_to_system: ['wall_loops', '', '', '', '', ''],
  printable_area: ['0x0', '256x0', '256x256', '0x256'],
  printable_height: '250',
  nozzle_diameter: ['0.4'],
  machine_start_gcode: 'M1002 ; Bambu start',
  layer_height: '0.16',
  initial_layer_print_height: '0.2',
  wall_loops: '3',
  sparse_infill_density: '25%',
  sparse_infill_pattern: 'grid',
  top_surface_pattern: 'monotonicline',
  outer_wall_speed: ['200'],
  default_acceleration: ['10000'],
  enable_support: '0',
  support_type: 'tree(auto)',
  support_style: 'tree_organic',
  tree_support_wall_count: '-1',
  wall_filament: '1',
  enable_prime_tower: '1',
  prime_tower_width: '35',
  wipe_tower_x: ['165'],
  wipe_tower_y: ['216'],
  flush_volumes_matrix: ['0', '1', '2', '3', '4', '0', '6', '7', '8', '9', '0', '11', '12', '13', '14', '0'],
  flush_volumes_vector: ['140', '140', '141', '141', '142', '142', '143', '143'],
  flush_multiplier: ['1'],
  filament_colour: ['#FFFFFF', '#FF0000', '#00AE42', '#000000'],
  filament_type: ['PLA', 'PETG', 'PLA', 'ABS'],
  filament_flow_ratio: ['0.98', '0.95', '0.98', '0.95'],
  nozzle_temperature: ['220', '255', '300', '270'],
  nozzle_temperature_initial_layer: ['220', '255', '225', '270'],
  hot_plate_temp: ['55', '70', '55', '120'],
  textured_plate_temp: ['55', '70', '55', '100'],
  curr_bed_type: 'Textured PEI Plate',
  ams_drying_temperature: ['55', '65', '55', '80'],
  post_process: ['/usr/bin/evil.sh'],
};

export function bambuProject(overrides: Record<string, unknown> = {}, extra: Record<string, string> = {}): Uint8Array {
  const files: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
    '3D/3dmodel.model': MAIN_MODEL,
    '3D/_rels/3dmodel.model.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/Objects/object_1.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
    '3D/Objects/object_1.model': subModel(),
    'Metadata/project_settings.config': JSON.stringify({ ...SOURCE_CONFIG, ...overrides }, null, 4),
    'Metadata/model_settings.config': MODEL_SETTINGS,
    'Metadata/plate_1.gcode': 'G28 ; stale',
    'Metadata/slice_info.config': '<config/>',
    ...extra,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), { mtime: new Date('2001-01-01') });
}
