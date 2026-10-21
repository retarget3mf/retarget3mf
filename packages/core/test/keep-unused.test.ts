import { strFromU8, unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { convert } from '../src/index.ts';
import { bambuProject } from './fixtures.ts';

const colours = (output: Uint8Array) => (JSON.parse(strFromU8(unzipSync(output)['Metadata/project_settings.config']!)) as { filament_colour: string[] }).filament_colour;

it('keeps unused filaments in free slots when asked, and drops them by default', async () => {
  // The cube uses filaments 1 and 3 of four; the AD5X has four slots.
  expect(colours((await convert(bambuProject(), { printer: 'ad5x-0.4' })).output)).toEqual(['#FFFFFF', '#00AE42']);
  const kept = await convert(bambuProject(), { printer: 'ad5x-0.4', keepUnused: true });
  expect(colours(kept.output)).toEqual(['#FFFFFF', '#00AE42', '#FF0000', '#000000']);
  expect(kept.report.warnings.join(' ')).not.toMatch(/unused filament/);
  // A 1-slot printer has no room for them.
  expect(colours((await convert(bambuProject(), { printer: 'adventurer-5m-0.4', keepUnused: true, filamentMap: { 1: 1, 3: 1 } })).output)).toEqual(['#FFFFFF']);
});
