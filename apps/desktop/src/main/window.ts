import { join } from 'node:path';
import { BrowserWindow, nativeTheme, shell } from 'electron';
import type { AppContext } from './context.ts';

export function showWindow(ctx: AppContext): BrowserWindow {
  if (ctx.window) {
    if (ctx.window.isMinimized()) ctx.window.restore();
    ctx.window.show();
    ctx.window.focus();
    return ctx.window;
  }
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: 'Retarget3MF',
    // The renderer draws a 40px title bar; macOS keeps its traffic lights, Windows and Linux get overlay controls.
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 14, y: 14 } } : { titleBarOverlay: overlay() }),
    webPreferences: { preload: join(import.meta.dirname, '../preload/index.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  // No remote content: block navigation and new windows; external links go to the OS browser.
  window.webContents.on('will-navigate', (e) => e.preventDefault());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.on('closed', () => ctx.windowClosed());
  if (process.platform !== 'darwin') {
    const follow = () => window.setTitleBarOverlay(overlay());
    nativeTheme.on('updated', follow);
    window.on('closed', () => nativeTheme.off('updated', follow));
  }
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  ctx.window = window;
  return window;
}

const TITLE_BAR_HEIGHT = 40;

function overlay(): Electron.TitleBarOverlayOptions {
  const dark = nativeTheme.shouldUseDarkColors;
  return { height: TITLE_BAR_HEIGHT, color: dark ? '#121314' : '#f4f4f2', symbolColor: dark ? '#e9e9ea' : '#161616' };
}
