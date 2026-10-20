import { Notification } from 'electron';
import { PRINTERS } from '@retarget3mf/core';
import { suggestFilamentMap } from '@retarget3mf/core/suggest';
import type { AppContext } from './context.ts';
import { convertProject, inspectProject, openInSlicer } from './conversion.ts';
import { showWindow } from './window.ts';

/**
 * A .3mf opened from the OS: convert with saved defaults and open the slicer without showing the window,
 * unless something needs the user (no printer chosen yet, colours to merge, errors, or "review" mode).
 */
export async function openFromOs(ctx: AppContext, path: string): Promise<void> {
  const { printer: printerId, openMode, slicer, openAfterConvert } = ctx.settings;
  const printer = PRINTERS.find((p) => p.id === printerId);
  if (!printer || openMode === 'review') return review(ctx, path);

  const inspected = await inspectProject(path);
  if (!inspected.ok) return fail(ctx, inspected.error);
  const used = inspected.value.filaments.filter((f) => f.used);
  if (used.length > printer.slots.count) return review(ctx, path);

  const converted = await convertProject(ctx, { path, printer: printer.id, slicer, filamentMap: suggestFilamentMap(used, printer.slots.count) });
  if (!converted.ok) return fail(ctx, converted.error);
  const result = { project: inspected.value, result: converted.value };
  if (!openAfterConvert) {
    ctx.emit({ kind: 'show-result', ...result });
    showWindow(ctx);
    return;
  }
  const launched = await openInSlicer(ctx, converted.value.outputPath, slicer);
  if (!launched.ok) {
    ctx.emit({ kind: 'show-result', ...result, launchError: launched.error });
    showWindow(ctx);
    return;
  }
  ctx.emit({ kind: 'show-result', ...result });
  notify(ctx, `Opened ${inspected.value.title || inspected.value.fileName} for ${printer.displayName}`, converted.value.report.warnings[0] ?? 'Click to view the conversion report.');
}

function review(ctx: AppContext, path: string): void {
  ctx.emit({ kind: 'open-project', path });
  showWindow(ctx);
}

function fail(ctx: AppContext, message: string): void {
  ctx.emit({ kind: 'error', message });
  showWindow(ctx);
}

function notify(ctx: AppContext, title: string, body: string): void {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body });
  n.on('click', () => showWindow(ctx));
  n.show();
}
