import { chmodSync, existsSync, rmSync } from 'node:fs';
import { createServer, type Server, type Socket } from 'node:net';
import type { BridgeRequest, BridgeResponse } from '@retarget3mf/bridge';
import { DownloadError } from './download.ts';
import type { FastPathOutcome } from './fastPath.ts';

export interface BridgeDeps {
  version: string;
  status: () => { printer?: string; slicer?: string };
  download: (url: string, name: string) => Promise<string>;
  open: (path: string) => Promise<FastPathOutcome>;
}

const MAX_LINE = 64 * 1024;

/** Handles one request, streaming progress through `send`; never throws. */
export async function handleRequest(request: BridgeRequest, deps: BridgeDeps, send: (r: BridgeResponse) => void): Promise<void> {
  const { id } = request;
  try {
    if (request.type === 'ping') {
      send({ id, type: 'pong', version: deps.version, ...deps.status() });
      return;
    }
    if (request.type !== 'open' || typeof request.url !== 'string' || typeof request.name !== 'string') {
      send({ id, type: 'error', message: 'Unsupported request.' });
      return;
    }
    send({ id, type: 'progress', stage: 'downloading' });
    const path = await deps.download(request.url, request.name);
    send({ id, type: 'progress', stage: 'converting' });
    const outcome = await deps.open(path);
    if (outcome.kind === 'error') send({ id, type: 'error', message: outcome.message });
    else send({ id, type: 'done', outcome: outcome.kind, message: outcome.message });
  } catch (error) {
    if (!(error instanceof DownloadError)) console.error(error);
    send({ id, type: 'error', message: error instanceof DownloadError ? error.message : 'The download failed. Check your connection and try again.' });
  }
}

/** Newline-delimited JSON over a local socket; each connection is one native-host session. */
export function startBridgeServer(path: string, deps: BridgeDeps): Server {
  if (process.platform !== 'win32' && existsSync(path)) rmSync(path);
  const server = createServer((socket: Socket) => {
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      if (buffer.length > MAX_LINE) { socket.destroy(); return; }
      for (let nl = buffer.indexOf('\n'); nl >= 0; nl = buffer.indexOf('\n')) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        let request: BridgeRequest;
        try {
          request = JSON.parse(line) as BridgeRequest;
        } catch {
          continue;
        }
        void handleRequest(request, deps, (r) => { if (!socket.destroyed) socket.write(`${JSON.stringify(r)}\n`); });
      }
    });
    socket.on('error', () => socket.destroy());
  });
  server.listen(path, () => { if (process.platform !== 'win32') chmodSync(path, 0o600); });
  server.on('error', (error) => console.error('bridge server', error));
  return server;
}
