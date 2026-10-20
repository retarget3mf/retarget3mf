import { userInfo } from 'node:os';
import { join } from 'node:path';

/** Per-user endpoint between the native messaging host and the running app (no TCP port, unreachable from web pages). */
export function bridgeSocketPath(userData: string, platform = process.platform): string {
  if (platform === 'win32') return `\\\\.\\pipe\\retarget3mf-${userInfo().username.replace(/[^\w.-]/g, '_')}`;
  return join(userData, 'bridge.sock');
}
