import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { getTargetProfiles, type Preset, type PrinterId, type SlicerId } from '@retarget3mf/profiles';
import { convert } from '../src/index.ts';
import { asList, first, sameValue, type Config, type ConfigValue } from '../src/config.ts';
import { PRESET_META } from '../src/rules/index.ts';
import { bambuProject } from './fixtures.ts';

const fixture = (path: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${path}`, import.meta.url)));

/**
 * What the slicer GUI does on load (docs/research.md §1): every preset key not listed in different_settings_to_system
 * is replaced by the installed system preset's value; per-filament keys slot by slot.
 */
function rebase(config: Config, printer: PrinterId, slicer: SlicerId): Config {
  const target = getTargetProfiles(printer);
  const presets = slicer === 'bambustudio' ? target.native! : target;
  const machine = slicer === 'bambustudio' ? target.native!.machine : target.machine;
  const diff = asList(config.different_settings_to_system).map((l) => new Set(l.split(';')));
  const out: Config = { ...config };
  const apply = (preset: Preset | undefined, listed: Set<string>) => {
    for (const [k, v] of Object.entries(preset ?? {})) if (!PRESET_META.has(k) && k in config && !listed.has(k)) out[k] = v as ConfigValue;
  };
  apply(machine, diff.at(-1) ?? new Set());
  apply(presets.processes[first(config.print_settings_id)!], diff[0] ?? new Set());
  asList(config.filament_settings_id).forEach((name, i) => {
    for (const [k, v] of Object.entries(presets.filaments[name] ?? {})) {
      if (PRESET_META.has(k) || !Array.isArray(out[k]) || diff[i + 1]?.has(k)) continue;
      out[k] = asList(out[k]).map((x, j) => (j === i ? first(v as ConfigValue)! : x));
    }
  });
  return out;
}

const CASES: [string, () => Uint8Array, PrinterId, SlicerId][] = [
  ['Bambu cube', bambuProject, 'ad5x-0.4', 'flashstudio'],
  ['Bambu cube', bambuProject, 'creator-5-0.4', 'orca'],
  ['Bambu cube', bambuProject, 'bambu-a1-mini-0.4', 'bambustudio'],
  ['Prusa wipe tower', () => fixture('prusa/wipe_tower.3mf'), 'adventurer-5m-pro-0.4', 'orca'],
  ['Prusa wipe tower', () => fixture('prusa/wipe_tower.3mf'), 'bambu-x1c-0.4', 'bambustudio'],
  ['Creality multicolour', () => fixture('creality/creality-print-7-multicolor.3mf'), 'ad5x-0.4', 'orca'],
  ['Creality multicolour', () => fixture('creality/creality-print-7-multicolor.3mf'), 'bambu-p1s-0.4', 'orca'],
];

describe('author settings survive the slicer re-basing the project on its presets', () => {
  it.each(CASES)('%s → %s (%s)', async (_name, input, printer, slicer) => {
    const { output, report } = await convert(input(), { printer, slicer });
    const config = JSON.parse(strFromU8(unzipSync(output)['Metadata/project_settings.config']!)) as Config;
    const effective = rebase(config, printer, slicer);
    const promised = report.settings.filter((s) => ['kept', 'clamped'].includes(s.outcome) && !s.key.includes(':') && s.key in config);
    expect(promised.length).toBeGreaterThan(0);
    const lost = promised.filter((s) => !sameValue(effective[s.key], config[s.key])).map((s) => `${s.key}: ${JSON.stringify(config[s.key])} → ${JSON.stringify(effective[s.key])}`);
    expect(lost).toEqual([]);
  });
});
