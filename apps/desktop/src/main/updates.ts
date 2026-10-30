import { app, Notification, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { releasesUrl } from '@retarget3mf/ui/links';
import type { UpdateStatus } from '../shared/api.ts';

const { autoUpdater } = electronUpdater;

/** macOS only lets signed apps replace themselves; unsigned builds point to the download instead. */
export const canInstall = process.platform !== 'darwin';
let downloaded: string | undefined;
autoUpdater.on('update-downloaded', (info) => { downloaded = info.version; });

export function checkOnLaunch(autoDownload: boolean): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = autoDownload && canInstall;
  if (canInstall) {
    autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => console.error('update check', error));
    return;
  }
  void checkNow(false).then((status) => {
    if (status.kind !== 'available' || !releasesUrl) return;
    const note = new Notification({ title: `Retarget3MF ${status.version} is available`, body: 'Click to download it.' });
    note.on('click', () => void shell.openExternal(releasesUrl));
    note.show();
  });
}

export async function checkNow(autoDownload: boolean): Promise<UpdateStatus> {
  if (!app.isPackaged) return { kind: 'unavailable' };
  autoUpdater.autoDownload = autoDownload && canInstall;
  try {
    const result = await autoUpdater.checkForUpdates();
    const version = result?.updateInfo.version;
    if (!version || version === app.getVersion()) return { kind: 'current' };
    return { kind: downloaded === version ? 'ready' : 'available', version, canInstall };
  } catch (error) {
    console.error('update check', error);
    return { kind: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

/** Restarts into the new version (downloading it first if needed), or on macOS opens its download page. */
export async function installUpdate(): Promise<void> {
  if (!canInstall) {
    if (releasesUrl) await shell.openExternal(releasesUrl);
    return;
  }
  if (!downloaded) await autoUpdater.downloadUpdate();
  autoUpdater.quitAndInstall();
}
