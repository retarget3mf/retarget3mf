import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { app } from 'electron';
import { PRINTERS } from '@retarget3mf/core';
import { startBridgeServer } from './bridgeServer.ts';
import { bridgeSocketPath } from './bridgeSocket.ts';
import type { AppContext } from './context.ts';
import { downloadProject } from './download.ts';
import { openFromOs } from './fastPath.ts';
import { registerNativeHost } from './nativeHost.ts';
import { SLICER_NAMES } from './slicers.ts';

/** Script paths outside the asar archive, so the browser-started host can run them with plain Node. */
function hostScriptPath(): string {
  return join(app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked'), 'out', 'main', 'host.js');
}

/**
 * End-to-end tests serve the CDN download from a local fixture; ignored in packaged builds.
 * ponytail: env switch rather than an injectable server, enough for one e2e test.
 */
function testFetch(): typeof fetch | undefined {
  const fixture = process.env.RETARGET3MF_E2E_FIXTURE;
  if (app.isPackaged || !fixture) return undefined;
  return (async (url: string) => Object.defineProperty(new Response(readFileSync(fixture)), 'url', { value: url })) as unknown as typeof fetch;
}

/** Throwaway home for e2e runs: native host registration and downloads stay out of the real profile. */
const testHome = () => (!app.isPackaged && process.env.RETARGET3MF_E2E_HOME) || undefined;

/** Local socket for the browser extension (via the native messaging host) plus host registration in browsers. */
export function startBridge(ctx: AppContext): void {
  const socket = bridgeSocketPath(app.getPath('userData'));
  startBridgeServer(socket, {
    version: app.getVersion(),
    status: () => {
      const printer = PRINTERS.find((p) => p.id === ctx.settings.printer)?.displayName;
      return { ...(printer && { printer }), slicer: SLICER_NAMES[ctx.settings.slicer] };
    },
    download: (url, name) => downloadProject(url, name, testHome() ?? app.getPath('downloads'), testFetch() ?? fetch),
    open: (path) => openFromOs(ctx, path),
  });
  const spec = {
    electron: process.execPath,
    hostScript: hostScriptPath(),
    socket,
    appExec: process.execPath,
    // Unpackaged (dev) Electron needs the app folder; a packaged app starts on its own.
    appArgs: app.isPackaged ? [] : [app.getAppPath()],
  };
  // Tests point registration at a throwaway home so they never touch the real browsers' folders.
  const home = testHome() ?? homedir();
  registerNativeHost(join(app.getPath('userData'), 'native-host'), spec, process.platform, home)
    .then((browsers) => { ctx.browsers = browsers; })
    .catch((error) => console.error('native host registration', error));
}
