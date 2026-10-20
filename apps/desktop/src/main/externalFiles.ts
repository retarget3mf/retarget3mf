import { existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { APP_SCHEME } from '@retarget3mf/bridge';

/** retarget3mf:// links on a command line (Windows/Linux protocol launches). */
export function appLinksFromArgv(argv: readonly string[]): string[] {
  return argv.filter((a) => a.toLowerCase().startsWith(`${APP_SCHEME}://`));
}

/** .3mf paths from a command line (Windows/Linux "Open with", second-instance argv); flags and the app path are ignored. */
export function projectPathsFromArgv(argv: readonly string[], cwd: string): string[] {
  return argv
    .filter((a) => !a.startsWith('-') && extname(a).toLowerCase() === '.3mf')
    .map((a) => resolve(cwd, a))
    .filter((p) => existsSync(p));
}
