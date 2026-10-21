import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PRINTERS, type PrinterId } from '@retarget3mf/core';
import { ACCENTS } from '@retarget3mf/ui/accent';
import type { Accent, DropTarget, OpenMode, SavedPrinter, Settings, SlicerKind, Theme } from '../shared/api.ts';

export const DEFAULT_SETTINGS: Settings = {
  slicer: 'flashstudio', printers: [], dropTarget: 'last', autoCombine: false,
  slicerPaths: {}, output: 'next-to-original', openAfterConvert: true, theme: 'system', accent: 'lime', openMode: 'auto',
};
const SLICERS: readonly SlicerKind[] = ['flashstudio', 'orca', 'bambustudio', 'crealityprint', 'qidistudio', 'elegooslicer', 'prusaslicer'];
const THEMES: readonly Theme[] = ['system', 'light', 'dark'];
const OPEN_MODES: readonly OpenMode[] = ['auto', 'review'];
const DROP_TARGETS: readonly DropTarget[] = ['last', 'default', 'ask'];

/** A printer only converts for slicers that ship its profiles. */
const slicerFor = (model: PrinterId, slicer: unknown): SlicerKind => {
  const allowed = PRINTERS.find((p) => p.id === model)!.slicers;
  return allowed.includes(slicer as SlicerKind) ? (slicer as SlicerKind) : allowed[0]!;
};

function savedPrinters(raw: unknown): SavedPrinter[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((p: unknown) => {
    const r = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    const model = PRINTERS.find((x) => x.id === r.model)?.id;
    if (!model || seen.has(model)) return [];
    seen.add(model);
    return [{ model, slicer: slicerFor(model, r.slicer) }];
  });
}

/** Keeps only known, well-typed fields; settings files are user-editable. */
export function sanitizeSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const paths = (r.slicerPaths && typeof r.slicerPaths === 'object' ? r.slicerPaths : {}) as Record<string, unknown>;
  const printer = PRINTERS.find((p) => p.id === r.printer) ?? PRINTERS.find((p) => p.id === base.printer);
  const requested = SLICERS.includes(r.slicer as SlicerKind) ? (r.slicer as SlicerKind) : base.slicer;
  const slicer = printer ? slicerFor(printer.id, requested) : requested;
  // The current printer is always saved, with the slicer just chosen for it (files from before multi-printer support have no list).
  const listed = savedPrinters(r.printers ?? base.printers);
  const printers = !printer ? listed
    : listed.some((p) => p.model === printer.id) ? listed.map((p) => (p.model === printer.id ? { model: p.model, slicer } : p))
    : [...listed, { model: printer.id, slicer }];
  const defaultPrinter = printers.find((p) => p.model === (r.defaultPrinter ?? base.defaultPrinter))?.model ?? printers[0]?.model;
  return {
    ...(printer && { printer: printer.id }),
    slicer,
    printers,
    ...(defaultPrinter && { defaultPrinter }),
    dropTarget: DROP_TARGETS.includes(r.dropTarget as DropTarget) ? (r.dropTarget as DropTarget) : base.dropTarget,
    autoCombine: typeof r.autoCombine === 'boolean' ? r.autoCombine : base.autoCombine,
    slicerPaths: Object.fromEntries(SLICERS.flatMap((k) => (typeof paths[k] === 'string' ? [[k, paths[k]]] : base.slicerPaths[k] ? [[k, base.slicerPaths[k]]] : []))),
    output: r.output === 'app-folder' || r.output === 'next-to-original' ? r.output : base.output,
    openAfterConvert: typeof r.openAfterConvert === 'boolean' ? r.openAfterConvert : base.openAfterConvert,
    theme: THEMES.includes(r.theme as Theme) ? (r.theme as Theme) : base.theme,
    accent: ACCENTS.includes(r.accent as Accent) ? (r.accent as Accent) : base.accent,
    openMode: OPEN_MODES.includes(r.openMode as OpenMode) ? (r.openMode as OpenMode) : base.openMode,
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

/** The saved printer a dropped or OS-opened file is converted for; undefined when the user wants to be asked. */
export function dropPrinter(settings: Settings): SavedPrinter | undefined {
  if (settings.dropTarget === 'ask' && settings.printers.length > 1) return undefined;
  const model = settings.dropTarget === 'default' ? settings.defaultPrinter : settings.printer;
  return settings.printers.find((p) => p.model === model) ?? (settings.printer ? { model: settings.printer, slicer: settings.slicer } : undefined);
}
