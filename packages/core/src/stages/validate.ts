import type { OptionInfo } from '@retarget3mf/profiles';
import { asList, type Config } from '../config.ts';
import { ruleFor } from '../rules/index.ts';

/** Structural checks the slicer enforces on load; a failure here is a converter bug, not a user error. */
export function validateConfig(config: Config, options: Readonly<Record<string, OptionInfo>>): string[] {
  const n = asList(config.filament_colour).length;
  const problems: string[] = [];
  if (n === 0) problems.push('filament_colour is empty');
  for (const [key, value] of Object.entries(config)) {
    if (ruleFor(key)?.section === 'filament' && typeof value !== 'string' && value.length !== n) {
      problems.push(`${key} has ${value.length} values for ${n} filaments`);
    }
    if (!options[key] && !['name', 'from', 'version'].includes(key)) problems.push(`${key} is not a setting of the target slicer`);
  }
  for (const key of ['filament_settings_id', 'filament_ids', 'filament_map']) {
    if (config[key] !== undefined && asList(config[key]).length !== n) problems.push(`${key} length != ${n}`);
  }
  if (asList(config.inherits_group).length !== n + 2) problems.push('inherits_group length != filaments + 2');
  if (asList(config.different_settings_to_system).length !== n + 2) problems.push('different_settings_to_system length != filaments + 2');
  if (asList(config.flush_volumes_matrix).length !== n * n * asList(config.flush_multiplier).length) problems.push('flush_volumes_matrix size mismatch');
  return problems;
}
