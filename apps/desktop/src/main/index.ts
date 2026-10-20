import { app } from 'electron';
import electronUpdater from 'electron-updater';
import { AppContext } from './context.ts';
import { appLinksFromArgv, projectPathsFromArgv } from './externalFiles.ts';
import { openFromOs } from './fastPath.ts';
import { registerHistoryIpc, registerIpc } from './ipc.ts';
import { openLink, registerAppScheme, startBridge } from './bridge.ts';
import { loadSettings } from './settings.ts';
import { showWindow } from './window.ts';

// One instance owns the window and the converter; later launches forward their files and exit.
if (!app.requestSingleInstanceLock()) app.quit();

const IDLE_QUIT_MS = 15_000;
let ctx: AppContext | undefined;
const early: string[] = [];

/** A .3mf path or a retarget3mf:// link handed over by the OS. */
const handle = (item: string) => (appLinksFromArgv([item]).length ? openLink(ctx!, item) : openFromOs(ctx!, item));

// Windows/Linux have no dock to keep a windowless app reachable: quit once OS-opened items are done.
async function openAndMaybeQuit(item: string): Promise<void> {
  await handle(item);
  if (process.platform !== 'darwin') setTimeout(() => { if (!ctx?.window) app.quit(); }, IDLE_QUIT_MS);
}
const open = (item: string) => (ctx ? void openAndMaybeQuit(item) : early.push(item));

// macOS delivers files (Finder double-click, "Open With", `open -a`) and links as events, possibly before `ready`.
app.on('open-file', (event, path) => {
  event.preventDefault();
  open(path);
});
app.on('open-url', (event, url) => {
  event.preventDefault();
  open(url);
});
const fromArgv = (argv: readonly string[], cwd: string) => [...projectPathsFromArgv(argv, cwd), ...appLinksFromArgv(argv)];
app.on('second-instance', (_e, argv, cwd) => {
  const files = fromArgv(argv, cwd);
  if (files.length === 0 && ctx) showWindow(ctx);
  files.forEach(open);
});

app.whenReady().then(() => {
  ctx = new AppContext(loadSettings(app.getPath('userData')));
  registerIpc(ctx);
  registerHistoryIpc(ctx);
  startBridge(ctx);
  registerAppScheme();
  const files = [...early, ...fromArgv(process.argv.slice(1), process.cwd())];
  // The fast path, and launches by the browser extension's host, stay windowless; a plain launch shows the window.
  if (files.length === 0 && !process.argv.includes('--from-browser')) showWindow(ctx);
  files.forEach((f) => void openAndMaybeQuit(f));
  // GitHub Releases; unsigned macOS builds cannot apply updates, so failures are only logged.
  if (app.isPackaged) electronUpdater.autoUpdater.checkForUpdatesAndNotify().catch((error: unknown) => console.error('update check', error));
  app.on('activate', () => showWindow(ctx!));
});

// macOS apps stay alive without windows so OS file opens skip a cold start.
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
