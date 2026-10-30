import { execFile, spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { app, dialog } from 'electron';
import { isAllowedDownloadUrl, LINK_SCHEMES, linkScheme, parseSlicerLink, type LinkScheme } from '@retarget3mf/bridge';
import { PRINTERS } from '@retarget3mf/core';
import { convertLink } from './bridge.ts';
import type { AppContext } from './context.ts';
import { showError } from './fastPath.ts';
import { regDefaultValue, windowsCommand } from './linkHandlers.ts';

const run = promisify(execFile);
const SCHEMES = Object.keys(LINK_SCHEMES) as LinkScheme[];

/**
 * The handler each scheme had before Retarget3MF took it: `target` launches it (macOS app path, Windows open command,
 * Linux desktop id); on Windows `previous` is the per-user command to put back, or "-" when there was no per-user key.
 */
interface Handler { target: string; previous?: string }
type Saved = Partial<Record<LinkScheme, Handler>>;

const savedPath = () => join(app.getPath('userData'), 'link-handlers.json');
async function loadSaved(): Promise<Saved> {
  try {
    return JSON.parse(await readFile(savedPath(), 'utf8')) as Saved;
  } catch {
    return {};
  }
}

const ownArgs = () => (app.isPackaged ? [] : [app.getAppPath()]);
const winKey = (scheme: string) => `HKCU\\Software\\Classes\\${scheme}`;
const BACKUP_KEY = 'HKCU\\Software\\Retarget3MF\\LinkHandlers';

async function regQuery(key: string): Promise<string | undefined> {
  try {
    return regDefaultValue((await run('reg', ['query', key, '/ve'])).stdout);
  } catch {
    return undefined;
  }
}

async function linuxHandler(scheme: string): Promise<string | undefined> {
  try {
    return (await run('xdg-mime', ['query', 'default', `x-scheme-handler/${scheme}`])).stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

const OWN_DESKTOP = 'retarget3mf.desktop';

async function isOurs(scheme: LinkScheme): Promise<boolean> {
  if (process.platform === 'linux') return (await linuxHandler(scheme)) === OWN_DESKTOP;
  return app.isDefaultProtocolClient(scheme, process.execPath, ownArgs());
}

/** Records who handles `scheme` now, so links can be passed on and the handler restored later. */
async function currentHandler(scheme: LinkScheme): Promise<Handler | undefined> {
  if (process.platform === 'darwin') {
    const info = await app.getApplicationInfoForProtocol(`${scheme}://`).catch(() => undefined);
    return info?.path ? { target: info.path } : undefined;
  }
  if (process.platform === 'win32') {
    const target = await regQuery(`HKCR\\${scheme}\\shell\\open\\command`);
    const previous = (await regQuery(`${winKey(scheme)}\\shell\\open\\command`)) ?? '-';
    return target ? { target, previous } : { target: '', previous };
  }
  const target = await linuxHandler(scheme);
  return target ? { target } : undefined;
}

async function register(scheme: LinkScheme): Promise<boolean> {
  if (process.platform === 'linux') {
    // An AppImage installs no desktop entry for the link to point at.
    if (process.env.APPIMAGE) return false;
    return run('xdg-mime', ['default', OWN_DESKTOP, `x-scheme-handler/${scheme}`]).then(() => true, () => false);
  }
  return app.setAsDefaultProtocolClient(scheme, process.execPath, ownArgs());
}

async function restore(scheme: LinkScheme, handler: Handler | undefined): Promise<void> {
  if (process.platform === 'darwin') {
    // macOS hands the scheme to the next app that declares it, normally the slicer.
    app.removeAsDefaultProtocolClient(scheme);
    return;
  }
  if (process.platform === 'win32') {
    const previous = handler?.previous ?? '-';
    await (previous === '-'
      ? run('reg', ['delete', winKey(scheme), '/f'])
      : run('reg', ['add', `${winKey(scheme)}\\shell\\open\\command`, '/ve', '/d', previous, '/f'])).catch(() => undefined);
    await run('reg', ['delete', BACKUP_KEY, '/v', scheme, '/f']).catch(() => undefined);
    return;
  }
  if (handler?.target) await run('xdg-mime', ['default', handler.target, `x-scheme-handler/${scheme}`]).catch(() => undefined);
}

/**
 * Takes the model sites' slicer links when the setting is on and gives them back when it is off. Packaged builds only:
 * a dev run would register a bare Electron binary. Runs at launch and after each settings change.
 */
export async function syncSlicerLinks(ctx: AppContext): Promise<void> {
  if (!app.isPackaged) return;
  const saved = await loadSaved();
  const next: Saved = {};
  let failed = false;
  for (const scheme of SCHEMES) {
    const ours = await isOurs(scheme);
    if (!ctx.settings.slicerLinks) {
      if (ours || saved[scheme]) await restore(scheme, saved[scheme]);
      continue;
    }
    if (ours && saved[scheme]) {
      next[scheme] = saved[scheme];
      continue;
    }
    const handler = ours ? saved[scheme] : await currentHandler(scheme);
    if (handler) next[scheme] = handler;
    if (process.platform === 'win32' && handler?.previous) {
      // The uninstaller reads these to put the slicers' handlers back (build/installer.nsh).
      await run('reg', ['add', BACKUP_KEY, '/v', scheme, '/d', handler.previous, '/f']).catch(() => undefined);
    }
    if (!(await register(scheme))) failed = true;
  }
  if (Object.keys(next).length) await writeFile(savedPath(), JSON.stringify(next, null, 2));
  else await rm(savedPath(), { force: true });
  if (failed) showError(ctx, 'Retarget3MF could not take over every "Open in slicer" link on this computer.');
}

/** Hands a link to the program that handled it before Retarget3MF. */
async function passThrough(scheme: LinkScheme, href: string, handler: Handler | undefined): Promise<boolean> {
  const detached = (file: string, args: string[]) => spawn(file, args, { detached: true, stdio: 'ignore' }).unref();
  if (process.platform === 'darwin') {
    if (handler?.target) detached('open', ['-a', handler.target, href]);
    else {
      app.removeAsDefaultProtocolClient(scheme);
      detached('open', [href]);
    }
    return true;
  }
  if (!handler?.target) return false;
  if (process.platform === 'win32') {
    const command = windowsCommand(handler.target, href);
    if (!command) return false;
    detached(command.file, command.args);
    return true;
  }
  detached('gtk-launch', [handler.target.replace(/\.desktop$/, ''), href]);
  return true;
}

/** A model site's "Open in <slicer>" link: convert it for the current printer, or pass it on to the slicer. */
export async function handleSlicerLink(ctx: AppContext, href: string): Promise<void> {
  const scheme = linkScheme(href);
  if (!scheme) return;
  const handler = (await loadSaved())[scheme];
  const { site, slicer } = LINK_SCHEMES[scheme];
  // macOS can deliver these links while the setting is off (the app declares the schemes); pass them on unchanged.
  if (!ctx.settings.slicerLinks) {
    await passThrough(scheme, href, handler);
    return;
  }
  const link = parseSlicerLink(href);
  const printer = PRINTERS.find((p) => p.id === ctx.settings.printer);
  if (!link || !isAllowedDownloadUrl(link.url) || !printer) {
    if (!(await passThrough(scheme, href, handler))) showError(ctx, `This ${slicer} link is not a project Retarget3MF can open.`);
    return;
  }
  const canPass = Boolean(handler?.target);
  const buttons = [`Convert for ${printer.displayName}`, ...(canPass ? [`Open in ${slicer}`] : []), 'Cancel'];
  const { response } = await dialog.showMessageBox({
    type: 'question',
    message: `Open ${link.name}`,
    detail: `This project was sent to ${slicer}. Retarget3MF can convert it for your ${printer.displayName} instead.`,
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
  });
  if (response === 0) await convertLink(ctx, { ...link, site, pageUrl: '' });
  else if (canPass && response === 1) await passThrough(scheme, href, handler);
}
