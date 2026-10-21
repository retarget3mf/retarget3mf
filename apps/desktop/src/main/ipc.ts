import { writeFile } from 'node:fs/promises';
import { dialog, ipcMain, shell } from 'electron';
import { isSitePageUrl } from '@retarget3mf/bridge';
import { reportToMarkdown } from '@retarget3mf/core';
import type { ConvertRequest, ConvertResult, SlicerKind } from '../shared/api.ts';
import type { AppContext } from './context.ts';
import { assertProjectPath, convertProject, inspectProject, openInSlicer } from './conversion.ts';
import { cancelWorker } from './converter.ts';
import { sanitizeSettings } from './settings.ts';
import { SLICER_NAMES } from './slicers.ts';

export function registerIpc(ctx: AppContext): void {
  ipcMain.handle('state', () => ctx.state());
  ipcMain.handle('events:drain', () => ctx.drainEvents());
  ipcMain.handle('settings:save', async (_e, patch: unknown) => {
    await ctx.update(patch && typeof patch === 'object' ? patch : {}, sanitizeSettings);
    return ctx.state();
  });
  ipcMain.handle('slicers:refresh', async () => {
    await ctx.refreshSlicers();
    return ctx.state();
  });
  ipcMain.handle('file:pick', async () => {
    const r = await dialog.showOpenDialog(ctx.window!, { properties: ['openFile'], filters: [{ name: '3MF project', extensions: ['3mf'] }] });
    return r.canceled ? undefined : r.filePaths[0];
  });
  ipcMain.handle('slicer:pick', async (_e, kind: SlicerKind) => {
    if (!(kind in SLICER_NAMES)) return ctx.state();
    const r = await dialog.showOpenDialog(ctx.window!, { title: `Locate ${SLICER_NAMES[kind]}`, properties: ['openFile', 'treatPackageAsDirectory'] });
    if (!r.canceled && r.filePaths[0]) await ctx.update({ slicerPaths: { ...ctx.settings.slicerPaths, [kind]: r.filePaths[0] } }, sanitizeSettings);
    return ctx.state();
  });
  ipcMain.handle('inspect', (_e, path: unknown) => inspectProject(assertProjectPath(path)));
  ipcMain.handle('convert', (_e, request: ConvertRequest) => convertProject(ctx, request));
  ipcMain.handle('convert:cancel', () => cancelWorker());
  ipcMain.handle('slicer:open', (_e, path: string, kind: SlicerKind) => openInSlicer(ctx, path, kind));
  ipcMain.handle('file:show', (_e, path: string) => shell.showItemInFolder(assertProjectPath(path)));
  ipcMain.handle('report:export', async (_e, result: ConvertResult, format: 'md' | 'json') => {
    const r = await dialog.showSaveDialog(ctx.window!, { defaultPath: result.outputPath.replace(/\.3mf$/i, `.report.${format}`) });
    if (r.canceled || !r.filePath) return;
    await writeFile(r.filePath, format === 'md' ? result.markdown : JSON.stringify(result.report, null, 2));
  });
}

export function registerHistoryIpc(ctx: AppContext): void {
  ipcMain.handle('history:list', () => ctx.history.list());
  ipcMain.handle('history:report', async (_e, id: string): Promise<ConvertResult | undefined> => {
    const entry = ctx.history.get(String(id));
    const report = entry && await ctx.history.report(entry.id);
    return entry && report ? { outputPath: entry.outputPath, report, markdown: reportToMarkdown(report), title: entry.title } : undefined;
  });
  ipcMain.handle('history:remove', async (_e, id: string, moveFileToTrash: boolean) => {
    const removed = await ctx.history.remove(String(id));
    // Only the converted file this app wrote, and only to the Trash; the original download is left alone.
    if (removed && moveFileToTrash === true && removed.exists) await shell.trashItem(removed.outputPath).catch((error) => console.error('trash', error));
    return ctx.history.list();
  });
  ipcMain.handle('history:source', async (_e, id: string) => {
    const origin = ctx.history.get(String(id))?.origin;
    if (origin && isSitePageUrl(origin.pageUrl, origin.site)) await shell.openExternal(origin.pageUrl);
  });
}
