import { strFromU8, unzipSync, zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { getTargetProfiles, type Preset } from '@retarget3mf/profiles';
import { convert, ConversionError, reportToMarkdown } from '../src/index.ts';
import { asList, first, type Config } from '../src/config.ts';
import { bambuProject } from './fixtures.ts';

async function run(printer: 'ad5x-0.4' | 'adventurer-5m-0.4' = 'ad5x-0.4', overrides = {}) {
  const result = await convert(bambuProject(overrides), { printer });
  const files = unzipSync(result.output);
  const text = (p: string) => strFromU8(files[p]!);
  const config = JSON.parse(text('Metadata/project_settings.config')) as Config;
  return { ...result, files, text, config };
}

/**
 * What the slicer GUI shows after opening the project: every key not listed in different_settings_to_system
 * falls back to the installed system preset (OrcaSlicer@v2.4.2:src/libslic3r/Preset.cpp:2522-2535).
 */
function effectiveAfterRebase(config: Config, preset: Preset, slot: number, key: string): string | undefined {
  const listed = asList(config.different_settings_to_system)[slot]!.split(';');
  if (listed.includes(key) || preset[key] === undefined) return first(config[key]);
  return first(preset[key]);
}

describe('convert: Bambu project → AD5X', () => {
  it('targets the AD5X system presets by exact name', async () => {
    const { config } = await run();
    expect(config.printer_settings_id).toBe('Flashforge AD5X 0.4 nozzle');
    expect(config.print_settings_id).toBe('0.20mm Standard @FF AD5X');
    expect(config.inherits_group).toEqual(['0.20mm Standard @FF AD5X', 'Flashforge PLA Basic @FF AD5X', 'Flashforge PLA Basic @FF AD5X', 'Flashforge AD5X 0.4 nozzle']);
    expect(config.printable_area).toEqual(['0x0', '220x0', '220x220', '0x220']);
    expect(config.machine_start_gcode).not.toContain('M1002');
  });

  it('keeps author settings through the slicer re-base onto installed presets', async () => {
    const { config, report } = await run();
    const process = getTargetProfiles('ad5x-0.4').processes['0.20mm Standard @FF AD5X']!;
    expect(effectiveAfterRebase(config, process, 0, 'layer_height')).toBe('0.16');
    expect(effectiveAfterRebase(config, process, 0, 'wall_loops')).toBe('3');
    expect(effectiveAfterRebase(config, process, 0, 'sparse_infill_density')).toBe('25%');
    // Every setting the report calls "kept" must actually survive.
    const keptPrint = report.settings.filter((s) => s.outcome === 'kept' && process[s.key] !== undefined);
    for (const s of keptPrint) expect(effectiveAfterRebase(config, process, 0, s.key), s.key).toBe(first(config[s.key]));
  });

  it('drops speeds and Bambu-only keys, never carries post-processing scripts', async () => {
    const { config, report } = await run();
    const process = getTargetProfiles('ad5x-0.4').processes['0.20mm Standard @FF AD5X']!;
    expect(config.outer_wall_speed).toEqual(process.outer_wall_speed);
    expect(config.ams_drying_temperature).toBeUndefined();
    expect(asList(config.post_process).join('')).not.toContain('evil');
    expect(report.settings.find((s) => s.key === 'outer_wall_speed')?.outcome).toBe('dropped');
  });

  it('removes unused filaments and renumbers paint, colours and flush volumes', async () => {
    const { config, text, report } = await run();
    expect(config.filament_colour).toEqual(['#FFFFFF', '#00AE42']);
    expect(config.flush_volumes_matrix).toEqual(['0', '2', '8', '0']);
    expect(config.flush_volumes_vector).toEqual(['140', '140', '142', '142']);
    expect(text('3D/Objects/object_1.model')).toContain('paint_color="8"');
    expect(text('3D/Objects/object_1.model')).not.toContain('paint_color="0C"');
    expect(report.filaments.map((f) => [f.from, f.to])).toEqual([[1, 1], [3, 2]]);
    expect(text('Metadata/model_settings.config')).toContain('key="filament_maps" value="1 1"');
  });

  it('clamps temperatures to the target filament and printer limits', async () => {
    const { config, report } = await run();
    const pla = getTargetProfiles('ad5x-0.4').filaments['Flashforge PLA Basic @FF AD5X']!;
    const high = Number(first(pla.nozzle_temperature_range_high));
    expect(asList(config.nozzle_temperature).map(Number)).toEqual([220, Math.min(300, high)]);
    expect(report.settings.some((s) => s.key === 'nozzle_temperature' && s.outcome === 'clamped')).toBe(true);
  });

  it('replaces values the slicer would reject, turns on supports for painted supports', async () => {
    const { config, report } = await run();
    expect(config.tree_support_wall_count).not.toBe('-1');
    expect(config.support_style).toBe('organic');
    expect(config.enable_support).toBe('1');
    expect(report.warnings.join(' ')).toMatch(/painted supports/);
  });

  it('centres the layout on the target bed and moves the prime tower with it', async () => {
    const { text, config, report } = await run();
    // Cube centred at (100,140) on the Bambu bed → AD5X bed centre (110,110).
    expect(text('3D/3dmodel.model')).toContain('transform="1 0 0 0 1 0 0 0 1 110 110 0"');
    expect(report.plates).toEqual([{ id: 1, objects: 1, fits: true, shift: [10, -30] }]);
    expect(Number(first(config.wipe_tower_x))).toBeLessThanOrEqual(220 - 35 - 5);
  });

  it('removes stale slice results and marks the file for OrcaSlicer', async () => {
    const { files, text } = await run();
    expect(files['Metadata/plate_1.gcode']).toBeUndefined();
    expect(files['Metadata/slice_info.config']).toBeUndefined();
    expect(text('Metadata/model_settings.config')).not.toContain('gcode_file');
    expect(text('Metadata/model_settings.config')).toContain('key="thumbnail_file"');
    expect(text('3D/3dmodel.model')).toContain('<metadata name="Application">BambuStudio-2.3.0</metadata>');
    expect(text('3D/3dmodel.model')).toContain('<metadata name="OrcaSlicer">2.4.2</metadata>');
  });

  it('filters per-object settings with the same rules', async () => {
    const { text } = await run();
    const ms = text('Metadata/model_settings.config');
    expect(ms).toContain('key="wall_loops" value="4"');
    expect(ms).not.toContain('outer_wall_speed');
  });

  it('is byte-for-byte deterministic', async () => {
    const a = await convert(bambuProject(), { printer: 'ad5x-0.4' });
    const b = await convert(bambuProject(), { printer: 'ad5x-0.4' });
    expect(a.output).toEqual(b.output);
  });

  it('produces a stable report (golden)', async () => {
    const { report } = await run();
    expect(reportToMarkdown(report)).toMatchSnapshot();
  });
});

describe('convert: single-filament target', () => {
  it('uses the centre-origin bed of the Adventurer 5M and turns the prime tower off', async () => {
    const { config, text, report } = await run('adventurer-5m-0.4');
    expect(config.printer_settings_id).toBe('Flashforge Adventurer 5M 0.4 Nozzle');
    expect(text('3D/3dmodel.model')).toContain('transform="1 0 0 0 1 0 0 0 1 0 0 0"');
    expect(config.enable_prime_tower).toBe('0');
    expect(report.warnings[0]).toMatch(/uses 2 filaments but the Flashforge Adventurer 5M has 1 slot/);
  });
});

describe('convert: errors explain what to do', () => {
  const expectCode = async (input: Uint8Array, code: string) => {
    const err = await convert(input, { printer: 'ad5x-0.4' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConversionError);
    expect((err as ConversionError).code).toBe(code);
  };

  it('rejects non-zip input', () => expectCode(strToU8('hello'), 'not-a-zip'));
  it('rejects geometry-only 3MF', () => expectCode(zipSync({ '3D/3dmodel.model': strToU8('<model/>') }), 'not-a-project'));
  it('rejects PrusaSlicer 3.0 projects for now', () => expectCode(zipSync({ '3D/3dmodel.model': strToU8('<model/>'), 'Metadata/PrusaSlicer3_project.json': strToU8('{}') }), 'unsupported-source'));
  it('explains a project without a bed size', () => expectCode(zipSync({ '3D/3dmodel.model': strToU8('<model/>'), 'Metadata/Slic3r_PE.config': strToU8('') }), 'invalid-project'));
  it('rejects unknown printers', () => expect(convert(bambuProject(), { printer: 'x' as never })).rejects.toThrow(/Unknown printer/));
});

describe('convert: review regressions', () => {
  it('keeps numeric character references in object names intact', async () => {
    const name = 'Ben&apos;s &#10; caf&#233;';
    const input = bambuProject({}, {});
    const files = unzipSync(input);
    files['Metadata/model_settings.config'] = strToU8(strFromU8(files['Metadata/model_settings.config']!).replace('value="Cube"/>', `value="${name}"/>`));
    const { output } = await convert(zipSync(files), { printer: 'ad5x-0.4' });
    expect(strFromU8(unzipSync(output)['Metadata/model_settings.config']!)).toContain(`value="${name}"`);
  });

  it('applies slicer value fixes and translations to per-object overrides', async () => {
    const files = unzipSync(bambuProject());
    files['Metadata/model_settings.config'] = strToU8(strFromU8(files['Metadata/model_settings.config']!)
      .replace('<metadata key="wall_loops" value="4"/>', '<metadata key="wall_loops" value="4"/><metadata key="sparse_infill_pattern" value="rectilinear"/><metadata key="support_style" value="tree_organic"/>'));
    const { output, report } = await convert(zipSync(files), { printer: 'ad5x-0.4' });
    const ms = strFromU8(unzipSync(output)['Metadata/model_settings.config']!);
    expect(ms).toContain('key="sparse_infill_pattern" value="zig-zag"');
    expect(ms).toContain('key="support_style" value="organic"');
    expect(report.settings.some((s) => s.key === 'object "Cube": outer_wall_speed' && s.outcome === 'dropped')).toBe(true);
  });

  it('does not force supports on for empty paint_supports attributes', async () => {
    const files = unzipSync(bambuProject());
    files['3D/Objects/object_1.model'] = strToU8(strFromU8(files['3D/Objects/object_1.model']!).replace('paint_supports="4"', 'paint_supports=""'));
    const { output } = await convert(zipSync(files), { printer: 'ad5x-0.4' });
    const config = JSON.parse(strFromU8(unzipSync(output)['Metadata/project_settings.config']!)) as Config;
    expect(config.enable_support).toBe('0');
  });

  it('clears paint for filaments the project never prints with, instead of failing', async () => {
    const files = unzipSync(bambuProject());
    // A support blocker painted with filament 4: it never prints, so filament 4 is dropped.
    files['Metadata/model_settings.config'] = strToU8(strFromU8(files['Metadata/model_settings.config']!)
      .replace('</part>', '</part><part id="9" subtype="support_blocker"><metadata key="name" value="b"/></part>'));
    files['3D/Objects/object_1.model'] = strToU8(strFromU8(files['3D/Objects/object_1.model']!)
      .replace('</resources>', '<object id="9" type="other"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices><triangles><triangle v1="0" v2="1" v3="2" paint_color="1C"/></triangles></mesh></object></resources>'));
    files['3D/3dmodel.model'] = strToU8(strFromU8(files['3D/3dmodel.model']!)
      .replace('</components>', '<component p:path="/3D/Objects/object_1.model" objectid="9" transform="1 0 0 0 1 0 0 0 1 0 0 0"/></components>'));
    const { output, report } = await convert(zipSync(files), { printer: 'ad5x-0.4' });
    expect(strFromU8(unzipSync(output)['3D/Objects/object_1.model']!)).toContain('paint_color="0"');
    expect(report.warnings.join(' ')).toMatch(/Paint for filament\(s\) 4/);
  });
});
