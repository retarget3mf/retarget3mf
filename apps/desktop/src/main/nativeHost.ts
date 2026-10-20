import { execFile } from 'node:child_process';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { EXTENSION_IDS, NATIVE_HOST_NAME } from '@retarget3mf/bridge';

export interface HostTarget { browser: string; /** Manifest folder (macOS/Linux) or registry key (Windows). */ location: string; /** Present only if the browser looks installed. */ profileDir: string }
export interface HostStatus { browser: string; registered: boolean }

// Brave on macOS/Linux reads Chrome's folders (brave-core brave_main_delegate.cc), so it is covered by the Chrome entry.
export function hostTargets(platform: NodeJS.Platform, home: string, appData = process.env.LOCALAPPDATA ?? ''): HostTarget[] {
  if (platform === 'darwin') {
    const support = join(home, 'Library', 'Application Support');
    return [['Chrome', 'Google/Chrome'], ['Chromium', 'Chromium'], ['Edge', 'Microsoft Edge'], ['Brave', 'BraveSoftware/Brave-Browser']]
      .map(([browser, dir]) => ({ browser: browser!, profileDir: join(support, dir!), location: join(support, browser === 'Brave' ? 'Google/Chrome' : dir!, 'NativeMessagingHosts') }));
  }
  if (platform === 'linux') {
    const config = join(home, '.config');
    return [['Chrome', 'google-chrome'], ['Chromium', 'chromium'], ['Edge', 'microsoft-edge'], ['Brave', 'BraveSoftware/Brave-Browser']]
      .map(([browser, dir]) => ({ browser: browser!, profileDir: join(config, dir!), location: join(config, browser === 'Brave' ? 'google-chrome' : dir!, 'NativeMessagingHosts') }));
  }
  return [['Chrome', 'Google\\Chrome', 'Google/Chrome'], ['Chromium', 'Chromium', 'Chromium'], ['Edge', 'Microsoft\\Edge', 'Microsoft/Edge'], ['Brave', 'BraveSoftware\\Brave-Browser', 'BraveSoftware/Brave-Browser']]
    .map(([browser, key, dir]) => ({ browser: browser!, profileDir: join(appData, dir!), location: `HKCU\\Software\\${key}\\NativeMessagingHosts\\${NATIVE_HOST_NAME}` }));
}

export interface LauncherSpec { electron: string; hostScript: string; socket: string; appExec: string; appArgs: string[] }

const quote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;

export function launcherScript(spec: LauncherSpec, platform: NodeJS.Platform): string {
  const args = [quote(spec.hostScript), '--socket', quote(spec.socket), '--app', quote(spec.appExec), ...spec.appArgs.flatMap((a) => ['--app-arg', quote(a)])].join(' ');
  if (platform === 'win32') return `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n${quote(spec.electron)} ${args} %*\r\n`;
  return `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ${quote(spec.electron)} ${args} "$@"\n`;
}

export function hostManifest(launcher: string): object {
  return {
    name: NATIVE_HOST_NAME,
    description: 'Retarget3MF: opens model-site projects in the desktop app',
    path: launcher,
    type: 'stdio',
    allowed_origins: EXTENSION_IDS.map((id) => `chrome-extension://${id}/`),
  };
}

const regAdd = (key: string, value: string) => new Promise<boolean>((resolve) =>
  execFile('reg', ['add', key, '/ve', '/t', 'REG_SZ', '/d', value, '/f'], { windowsHide: true }, (err) => resolve(!err)));

/** Writes the launcher and registers the host for every Chromium browser that looks installed; idempotent. */
export async function registerNativeHost(hostDir: string, spec: LauncherSpec, platform = process.platform, home = homedir()): Promise<HostStatus[]> {
  await mkdir(hostDir, { recursive: true });
  const launcher = join(hostDir, platform === 'win32' ? 'retarget3mf-host.bat' : 'retarget3mf-host');
  await writeFile(launcher, launcherScript(spec, platform));
  if (platform !== 'win32') await chmod(launcher, 0o755);
  const manifest = JSON.stringify(hostManifest(launcher), null, 2);
  const manifestPath = join(hostDir, `${NATIVE_HOST_NAME}.json`);
  await writeFile(manifestPath, manifest);

  return Promise.all(hostTargets(platform, home).map(async (t) => {
    if (!existsSync(t.profileDir)) return { browser: t.browser, registered: false };
    try {
      if (platform === 'win32') return { browser: t.browser, registered: await regAdd(t.location, manifestPath) };
      await mkdir(t.location, { recursive: true });
      await writeFile(join(t.location, `${NATIVE_HOST_NAME}.json`), manifest);
      return { browser: t.browser, registered: true };
    } catch (error) {
      console.error('native host registration', t.browser, error);
      return { browser: t.browser, registered: false };
    }
  }));
}
