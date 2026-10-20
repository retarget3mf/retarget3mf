import { app, BrowserWindow, nativeTheme } from 'electron';
import { join } from 'node:path';
import { PRINTERS } from '@retarget3mf/core';
import type { AppEvent, AppState, Settings, SlicerInstall } from '../shared/api.ts';
import { saveSettings } from './settings.ts';
import { macAppIcon } from './appIcon.ts';
import { discoverSlicers } from './slicers.ts';

/** Main-process state shared by IPC handlers, the window and the OS-open fast path. */
export class AppContext {
  settings: Settings;
  window: BrowserWindow | undefined;
  private slicers: Promise<SlicerInstall[]>;
  private queue: AppEvent[] = [];
  private rendererReady = false;

  constructor(settings: Settings) {
    this.settings = settings;
    nativeTheme.themeSource = settings.theme;
    this.slicers = this.discover();
  }

  get outputFolder(): string {
    return join(app.getPath('documents'), 'Retarget3MF');
  }

  async state(): Promise<AppState> {
    return { settings: this.settings, printers: PRINTERS, slicers: await this.slicers, outputFolder: this.outputFolder };
  }

  async findSlicer(kind: Settings['slicer']): Promise<SlicerInstall | undefined> {
    return (await this.slicers).find((s) => s.kind === kind);
  }

  refreshSlicers(): Promise<SlicerInstall[]> {
    this.slicers = this.discover();
    return this.slicers;
  }

  async update(patch: Partial<Settings>, sanitize: (raw: unknown, base: Settings) => Settings): Promise<void> {
    const pathsChanged = patch.slicerPaths !== undefined;
    this.settings = sanitize({ ...this.settings, ...patch }, this.settings);
    nativeTheme.themeSource = this.settings.theme;
    await saveSettings(app.getPath('userData'), this.settings);
    if (pathsChanged) await this.refreshSlicers();
  }

  /** Delivers to the renderer, or queues until it subscribes (window still loading or closed). */
  emit(event: AppEvent): void {
    if (this.window && this.rendererReady) this.window.webContents.send('event', event);
    else this.queue.push(event);
  }

  drainEvents(): AppEvent[] {
    this.rendererReady = true;
    return this.queue.splice(0);
  }

  windowClosed(): void {
    this.window = undefined;
    this.rendererReady = false;
  }

  private async discover(): Promise<SlicerInstall[]> {
    const found = await discoverSlicers(this.settings.slicerPaths);
    return Promise.all(found.map(async (s) => {
      const icon = await slicerIcon(s.path);
      return icon ? { ...s, icon } : s;
    }));
  }
}

async function slicerIcon(path: string): Promise<string | undefined> {
  if (process.platform === 'darwin') return macAppIcon(path);
  // ponytail: Linux (.desktop icon lookup) shows the placeholder for now.
  if (process.platform !== 'win32') return undefined;
  const icon = await app.getFileIcon(path, { size: 'large' }).catch(() => undefined);
  return icon && !icon.isEmpty() ? icon.toDataURL() : undefined;
}
