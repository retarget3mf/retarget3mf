import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { getOptions } from '@retarget3mf/profiles';
import { convert } from '../src/index.ts';
import type { Config } from '../src/config.ts';
import { bambuProject } from './fixtures.ts';

const settingsOf = (output: Uint8Array) => JSON.parse(strFromU8(unzipSync(output)['Metadata/project_settings.config']!)) as Config;

describe('Creality Print target', () => {
  it('uses Creality Print presets and only its option names', async () => {
    const { output, report } = await convert(bambuProject({ wall_filament: '3' }), { printer: 'creality-k2-plus-0.4', slicer: 'crealityprint' });
    const c = settingsOf(output);
    const options = getOptions('crealityprint');
    expect(Object.keys(c).filter((k) => !options[k] && !['name', 'from', 'version'].includes(k))).toEqual([]);
    expect(c).toMatchObject({ printer_settings_id: 'Creality K2 Plus 0.4 nozzle', print_settings_id: '0.20mm Standard @Creality K2 Plus 0.4 nozzle' });
    // Creality Print spells OrcaSlicer's outer_wall_filament_id the Bambu way; filament 3 became slot 2.
    expect(c.wall_filament).toBe('2');
    expect(c).not.toHaveProperty('outer_wall_filament_id');
    expect(report.target).toMatchObject({ slicer: 'Creality Print', profiles: expect.stringMatching(/^Creality Print /) });
  });

  it('names the machine as each slicer does', async () => {
    const own = settingsOf((await convert(bambuProject(), { printer: 'creality-k1-max-0.4', slicer: 'crealityprint' })).output);
    const orca = settingsOf((await convert(bambuProject(), { printer: 'creality-k1-max-0.4', slicer: 'orca' })).output);
    expect([own.printer_settings_id, orca.printer_settings_id]).toEqual(['Creality K1 Max 0.4 nozzle', 'Creality K1 Max (0.4 nozzle)']);
  });

  it('defaults Creality printers to Creality Print', async () => {
    const { report } = await convert(bambuProject(), { printer: 'creality-k1c-0.4' });
    expect(report.target.slicer).toBe('Creality Print');
  });
});
