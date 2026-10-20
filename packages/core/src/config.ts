/** Slicer config as stored in Metadata/project_settings.config: every value is a string or a string list. */
export type ConfigValue = string | readonly string[];
export type Config = Record<string, ConfigValue>;

export function parseProjectConfig(text: string): Config {
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('project_settings.config is not a JSON object');
  const out: Config = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') out[key] = value;
    else if (Array.isArray(value)) out[key] = value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
    else out[key] = String(value);
  }
  return out;
}

export function serializeProjectConfig(config: Config): string {
  const sorted = Object.fromEntries(Object.keys(config).sort().map((k) => [k, config[k]]));
  return JSON.stringify(sorted, null, 4) + '\n';
}

export function asList(value: ConfigValue | undefined): readonly string[] {
  if (value === undefined) return [];
  return typeof value === 'string' ? [value] : value;
}

export function first(value: ConfigValue | undefined): string | undefined {
  return asList(value)[0];
}

export function sameValue(a: ConfigValue | undefined, b: ConfigValue | undefined): boolean {
  return JSON.stringify(asList(a)) === JSON.stringify(asList(b));
}
