import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { getOptions } from '@retarget3mf/profiles';
import { convert } from '../src/index.ts';
import { asList, type Config } from '../src/config.ts';
import { toBambuValue } from '../src/targets/bambuStudio.ts';
import { bambuProject } from './fixtures.ts';

const prusa = () => new Uint8Array(readFileSync(new URL('./fixtures/prusa/wipe_tower.3mf', import.meta.url)));
const settingsOf = (output: Uint8Array) => JSON.parse(strFromU8(unzipSync(output)['Metadata/project_settings.config']!)) as Config;

describe('Bambu Lab targets', () => {
  it('writes a Bambu Studio project in its own option names and shapes', async () => {
    const { output, report } = await convert(prusa(), { printer: 'bambu-x1c-0.4', slicer: 'bambustudio' });
    const c = settingsOf(output);
    const options = getOptions('bambustudio');
    expect(Object.keys(c).filter((k) => !options[k] && !['name', 'from', 'version'].includes(k))).toEqual([]);
    expect(c.printer_settings_id).toBe('Bambu Lab X1 Carbon 0.4 nozzle');
    expect(c.print_settings_id).toBe('0.20mm Standard @BBL X1C');
    expect(c.machine_start_gcode).toContain('M1002');
    // X1C process speeds are per extruder variant (Standard, High Flow).
    expect(asList(c.outer_wall_speed)).toHaveLength(2);
    const n = asList(c.filament_colour).length;
    expect(c.filament_self_index).toEqual(Array.from({ length: n }, (_, i) => String(i + 1)));
    expect(asList(c.filament_extruder_variant)).toEqual(Array(n).fill('Direct Drive Standard'));
    expect(report.target).toMatchObject({ slicer: 'Bambu Studio', printer: 'Bambu Lab X1 Carbon' });
  });

  it('keeps author settings under Bambu names and lists them for the preset re-base', async () => {
    const { output } = await convert(bambuProject({ support_style: 'tree_organic', wall_loops: '4' }), { printer: 'bambu-a1-mini-0.4', slicer: 'bambustudio' });
    const c = settingsOf(output);
    expect(c).toMatchObject({ wall_loops: '4', support_style: 'tree_organic', wall_filament: '1', printer_settings_id: 'Bambu Lab A1 mini 0.4 nozzle' });
    expect(asList(c.different_settings_to_system)[0]!.split(';')).toEqual(expect.arrayContaining(['wall_loops', 'support_style']));
  });

  it('writes OrcaSlicer projects for Bambu printers from Orca presets', async () => {
    const { output } = await convert(prusa(), { printer: 'bambu-p2s-0.4', slicer: 'orca' });
    expect(settingsOf(output)).toMatchObject({ printer_settings_id: 'Bambu Lab P2S 0.4 nozzle', print_settings_id: '0.20mm Standard @BBL P2S' });
  });

  it('indexes every filament row for OrcaSlicer too (else all filaments read row 1)', async () => {
    const c = settingsOf((await convert(bambuProject(), { printer: 'bambu-x1c-0.4', slicer: 'orca' })).output);
    expect(c.filament_self_index).toEqual(['1', '2']);
    expect(c.filament_extruder_variant).toEqual(['Direct Drive Standard', 'Direct Drive Standard']);
  });

  it('defaults to the printer\'s own slicer and refuses one without its profiles', async () => {
    const { report } = await convert(prusa(), { printer: 'bambu-a1-0.4' });
    expect(report.target.slicer).toBe('Bambu Studio');
    await expect(convert(prusa(), { printer: 'bambu-a1-0.4', slicer: 'flashstudio' })).rejects.toThrow(/Flash Studio has no profiles/);
    await expect(convert(prusa(), { printer: 'ad5x-0.4', slicer: 'bambustudio' })).rejects.toThrow(/Bambu Studio has no profiles/);
  });

  it('maps OrcaSlicer names and values to Bambu Studio', () => {
    expect(toBambuValue('sparse_infill_pattern', 'rectilinear')).toEqual(['sparse_infill_pattern', 'zig-zag']);
    expect(toBambuValue('ensure_vertical_shell_thickness', 'ensure_moderate')).toEqual(['ensure_vertical_shell_thickness', 'partial']);
    expect(toBambuValue('outer_wall_filament_id', '0')).toEqual(['wall_filament', '1']);
    expect(toBambuValue('only_one_wall_top', '1')).toEqual(['top_one_wall_type', 'all top']);
    expect(toBambuValue('infill_anchor', '400%')).toEqual(['sparse_infill_anchor', '400%']);
  });
});
