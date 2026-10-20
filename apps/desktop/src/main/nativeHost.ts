import { execFile } from 'node:child_process';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { EXTENSION_IDS, FIREFOX_EXTENSION_ID, NATIVE_HOST_NAME } from '@retarget3mf/bridge';

export interface HostTarget {
  browser: string;
  /** Manifest folder (macOS/Linux) or registry key (Windows). */
  location: string;
  /** Present only if the browser looks installed. */
  profileDir: string;
  firefox?: boolean;
}
export interface HostStatus { browser: string; registered: boolean }

/** Browser data folders (macOS under Application Support, Linux under ~/.config) and Windows registry vendor keys. */
interface BrowserSpec { browser: string; mac?: string; linux?: string; win?: [key: string, dir: string] }

// Chromium reads `<user data dir>/NativeMessagingHosts` on macOS and Linux (chrome::DIR_USER_NATIVE_MESSAGING).
// Brave reads Chrome's folders as well (brave-core brave_main_delegate.cc), so Chrome's entry also serves it.
const CHROMIUM: BrowserSpec[] = [
  { browser: 'Chrome', mac: 'Google/Chrome', linux: 'google-chrome', win: ['Google\\Chrome', 'Google/Chrome'] },
  { browser: 'Chrome Beta', mac: 'Google/Chrome Beta', linux: 'google-chrome-beta' },
  { browser: 'Chrome Dev', mac: 'Google/Chrome Dev', linux: 'google-chrome-unstable' },
  { browser: 'Chrome Canary', mac: 'Google/Chrome Canary' },
  { browser: 'Chromium', mac: 'Chromium', linux: 'chromium', win: ['Chromium', 'Chromium'] },
  { browser: 'Edge', mac: 'Microsoft Edge', linux: 'microsoft-edge', win: ['Microsoft\\Edge', 'Microsoft/Edge'] },
  { browser: 'Edge Beta', mac: 'Microsoft Edge Beta', linux: 'microsoft-edge-beta' },
  { browser: 'Edge Dev', mac: 'Microsoft Edge Dev', linux: 'microsoft-edge-dev' },
  { browser: 'Brave', mac: 'BraveSoftware/Brave-Browser', linux: 'BraveSoftware/Brave-Browser', win: ['BraveSoftware\\Brave-Browser', 'BraveSoftware/Brave-Browser'] },
  { browser: 'Vivaldi', mac: 'Vivaldi', linux: 'vivaldi' },
  { browser: 'Opera', mac: 'com.operasoftware.Opera', linux: 'opera' },
  { browser: 'Arc', mac: 'Arc/User Data' },
  { browser: 'Dia', mac: 'Dia/User Data' },
];

export function hostTargets(platform: NodeJS.Platform, home: string, appData = process.env.LOCALAPPDATA ?? ''): HostTarget[] {
  const chromium = (dir: string, base: string) => ({ profileDir: join(base, dir), location: join(base, dir, 'NativeMessagingHosts') });
  if (platform === 'darwin') {
    const support = join(home, 'Library', 'Application Support');
    return [
      ...CHROMIUM.flatMap((b) => (b.mac ? [{ browser: b.browser, ...chromium(b.mac, support) }] : [])),
      { browser: 'Firefox', profileDir: join(support, 'Firefox'), location: join(support, 'Mozilla', 'NativeMessagingHosts'), firefox: true },
    ];
  }
  if (platform === 'linux') {
    const config = join(home, '.config');
    return [
      ...CHROMIUM.flatMap((b) => (b.linux ? [{ browser: b.browser, ...chromium(b.linux, config) }] : [])),
      { browser: 'Firefox', profileDir: join(home, '.mozilla', 'firefox'), location: join(home, '.mozilla', 'native-messaging-hosts'), firefox: true },
    ];
  }
  return [
    ...CHROMIUM.flatMap((b) => (b.win ? [{ browser: b.browser, profileDir: join(appData, b.win[1]), location: `HKCU\\Software\\${b.win[0]}\\NativeMessagingHosts\\${NATIVE_HOST_NAME}` }] : [])),
    { browser: 'Firefox', profileDir: join(process.env.APPDATA ?? appData, 'Mozilla', 'Firefox'), location: `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`, firefox: true },
  ];
}

export interface LauncherSpec { electron: string; hostScript: string; socket: string; appExec: string; appArgs: string[] }

const quote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;

export function launcherScript(spec: LauncherSpec, platform: NodeJS.Platform): string {
  const args = [quote(spec.hostScript), '--socket', quote(spec.socket), '--app', quote(spec.appExec), ...spec.appArgs.flatMap((a) => ['--app-arg', quote(a)])].join(' ');
  if (platform === 'win32') return `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n${quote(spec.electron)} ${args} %*\r\n`;
  return `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ${quote(spec.electron)} ${args} "$@"\n`;
}

/** Chromium manifests list allowed origins; Firefox's list add-on IDs instead. */
export function hostManifest(launcher: string, firefox = false): object {
  return {
    name: NATIVE_HOST_NAME,
    description: 'Retarget3MF: opens model-site projects in the desktop app',
    path: launcher,
    type: 'stdio',
    ...(firefox ? { allowed_extensions: [FIREFOX_EXTENSION_ID] } : { allowed_origins: EXTENSION_IDS.map((id) => `chrome-extension://${id}/`) }),
  };
}

const regAdd = (key: string, value: string) => new Promise<boolean>((resolve) =>
  execFile('reg', ['add', key, '/ve', '/t', 'REG_SZ', '/d', value, '/f'], { windowsHide: true }, (err) => resolve(!err)));

/** Writes the launcher and registers the host for every browser that looks installed (only those are returned); idempotent. */
export async function registerNativeHost(hostDir: string, spec: LauncherSpec, platform = process.platform, home = homedir()): Promise<HostStatus[]> {
  await mkdir(hostDir, { recursive: true });
  const launcher = join(hostDir, platform === 'win32' ? 'retarget3mf-host.bat' : 'retarget3mf-host');
  await writeFile(launcher, launcherScript(spec, platform));
  if (platform !== 'win32') await chmod(launcher, 0o755);
  const manifests = { chromium: JSON.stringify(hostManifest(launcher), null, 2), firefox: JSON.stringify(hostManifest(launcher, true), null, 2) };
  const manifestPaths = { chromium: join(hostDir, `${NATIVE_HOST_NAME}.json`), firefox: join(hostDir, `${NATIVE_HOST_NAME}.firefox.json`) };
  await writeFile(manifestPaths.chromium, manifests.chromium);
  await writeFile(manifestPaths.firefox, manifests.firefox);

  return Promise.all(hostTargets(platform, home).filter((t) => existsSync(t.profileDir)).map(async (t) => {
    const kind = t.firefox ? 'firefox' : 'chromium';
    try {
      if (platform === 'win32') return { browser: t.browser, registered: await regAdd(t.location, manifestPaths[kind]) };
      await mkdir(t.location, { recursive: true });
      await writeFile(join(t.location, `${NATIVE_HOST_NAME}.json`), manifests[kind]);
      return { browser: t.browser, registered: true };
    } catch (error) {
      console.error('native host registration', t.browser, error);
      return { browser: t.browser, registered: false };
    }
  }));
}
