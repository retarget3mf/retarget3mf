// Native messaging host. Chrome starts it per extension connection; it relays framed stdio messages to the running
// desktop app over the per-user socket, starting the app when needed. Runs as plain Node (ELECTRON_RUN_AS_NODE=1).
import { spawn } from 'node:child_process';
import { connect, type Socket } from 'node:net';
import { decodeNativeMessages, encodeNativeMessage, type BridgeRequest } from '@retarget3mf/bridge';

const STARTUP_TIMEOUT_MS = 20_000;
const RETRY_MS = 300;

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const socketPath = flag('--socket')!;
const appExec = flag('--app')!;
const appArgs = process.argv.flatMap((a, i) => (process.argv[i - 1] === '--app-arg' ? [a] : []));

const write = (message: unknown) => process.stdout.write(encodeNativeMessage(message));
const pending: BridgeRequest[] = [];
let socket: Socket | undefined;
let connecting = false;

function tryConnect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(socketPath);
    s.once('connect', () => resolve(s));
    s.once('error', reject);
  });
}

async function ensureSocket(): Promise<void> {
  if (socket || connecting) return;
  connecting = true;
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let started = false;
  for (;;) {
    try {
      socket = await tryConnect();
      break;
    } catch {
      if (!started) {
        // The app's own single-instance lock makes a second start harmless.
        const env = { ...process.env };
        delete env.ELECTRON_RUN_AS_NODE;
        spawn(appExec, [...appArgs, '--from-browser'], { detached: true, stdio: 'ignore', env }).unref();
        started = true;
      }
      if (Date.now() > deadline) {
        for (const r of pending.splice(0)) write({ id: r.id, type: 'error', message: 'Retarget3MF could not be started. Open it once, then try again.' });
        connecting = false;
        return;
      }
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }
  connecting = false;
  let buffer = '';
  socket.setEncoding('utf8');
  socket.on('data', (chunk: string) => {
    buffer += chunk;
    for (let nl = buffer.indexOf('\n'); nl >= 0; nl = buffer.indexOf('\n')) {
      write(JSON.parse(buffer.slice(0, nl)));
      buffer = buffer.slice(nl + 1);
    }
  });
  socket.on('close', () => process.exit(0));
  for (const r of pending.splice(0)) socket.write(`${JSON.stringify(r)}\n`);
}

let input: Uint8Array = new Uint8Array(0);
process.stdin.on('data', (chunk: Buffer) => {
  const { messages, rest } = decodeNativeMessages(new Uint8Array([...input, ...chunk]));
  input = rest;
  for (const m of messages as BridgeRequest[]) {
    if (socket) socket.write(`${JSON.stringify(m)}\n`);
    else { pending.push(m); void ensureSocket(); }
  }
});
process.stdin.on('end', () => process.exit(0));
