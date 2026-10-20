import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PRINTERS } from '@retarget3mf/core';
import type { Settings, SlicerKind } from '../shared/api.ts';

export const DEFAULT_SETTINGS: Settings = { slicer: 'flashstudio', slicerPaths: {}, output: 'next-to-original', openAfterConvert: true };
const SLICERS: readonly SlicerKind[] = ['flashstudio', 'orca'];

/** Keeps only known, well-typed fields; settings files are user-editable. */
export function sanitizeSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const paths = (r.slicerPaths && typeof r.slicerPaths === 'object' ? r.slicerPaths : {}) as Record<string, unknown>;
  const printer = PRINTERS.find((p) => p.id === r.printer)?.id ?? base.printer;
  return {
    ...(printer && { printer }),
    slicer: SLICERS.includes(r.slicer as SlicerKind) ? (r.slicer as SlicerKind) : base.slicer,
    slicerPaths: Object.fromEntries(SLICERS.flatMap((k) => (typeof paths[k] === 'string' ? [[k, paths[k]]] : base.slicerPaths[k] ? [[k, base.slicerPaths[k]]] : []))),
    output: r.output === 'app-folder' || r.output === 'next-to-original' ? r.output : base.output,
    openAfterConvert: typeof r.openAfterConvert === 'boolean' ? r.openAfterConvert : base.openAfterConvert,
  };
}

export function loadSettings(userData: string): Settings {
  try {
    return sanitizeSettings(JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8')));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(userData: string, settings: Settings): Promise<void> {
  await writeFile(join(userData, 'settings.json'), JSON.stringify(settings, null, 2));
}
