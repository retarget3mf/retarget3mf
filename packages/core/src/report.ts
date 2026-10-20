import type { ConfigValue } from './config.ts';

export type SettingOutcome = 'kept' | 'replaced' | 'dropped' | 'clamped' | 'translated';

export interface SettingChange {
  key: string;
  outcome: SettingOutcome;
  from?: ConfigValue;
  to?: ConfigValue;
  reason: string;
}

export interface FilamentSummary { from: number; to: number; type: string; colour: string; preset: string }
export interface PlateSummary { id: number; objects: number; fits: boolean; shift: [number, number] }

export interface ConversionReport {
  source: { kind: 'bambu' | 'prusa'; application: string; printer: string };
  target: { printer: string; slicer: string; profiles: string };
  warnings: string[];
  filaments: FilamentSummary[];
  plates: PlateSummary[];
  settings: SettingChange[];
}

const fmt = (v: ConfigValue | undefined): string => {
  if (v === undefined) return '';
  const s = typeof v === 'string' ? v : v.join('; ');
  return (s.length > 60 ? `${s.slice(0, 57)}...` : s).replace(/\|/g, '\\|').replace(/\n/g, '↵');
};

export function reportToMarkdown(r: ConversionReport): string {
  const lines = [
    `# Conversion report`,
    ``,
    `- Source: ${r.source.kind} (${r.source.application}), printer "${r.source.printer}"`,
    `- Target: ${r.target.printer} for ${r.target.slicer} (profiles ${r.target.profiles})`,
    ``,
  ];
  if (r.warnings.length) lines.push(`## Warnings`, ``, ...r.warnings.map((w) => `- ${w}`), ``);
  lines.push(`## Filaments`, ``, `| Source slot | Target slot | Type | Colour | Preset |`, `|---|---|---|---|---|`);
  lines.push(...r.filaments.map((f) => `| ${f.from} | ${f.to} | ${f.type} | ${f.colour} | ${f.preset} |`), ``);
  lines.push(`## Plates`, ``, `| Plate | Objects | Fits | Shift (mm) |`, `|---|---|---|---|`);
  lines.push(...r.plates.map((p) => `| ${p.id} | ${p.objects} | ${p.fits ? 'yes' : '**no**'} | ${p.shift.map((n) => n.toFixed(1)).join(', ')} |`), ``);
  const order: SettingOutcome[] = ['clamped', 'translated', 'kept', 'replaced', 'dropped'];
  for (const outcome of order) {
    const rows = r.settings.filter((s) => s.outcome === outcome);
    if (!rows.length) continue;
    lines.push(`## ${outcome[0]!.toUpperCase()}${outcome.slice(1)} (${rows.length})`, ``, `| Setting | From | To | Why |`, `|---|---|---|---|`);
    lines.push(...rows.map((s) => `| \`${s.key}\` | ${fmt(s.from)} | ${fmt(s.to)} | ${s.reason} |`), ``);
  }
  return lines.join('\n');
}
