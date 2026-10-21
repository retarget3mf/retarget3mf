import type { OptionInfo } from '@retarget3mf/profiles';
import { asList, type Config, type ConfigValue } from '../config.ts';
import type { SettingChange } from '../report.ts';
import { BAMBU_VALUES, toBambuKey } from './bambuStudio.ts';

// Written for every target; not slicer options.
const META = new Set(['name', 'from', 'version']);

/**
 * Rewrites an OrcaSlicer-space project for an OrcaSlicer-based vendor slicer (Creality Print). Its presets were the
 * baseline already; here only the settings it spells the Bambu way (wall_filament for outer_wall_filament_id) are
 * renamed, and enum values it does not accept are mapped when it knows the Bambu name.
 */
export function toOwnSlicer(config: Config, options: Readonly<Record<string, OptionInfo>>): { config: Config; changes: SettingChange[] } {
  const out: Config = {};
  const changes: SettingChange[] = [];
  const keyFor = (key: string) => (options[key] ? key : options[toBambuKey(key)] ? toBambuKey(key) : undefined);
  for (const [key, value] of Object.entries(config)) {
    if (META.has(key)) { out[key] = value; continue; }
    const target = keyFor(key);
    if (!target) continue;
    const accepted = options[target]!.values;
    const table = BAMBU_VALUES[target];
    const fix = (v: string) => (accepted && !accepted.includes(v) && table?.[v] && accepted.includes(table[v]!) ? table[v]! : v);
    const next: ConfigValue = typeof value === 'string' ? fix(value) : value.map(fix);
    if (target !== key || JSON.stringify(next) !== JSON.stringify(value)) changes.push({ key, outcome: 'translated', reason: `written as ${target}`, from: value, to: next });
    out[target] = next;
  }
  out.different_settings_to_system = asList(config.different_settings_to_system).map((list) =>
    list.split(';').filter(Boolean).map((k) => keyFor(k)).filter((k): k is string => Boolean(k)).join(';'));
  return { config: out, changes };
}
