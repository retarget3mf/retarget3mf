import { execFile, spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import type { SlicerInstall, SlicerKind } from '../shared/api.ts';

interface SlicerSpec {
  name: string;
  macBundleIds: string[];
  /** Matched against DisplayName in the Windows uninstall registry. */
  winDisplayName: RegExp;
  winExe: string;
  linuxBins: string[];
  flatpakIds: string[];
  appImage: RegExp;
}

// Identifiers verified against the installed app (Flash Studio) and the OrcaSlicer v2.4.2 sources (CMakeLists.txt:160, scripts/flatpak).
export const SLICERS: Record<SlicerKind, SlicerSpec> = {
  flashstudio: {
    name: 'Flash Studio',
    macBundleIds: ['com.flashforge.orca-flashforge'],
    winDisplayName: /^(Flash Studio|Orca-Flashforge)\b/i,
    winExe: 'Flash Studio.exe',
    linuxBins: ['flash studio', 'flash-studio'],
    flatpakIds: [],
    appImage: /^(flash[ _-]?studio|orca[_-]flashforge).*\.appimage$/i,
  },
  orca: {
    name: 'OrcaSlicer',
    macBundleIds: ['com.orcaslicer.OrcaSlicer', 'com.softfever3d.orca-slicer'],
    winDisplayName: /^OrcaSlicer\b/i,
    winExe: 'orca-slicer.exe',
    linuxBins: ['orca-slicer', 'OrcaSlicer'],
    flatpakIds: ['com.orcaslicer.OrcaSlicer', 'io.github.softfever.OrcaSlicer'],
    appImage: /^orca[_-]?slicer.*\.appimage$/i,
  },
};
export const SLICER_NAMES: Record<SlicerKind, string> = { flashstudio: SLICERS.flashstudio.name, orca: SLICERS.orca.name };
const FLATPAK = 'flatpak:';
const UNINSTALL = 'Microsoft\\Windows\\CurrentVersion\\Uninstall';
const UNINSTALL_KEYS = [`HKCU\\SOFTWARE\\${UNINSTALL}`, `HKLM\\SOFTWARE\\${UNINSTALL}`, `HKLM\\SOFTWARE\\WOW6432Node\\${UNINSTALL}`];

function run(command: string, args: string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 5000, windowsHide: true }, (err, stdout) => resolve(err ? undefined : stdout));
  });
}

/** `reg query ... /s` output → one record per key. */
export function parseRegistry(text: string): Record<string, string>[] {
  const entries: Record<string, string>[] = [];
  let current: Record<string, string> | undefined;
  for (const line of text.split(/\r?\n/)) {
    if (/^HKEY_/.test(line)) { current = {}; entries.push(current); continue; }
    const m = line.match(/^\s+(\S[^\t]*?)\s+REG_\w+\s+(.*)$/);
    if (m && current) current[m[1]!] = m[2]!.trim();
  }
  return entries;
}

/** Executable path from an uninstall entry: InstallLocation + exe, else DisplayIcon ("C:\x\a.exe",0). */
export function exeFromUninstallEntry(entry: Record<string, string>, exe: string): string | undefined {
  const fromIcon = entry.DisplayIcon?.replace(/^"|"?(,\s*-?\d+)?$/g, '');
  const candidates = [entry.InstallLocation && join(entry.InstallLocation.replace(/^"|"$/g, ''), exe), fromIcon?.toLowerCase().endsWith('.exe') ? fromIcon : undefined];
  return candidates.find((p): p is string => Boolean(p));
}

async function findMac(spec: SlicerSpec): Promise<string | undefined> {
  const fixed = [`/Applications/${spec.name}.app`, join(homedir(), 'Applications', `${spec.name}.app`)].find((p) => existsSync(p));
  if (fixed) return fixed;
  for (const id of spec.macBundleIds) {
    const out = await run('mdfind', [`kMDItemCFBundleIdentifier == '${id}'`]);
    const path = out?.split('\n').find((l) => l.endsWith('.app'));
    if (path) return path;
  }
  return undefined;
}

async function findWindows(spec: SlicerSpec): Promise<string | undefined> {
  for (const key of UNINSTALL_KEYS) {
    const out = await run('reg', ['query', key, '/s']);
    for (const entry of out ? parseRegistry(out) : []) {
      if (!entry.DisplayName || !spec.winDisplayName.test(entry.DisplayName)) continue;
      const exe = exeFromUninstallEntry(entry, spec.winExe);
      if (exe && existsSync(exe)) return exe;
    }
  }
  const roots = [process.env.ProgramFiles, process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs')].filter((r): r is string => Boolean(r));
  return roots.map((r) => join(r, spec.name, spec.winExe)).find((p) => existsSync(p));
}

async function findLinux(spec: SlicerSpec): Promise<string | undefined> {
  const dirs = (process.env.PATH ?? '').split(delimiter);
  const bin = spec.linuxBins.flatMap((b) => dirs.map((d) => join(d, b))).find((p) => existsSync(p));
  if (bin) return bin;
  for (const id of spec.flatpakIds) if (await run('flatpak', ['info', id])) return `${FLATPAK}${id}`;
  for (const dir of ['Applications', 'Downloads', '.local/bin'].map((d) => join(homedir(), d))) {
    const hit = existsSync(dir) ? readdirSync(dir).find((f) => spec.appImage.test(f)) : undefined;
    if (hit) return join(dir, hit);
  }
  return undefined;
}

export async function discoverSlicers(overrides: Partial<Record<SlicerKind, string>>, platform = process.platform): Promise<SlicerInstall[]> {
  const find = platform === 'darwin' ? findMac : platform === 'win32' ? findWindows : findLinux;
  const found = await Promise.all((Object.keys(SLICERS) as SlicerKind[]).map(async (kind) => {
    const override = overrides[kind];
    const path = override && existsSync(override) ? override : await find(SLICERS[kind]);
    return path ? [{ kind, name: SLICERS[kind].name, path }] : [];
  }));
  return found.flat();
}

/** Command that opens `file` as a project (a fresh slicer process loads argv as a project; docs/research.md §1). */
export function launchCommand(slicerPath: string, file: string, platform = process.platform): { command: string; args: string[] } {
  if (slicerPath.startsWith(FLATPAK)) return { command: 'flatpak', args: ['run', `--file-forwarding`, slicerPath.slice(FLATPAK.length), '@@', file, '@@'] };
  if (platform === 'darwin') return { command: 'open', args: ['-a', slicerPath, file] };
  return { command: slicerPath, args: [file] };
}

export function launchSlicer(slicerPath: string, file: string): Promise<void> {
  const { command, args } = launchCommand(slicerPath, file);
  if (command === 'open') {
    return new Promise((resolve, reject) => execFile(command, args, (err) => (err ? reject(err) : resolve())));
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
