import { mkdirSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { PRINTERS } from '@retarget3mf/core';
import type { AppState, ConvertRequest, ConvertResult, InspectResult, Result, Settings, SlicerKind } from '../shared/api.ts';
import { runWorker } from './converter.ts';
import { outputPathFor } from './paths.ts';
import { loadSettings, sanitizeSettings, saveSettings } from './settings.ts';
import { detectSlicers, launchSlicer, SLICER_NAMES } from './slicers.ts';

let settings: Settings;
let window: BrowserWindow | undefined;

const outputFolder = () => join(app.getPath('documents'), 'Retarget3MF');

function state(): AppState {
  return { settings, printers: PRINTERS, slicers: detectSlicers(settings.slicerPaths), outputFolder: outputFolder() };
}

/** Paths from the renderer are untrusted: only existing .3mf files are accepted. */
function assertProjectPath(path: unknown): string {
  if (typeof path !== 'string' || extname(path).toLowerCase() !== '.3mf' || !statSync(path, { throwIfNoEntry: false })?.isFile()) {
    throw new Error('Only existing .3mf files can be opened.');
  }
  return path;
}

async function handleConvert(request: ConvertRequest): Promise<Result<ConvertResult>> {
  const path = assertProjectPath(request.path);
  const printer = PRINTERS.find((p) => p.id === request.printer);
  if (!printer) return { ok: false, error: 'Pick a printer first.' };
  let folder: string | undefined;
  if (settings.output === 'app-folder') {
    folder = outputFolder();
    mkdirSync(folder, { recursive: true });
  }
  const shortName = printer.displayName.replace(/^Flashforge /, '');
  return runWorker<ConvertResult>({ kind: 'convert', request: { ...request, path }, outputPath: outputPathFor(path, shortName, folder) });
}

async function handleOpenInSlicer(path: string, kind: SlicerKind): Promise<Result<void>> {
  const slicer = detectSlicers(settings.slicerPaths).find((s) => s.kind === kind);
  if (!slicer) return { ok: false, error: `${SLICER_NAMES[kind]} was not found. Install it or choose its location in Settings.` };
  try {
    await launchSlicer(slicer.path, assertProjectPath(path));
    return { ok: true, value: undefined };
  } catch (error) {
    console.error(error);
    return { ok: false, error: `${SLICER_NAMES[kind]} could not be started. Open the file from the slicer with File → Open Project.` };
  }
}

function registerIpc(): void {
  ipcMain.handle('state', () => state());
  ipcMain.handle('settings:save', async (_e, patch: unknown) => {
    settings = sanitizeSettings({ ...settings, ...(patch as object) }, settings);
    await saveSettings(app.getPath('userData'), settings);
    return state();
  });
  ipcMain.handle('file:pick', async () => {
    const r = await dialog.showOpenDialog(window!, { properties: ['openFile'], filters: [{ name: '3MF project', extensions: ['3mf'] }] });
    return r.canceled ? undefined : r.filePaths[0];
  });
  ipcMain.handle('slicer:pick', async (_e, kind: SlicerKind) => {
    if (!(kind in SLICER_NAMES)) return state();
    const r = await dialog.showOpenDialog(window!, { title: `Locate ${SLICER_NAMES[kind]}`, properties: ['openFile', 'treatPackageAsDirectory'] });
    if (!r.canceled && r.filePaths[0]) {
      settings = { ...settings, slicerPaths: { ...settings.slicerPaths, [kind]: r.filePaths[0] } };
      await saveSettings(app.getPath('userData'), settings);
    }
    return state();
  });
  ipcMain.handle('inspect', async (_e, path: unknown) => runWorker<InspectResult>({ kind: 'inspect', path: assertProjectPath(path) }));
  ipcMain.handle('convert', (_e, request: ConvertRequest) => handleConvert(request));
  ipcMain.handle('slicer:open', (_e, path: string, kind: SlicerKind) => handleOpenInSlicer(path, kind));
  ipcMain.handle('file:show', (_e, path: string) => shell.showItemInFolder(assertProjectPath(path)));
  ipcMain.handle('report:export', async (_e, result: ConvertResult, format: 'md' | 'json') => {
    const defaultPath = result.outputPath.replace(/\.3mf$/i, `.report.${format}`);
    const r = await dialog.showSaveDialog(window!, { defaultPath });
    if (r.canceled || !r.filePath) return;
    await writeFile(r.filePath, format === 'md' ? result.markdown : JSON.stringify(result.report, null, 2));
  });
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: 'Retarget3MF',
    webPreferences: { preload: join(import.meta.dirname, '../preload/index.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  // No remote content: block navigation and new windows; external links go to the OS browser.
  window.webContents.on('will-navigate', (e) => e.preventDefault());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
}

// Lets e2e tests run against a throwaway profile.
if (process.env.RETARGET3MF_USER_DATA) app.setPath('userData', process.env.RETARGET3MF_USER_DATA);

app.whenReady().then(() => {
  settings = loadSettings(app.getPath('userData'));
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
