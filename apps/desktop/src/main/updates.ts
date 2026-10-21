import { app } from 'electron';
import electronUpdater from 'electron-updater';
import type { UpdateStatus } from '../shared/api.ts';

const { autoUpdater } = electronUpdater;

/** GitHub Releases; unsigned macOS builds cannot apply updates, so launch-time failures are only logged. */
export function checkOnLaunch(autoDownload: boolean): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = autoDownload;
  autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => console.error('update check', error));
}

export async function checkNow(autoDownload: boolean): Promise<UpdateStatus> {
  if (!app.isPackaged) return { kind: 'unavailable' };
  autoUpdater.autoDownload = autoDownload;
  try {
    const result = await autoUpdater.checkForUpdates();
    const version = result?.updateInfo.version;
    return version && version !== app.getVersion() ? { kind: 'available', version } : { kind: 'current' };
  } catch (error) {
    console.error('update check', error);
    return { kind: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
