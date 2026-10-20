import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { convert, inspect } from '../src/index.ts';
import { asList, type Config } from '../src/config.ts';
import { parsePrusaIni, translatePrusaConfig } from '../src/rules/prusa.ts';
import { getOptions } from '@retarget3mf/profiles';

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/prusa/${name}`, import.meta.url)));

describe('PrusaSlicer 2.x settings', () => {
  const translate = (ini: string) => translatePrusaConfig(parsePrusaIni(ini), getOptions('orca'));

  it('renames keys and splits vectors by the Orca type', () => {
    const c = translate('; perimeters = 3\n; fill_density = 20%\n; temperature = 215,230\n; filament_type = PLA;PETG\n; fill_pattern = stars');
    expect(c).toMatchObject({ wall_loops: '3', sparse_infill_density: '20%', nozzle_temperature: ['215', '230'], filament_type: ['PLA', 'PETG'], sparse_infill_pattern: 'tri-hexagon' });
  });

  it('resolves a percentage first layer and the support switches', () => {
    const c = translate('; layer_height = 0.2\n; first_layer_height = 150%\n; support_material = 1\n; support_material_auto = 0\n; support_material_style = organic');
    expect(c).toMatchObject({ initial_layer_print_height: '0.3', enable_support: '1', support_type: 'tree(manual)', support_style: 'organic' });
  });

  it('turns brim width 0 into no brim and bed temperature into every plate type', () => {
    const c = translate('; brim_width = 0\n; brim_type = outer_only\n; bed_temperature = 60,70');
    expect(c.brim_type).toBe('no_brim');
    expect(c.hot_plate_temp).toEqual(['60', '70']);
    expect(c.textured_plate_temp).toEqual(['60', '70']);
  });

  it('prefers extruder colours over filament colours', () => {
    expect(translate('; extruder_colour = #FF0000;\n; filament_colour = #00FF00;#0000FF').filament_colour).toEqual(['#FF0000', '#0000FF']);
  });
});

describe('PrusaSlicer 2.9 project → AD5X', () => {
  it('inspects as a Prusa project with five filaments', async () => {
    const info = await inspect(fixture('fdm_roundtrip1.3mf'));
    expect(info.source).toBe('prusa');
    expect(info.filaments).toHaveLength(5);
    expect(info.plates[0]?.thumbnail).toBeDefined();
  });

  it('keeps settings, splits volumes into parts and carries painting and per-Z changes', async () => {
    const { output, report } = await convert(fixture('fdm_roundtrip1.3mf'), { printer: 'ad5x-0.4', filamentMap: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4 } });
    const files = unzipSync(output);
    const text = (p: string) => strFromU8(files[p]!);
    const config = JSON.parse(text('Metadata/project_settings.config')) as Config;
    expect(report.source.kind).toBe('prusa');
    expect(config).toMatchObject({ layer_height: '0.15', wall_loops: '2', top_shell_layers: '6', sparse_infill_density: '15%', printer_settings_id: 'Flashforge AD5X 0.4 nozzle' });
    expect(asList(config.filament_colour)).toHaveLength(4);
    expect(asList(config.filament_is_support)).toHaveLength(4);
    expect(files['Metadata/Slic3r_PE.config']).toBeUndefined();
    const ms = text('Metadata/model_settings.config');
    expect(ms).toContain('subtype="negative_part"');
    expect(ms).toContain('key="brim_width" value="10"');
    expect(text('3D/Objects/object_1.model')).toContain('paint_fuzzy_skin="');
    expect(text('3D/Objects/object_1.model')).not.toContain('slic3rpe:');
    expect(text('Metadata/layer_config_ranges.xml')).toContain('<option opt_key="sparse_infill_pattern">');
    expect(text('Metadata/custom_gcode_per_layer.xml')).toMatch(/<layer top_z="15\.05\d*" type="0" extruder="2"/);
    expect(text('Metadata/custom_gcode_per_layer.xml')).toMatch(/extruder="4"/);
  });
});
