import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { convert } from '../src/index.ts';
import { asList, type Config } from '../src/config.ts';
import { bambuProject } from './fixtures.ts';

async function run(printer: 'creator-5-0.4' | 'creator-5-pro-0.4', slicer: 'orca' | 'flashstudio' = 'flashstudio') {
  const { output, report } = await convert(bambuProject(), { printer, slicer });
  const files = unzipSync(output);
  return { report, config: JSON.parse(strFromU8(files['Metadata/project_settings.config']!)) as Config, text: (p: string) => strFromU8(files[p]!) };
}

describe('Creator 5 (four independent toolheads)', () => {
  it('writes one filament per toolhead and maps filament i to toolhead i', async () => {
    const { config, text, report } = await run('creator-5-0.4');
    expect(config.printer_settings_id).toBe('Flashforge Creator 5 0.4 nozzle');
    expect(asList(config.nozzle_diameter)).toHaveLength(4);
    expect(asList(config.filament_colour)).toEqual(['#FFFFFF', '#00AE42', '#FFFFFF', '#FFFFFF']);
    expect(asList(config.filament_settings_id)).toHaveLength(4);
    expect(asList(config.inherits_group)).toHaveLength(6);
    expect(text('Metadata/model_settings.config')).toContain('key="filament_maps" value="1 2 3 4"');
    expect(report.filaments.map((f) => f.to)).toEqual([1, 2]);
  });

  it('keeps multi-colour settings such as the prime tower and centres on the 256 mm bed', async () => {
    const { config, text } = await run('creator-5-pro-0.4');
    expect(config.enable_prime_tower).toBe('1');
    expect(text('3D/3dmodel.model')).toContain('transform="1 0 0 0 1 0 0 0 1 128 128 0"');
  });

  it('works for OrcaSlicer too', async () => {
    const { config } = await run('creator-5-0.4', 'orca');
    expect(config.filament_map).toEqual(['1', '2', '3', '4']);
  });
});
