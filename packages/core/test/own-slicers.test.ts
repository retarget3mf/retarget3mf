import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { getOptions, type PrinterId, type SlicerId } from '@retarget3mf/profiles';
import { convert } from '../src/index.ts';
import type { Config } from '../src/config.ts';
import { bambuProject } from './fixtures.ts';

const settingsOf = (output: Uint8Array) => JSON.parse(strFromU8(unzipSync(output)['Metadata/project_settings.config']!)) as Config;
const creality = () => new Uint8Array(readFileSync(new URL('./fixtures/creality/creality-print-7-multicolor.3mf', import.meta.url)));

const CASES: [SlicerId, PrinterId, string, string][] = [
  ['qidistudio', 'qidi-plus4-0.4', 'X-Plus 4 0.4 nozzle', 'QIDI Studio'],
  ['qidistudio', 'qidi-q1-pro-0.4', 'Q1 Pro 0.4 nozzle', 'QIDI Studio'],
  ['elegooslicer', 'elegoo-centauri-carbon-0.4', 'Elegoo Centauri Carbon 0.4 nozzle', 'ElegooSlicer'],
];

describe.each(CASES)('%s for %s', (slicer, printer, machine, name) => {
  it('uses its own presets and option names, and is its default slicer', async () => {
    const { output, report } = await convert(bambuProject(), { printer });
    const c = settingsOf(output);
    const options = getOptions(slicer);
    expect(report.target.slicer).toBe(name);
    expect(c.printer_settings_id).toBe(machine);
    expect(Object.keys(c).filter((k) => !options[k] && !['name', 'from', 'version'].includes(k))).toEqual([]);
  });

  it('drops percentages where the slicer only takes millimetres', async () => {
    const c = settingsOf((await convert(creality(), { printer, slicer })).output);
    const options = getOptions(slicer);
    const percentInNumberOnly = Object.entries(c).filter(([k, v]) => !options[k]?.type.includes('Percent') && /^co(Float|Int)s?$/.test(options[k]?.type ?? '') && [v].flat().some((x) => x.endsWith('%')));
    expect(percentInNumberOnly).toEqual([]);
  });
});

it('stamps ElegooSlicer projects with its own 1.x version, which its CLI requires', async () => {
  const { output } = await convert(bambuProject(), { printer: 'elegoo-neptune-4-pro-0.4' });
  expect(strFromU8(unzipSync(output)['3D/3dmodel.model']!)).toContain('<metadata name="Application">ElegooSlicer-1.5.3.5</metadata>');
});
