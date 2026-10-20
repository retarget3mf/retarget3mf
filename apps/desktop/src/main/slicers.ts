import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SlicerInstall, SlicerKind } from '../shared/api.ts';

export const SLICER_NAMES: Record<SlicerKind, string> = { flashstudio: 'Flash Studio', orca: 'OrcaSlicer' };

// ponytail: fixed install locations only; registry / mdfind / flatpak discovery comes in M3.
function candidates(kind: SlicerKind, platform: NodeJS.Platform): string[] {
  const app = SLICER_NAMES[kind];
  if (platform === 'darwin') return [`/Applications/${app}.app`, join(homedir(), 'Applications', `${app}.app`)];
  if (platform === 'win32') {
    const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs')].filter(Boolean) as string[];
    const exe = kind === 'orca' ? 'orca-slicer.exe' : 'Flash Studio.exe';
    return roots.map((r) => join(r, app, exe));
  }
  return kind === 'orca' ? ['/usr/bin/orca-slicer', '/usr/local/bin/orca-slicer', join(homedir(), '.local/bin/orca-slicer')] : [];
}

export function detectSlicers(overrides: Partial<Record<SlicerKind, string>>, platform = process.platform): SlicerInstall[] {
  return (Object.keys(SLICER_NAMES) as SlicerKind[]).flatMap((kind) => {
    const path = [overrides[kind], ...candidates(kind, platform)].find((p) => p && existsSync(p));
    return path ? [{ kind, name: SLICER_NAMES[kind], path }] : [];
  });
}

/** Command that opens `file` as a project (a fresh slicer process loads argv as a project; docs/research.md §1). */
export function launchCommand(slicerPath: string, file: string, platform = process.platform): { command: string; args: string[] } {
  if (platform === 'darwin') return { command: 'open', args: ['-a', slicerPath, file] };
  return { command: slicerPath, args: [file] };
}

export function launchSlicer(slicerPath: string, file: string): Promise<void> {
  const { command, args } = launchCommand(slicerPath, file);
  if (process.platform === 'darwin') {
    return new Promise((resolve, reject) => execFile(command, args, (err) => (err ? reject(err) : resolve())));
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
