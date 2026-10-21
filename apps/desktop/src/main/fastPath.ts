import { Notification } from 'electron';
import { PRINTERS } from '@retarget3mf/core';
import { suggestFilamentMap } from '@retarget3mf/core/suggest';
import type { AppContext } from './context.ts';
import { convertProject, inspectProject, openInSlicer } from './conversion.ts';
import { dropPrinter } from './settings.ts';
import { showWindow } from './window.ts';

export type FastPathOutcome =
  | { kind: 'opened' | 'converted'; message: string; outputPath: string }
  | { kind: 'review'; message: string }
  | { kind: 'error'; message: string };

/**
 * A .3mf opened from the OS or the browser extension: convert with saved defaults and open the slicer without
 * showing the window, unless something needs the user (no printer yet, colours to merge, errors, or "review" mode).
 */
export async function openFromOs(ctx: AppContext, path: string, fromExtension = false): Promise<FastPathOutcome> {
  const { openAfterConvert, autoCombine } = ctx.settings;
  const openMode = fromExtension ? ctx.settings.extensionMode : ctx.settings.openMode;
  if (!ctx.settings.printer) return review(ctx, path, 'Choose your printer in Retarget3MF first.', fromExtension);
  const target = dropPrinter(ctx.settings);
  if (!target) return review(ctx, path, 'Choose the printer for this project in Retarget3MF.', fromExtension);
  const printer = PRINTERS.find((p) => p.id === target.model)!;
  const { slicer } = target;
  if (openMode === 'review') return review(ctx, path, 'Review the project in Retarget3MF.', fromExtension);

  const inspected = await inspectProject(path);
  if (!inspected.ok) return fail(ctx, inspected.error);
  const used = inspected.value.filaments.filter((f) => f.used);
  if (used.length > printer.slots.count && !autoCombine) {
    return review(ctx, path, `${used.length} colours for ${printer.slots.count} slot(s): choose how to merge them in Retarget3MF.`, fromExtension);
  }

  const converted = await convertProject(ctx, { path, printer: printer.id, slicer, filamentMap: suggestFilamentMap(used, printer.slots.count) });
  if (!converted.ok) return fail(ctx, converted.error);
  const result = { project: inspected.value, result: converted.value };
  const { outputPath } = converted.value;
  if (!openAfterConvert) {
    ctx.emit({ kind: 'show-result', ...result });
    showWindow(ctx);
    return { kind: 'converted', message: `Converted for ${printer.displayName}.`, outputPath };
  }
  const launched = await openInSlicer(ctx, outputPath, slicer);
  if (!launched.ok) {
    ctx.emit({ kind: 'show-result', ...result, launchError: launched.error });
    showWindow(ctx);
    return { kind: 'error', message: launched.error };
  }
  ctx.emit({ kind: 'show-result', ...result });
  const title = `Opened ${inspected.value.title || inspected.value.fileName} for ${printer.displayName}`;
  notify(ctx, title, converted.value.report.warnings[0] ?? 'Click to view the conversion report.');
  return { kind: 'opened', message: title, outputPath };
}

function review(ctx: AppContext, path: string, message: string, fromExtension: boolean): FastPathOutcome {
  ctx.emit({ kind: 'open-project', path, ...(fromExtension && { fromExtension }) });
  showWindow(ctx);
  return { kind: 'review', message };
}

export function showError(ctx: AppContext, message: string): void {
  ctx.emit({ kind: 'error', message });
  showWindow(ctx);
}

function fail(ctx: AppContext, message: string): FastPathOutcome {
  showError(ctx, message);
  return { kind: 'error', message };
}

function notify(ctx: AppContext, title: string, body: string): void {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body });
  n.on('click', () => showWindow(ctx));
  n.show();
}
