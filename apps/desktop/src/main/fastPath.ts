import { Notification } from 'electron';
import { PRINTERS } from '@retarget3mf/core';
import { suggestFilamentMap } from '@retarget3mf/core/suggest';
import type { AppContext } from './context.ts';
import { convertProject, inspectProject, openInSlicer } from './conversion.ts';
import { showWindow } from './window.ts';

export type FastPathOutcome =
  | { kind: 'opened' | 'converted'; message: string; outputPath: string }
  | { kind: 'review'; message: string }
  | { kind: 'error'; message: string };

/**
 * A .3mf opened from the OS or the browser extension: convert with saved defaults and open the slicer without
 * showing the window, unless something needs the user (no printer yet, colours to merge, errors, or "review" mode).
 */
export async function openFromOs(ctx: AppContext, path: string): Promise<FastPathOutcome> {
  const { printer: printerId, openMode, slicer, openAfterConvert } = ctx.settings;
  const printer = PRINTERS.find((p) => p.id === printerId);
  if (!printer) return review(ctx, path, 'Choose your printer in Retarget3MF first.');
  if (openMode === 'review') return review(ctx, path, 'Review the project in Retarget3MF.');

  const inspected = await inspectProject(path);
  if (!inspected.ok) return fail(ctx, inspected.error);
  const used = inspected.value.filaments.filter((f) => f.used);
  if (used.length > printer.slots.count) {
    return review(ctx, path, `${used.length} colours for ${printer.slots.count} slot(s): choose how to merge them in Retarget3MF.`);
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

function review(ctx: AppContext, path: string, message: string): FastPathOutcome {
  ctx.emit({ kind: 'open-project', path });
  showWindow(ctx);
  return { kind: 'review', message };
}

function fail(ctx: AppContext, message: string): FastPathOutcome {
  ctx.emit({ kind: 'error', message });
  showWindow(ctx);
  return { kind: 'error', message };
}

function notify(ctx: AppContext, title: string, body: string): void {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body });
  n.on('click', () => showWindow(ctx));
  n.show();
}
