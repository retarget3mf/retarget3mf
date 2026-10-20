import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { convert, inspect, suggestFilamentMap } from '../src/index.ts';
import type { Config } from '../src/config.ts';
import { bambuProject } from './fixtures.ts';

describe('inspect', () => {
  it('lists filaments with usage and plates', async () => {
    const info = await inspect(bambuProject());
    expect(info.title).toBe('Test cube');
    expect(info.sourcePrinter).toBe('Bambu Lab X1 Carbon 0.4 nozzle');
    expect(info.filaments.map((f) => [f.index, f.used])).toEqual([[1, true], [2, false], [3, true], [4, false]]);
    expect(info.plates.map((p) => p.id)).toEqual([1]);
  });
});

describe('filament map', () => {
  it('merges colours onto one slot and renumbers paint', async () => {
    const { output, report } = await convert(bambuProject(), { printer: 'ad5x-0.4', filamentMap: { 1: 1, 3: 1 } });
    const files = unzipSync(output);
    const config = JSON.parse(strFromU8(files['Metadata/project_settings.config']!)) as Config;
    expect(config.filament_colour).toEqual(['#FFFFFF']);
    expect(strFromU8(files['3D/Objects/object_1.model']!)).toContain('paint_color="4"');
    expect(report.warnings.join(' ')).toMatch(/merged/);
  });

  it('can reorder slots', async () => {
    const { output } = await convert(bambuProject(), { printer: 'ad5x-0.4', filamentMap: { 1: 2, 3: 1 } });
    const config = JSON.parse(strFromU8(unzipSync(output)['Metadata/project_settings.config']!)) as Config;
    expect(config.filament_colour).toEqual(['#00AE42', '#FFFFFF']);
  });

  it('rejects incomplete or gapped maps with a user-facing error', async () => {
    await expect(convert(bambuProject(), { printer: 'ad5x-0.4', filamentMap: { 1: 1 } })).rejects.toMatchObject({ code: 'invalid-filament-map' });
    await expect(convert(bambuProject(), { printer: 'ad5x-0.4', filamentMap: { 1: 1, 3: 3 } })).rejects.toMatchObject({ code: 'invalid-filament-map' });
  });
});

describe('suggestFilamentMap', () => {
  it('merges the two closest colours first', () => {
    const map = suggestFilamentMap([
      { index: 1, colour: '#FFFFFF' }, { index: 2, colour: '#FF0000' }, { index: 3, colour: '#FE0101' },
      { index: 4, colour: '#000000' }, { index: 5, colour: '#0000FF' },
    ], 4);
    expect(map).toEqual({ 1: 1, 2: 2, 3: 2, 4: 3, 5: 4 });
  });

  it('is the identity when everything fits', () => {
    expect(suggestFilamentMap([{ index: 2, colour: '#000' }, { index: 7, colour: '#FFF' }], 4)).toEqual({ 2: 1, 7: 2 });
  });
});
