import { app } from 'electron';
import { AppContext } from './context.ts';
import { projectPathsFromArgv } from './externalFiles.ts';
import { openFromOs } from './fastPath.ts';
import { registerHistoryIpc, registerIpc } from './ipc.ts';
import { startBridge } from './bridge.ts';
import { loadSettings } from './settings.ts';
import { showWindow } from './window.ts';

// One instance owns the window and the converter; later launches forward their files and exit.
if (!app.requestSingleInstanceLock()) app.quit();

const IDLE_QUIT_MS = 15_000;
let ctx: AppContext | undefined;
const early: string[] = [];

// Windows/Linux have no dock to keep a windowless app reachable: quit once OS-opened files are done.
async function openAndMaybeQuit(path: string): Promise<void> {
  await openFromOs(ctx!, path);
  if (process.platform !== 'darwin') setTimeout(() => { if (!ctx?.window) app.quit(); }, IDLE_QUIT_MS);
}
const open = (path: string) => (ctx ? void openAndMaybeQuit(path) : early.push(path));

// macOS delivers files (Finder double-click, "Open With", `open -a`) as events, possibly before `ready`.
app.on('open-file', (event, path) => {
  event.preventDefault();
  open(path);
});
app.on('second-instance', (_e, argv, cwd) => {
  const files = projectPathsFromArgv(argv, cwd);
  if (files.length === 0 && ctx) showWindow(ctx);
  files.forEach(open);
});

app.whenReady().then(() => {
  ctx = new AppContext(loadSettings(app.getPath('userData')));
  registerIpc(ctx);
  registerHistoryIpc(ctx);
  startBridge(ctx);
  const files = [...early, ...projectPathsFromArgv(process.argv.slice(1), process.cwd())];
  // The fast path, and launches by the browser extension's host, stay windowless; a plain launch shows the window.
  if (files.length === 0 && !process.argv.includes('--from-browser')) showWindow(ctx);
  files.forEach((f) => void openAndMaybeQuit(f));
  app.on('activate', () => showWindow(ctx!));
});

// macOS apps stay alive without windows so OS file opens skip a cold start.
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
