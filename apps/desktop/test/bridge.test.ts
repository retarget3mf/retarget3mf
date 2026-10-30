import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';
import { decodeNativeMessages, encodeNativeMessage, type BridgeResponse } from '@retarget3mf/bridge';
import { handleRequest, startBridgeServer, type BridgeDeps } from '../src/main/bridgeServer.ts';
import { downloadProject, DownloadError, safeFileName } from '../src/main/download.ts';
import { hostManifest, hostTargets, launcherScript } from '../src/main/nativeHost.ts';

const URL_OK = 'https://makerworld.bblmw.com/makerworld/model/x/1/instance/a.3mf?exp=1&key=k';
const deps = (over: Partial<BridgeDeps> = {}): BridgeDeps => ({
  version: '0.1.0',
  status: () => ({ printer: 'Flashforge AD5X', slicer: 'Flash Studio' }),
  download: async () => '/tmp/a.3mf',
  open: async () => ({ kind: 'opened', message: 'Opened', outputPath: '/tmp/a - AD5X.3mf' }),
  setTarget: async () => {},
  ...over,
});
const collect = async (request: Parameters<typeof handleRequest>[0], d: BridgeDeps) => {
  const out: BridgeResponse[] = [];
  await handleRequest(request, d, (r) => out.push(r));
  return out;
};

describe('bridge requests', () => {
  it('answers ping with status', async () => {
    expect(await collect({ id: 1, type: 'ping' }, deps())).toEqual([{ id: 1, type: 'pong', version: '0.1.0', printer: 'Flashforge AD5X', slicer: 'Flash Studio' }]);
  });

  it('streams progress then the outcome of an open', async () => {
    const out = await collect({ id: 2, type: 'open', url: URL_OK, name: 'a', site: 'makerworld', pageUrl: '' }, deps());
    expect(out.map((r) => (r.type === 'progress' ? r.stage : r.type))).toEqual(['downloading', 'converting', 'done']);
  });

  it('reports download problems in plain words', async () => {
    const out = await collect({ id: 3, type: 'open', url: 'x', name: 'a', site: 'makerworld', pageUrl: '' }, deps({ download: async () => { throw new DownloadError('This link is not from a supported model site.'); } }));
    expect(out.at(-1)).toEqual({ id: 3, type: 'error', message: 'This link is not from a supported model site.' });
  });

  it('opens a downloaded .3mf and keeps its model page only when it is on the site', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'dl-')), 'cube.3mf');
    writeFileSync(path, 'x');
    const seen: unknown[] = [];
    const d = deps({ open: async (p, origin) => { seen.push([p, origin]); return { kind: 'opened', message: 'Opened', outputPath: p }; } });
    expect((await collect({ id: 4, type: 'open-file', path, site: 'printables', pageUrl: 'https://www.printables.com/model/1' }, d)).at(-1)).toMatchObject({ type: 'done' });
    await collect({ id: 5, type: 'open-file', path, site: 'printables', pageUrl: 'https://evil.example/' }, d);
    expect(seen).toEqual([[path, { site: 'printables', pageUrl: 'https://www.printables.com/model/1' }], [path, undefined]]);
  });

  it('applies a printer and slicer chosen in the extension and answers with the new status', async () => {
    const seen: string[][] = [];
    const out = await collect({ id: 7, type: 'set-target', printer: 'bambu-x1c-0.4', slicer: 'bambustudio' }, deps({ setTarget: async (p, s) => { seen.push([p, s]); } }));
    expect(seen).toEqual([['bambu-x1c-0.4', 'bambustudio']]);
    expect(out).toEqual([expect.objectContaining({ id: 7, type: 'pong' })]);
  });

  it('refuses paths that are not existing .3mf files', async () => {
    for (const path of ['relative.3mf', '/etc/passwd', join(tmpdir(), 'missing-xyz.3mf')]) {
      expect((await collect({ id: 6, type: 'open-file', path }, deps())).at(-1)).toMatchObject({ type: 'error' });
    }
  });
});

describe('downloadProject', () => {
  const zip = zipSync({ 'a.txt': strToU8('x') });
  const fakeFetch = (body: Uint8Array<ArrayBuffer>, url = URL_OK, status = 200) =>
    (async () => Object.defineProperty(new Response(body, { status }), 'url', { value: url })) as unknown as typeof fetch;

  it('saves a zip from an allowed host under a safe name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dl-'));
    const path = await downloadProject(URL_OK, '../Carabiner: Heart', dir, fakeFetch(zip));
    expect(path).toBe(join(dir, '.._Carabiner_ Heart.3mf'.replace(/^\.+/, '')));
    expect(readFileSync(path)).toEqual(Buffer.from(zip));
  });

  it('refuses other hosts, redirects off the allowlist and non-zip bodies', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dl-'));
    await expect(downloadProject('https://evil.example/a.3mf', 'a', dir, fakeFetch(zip))).rejects.toThrow(/not from a supported/);
    await expect(downloadProject(URL_OK, 'a', dir, fakeFetch(zip, 'https://evil.example/a.3mf'))).rejects.toThrow(/redirected/);
    await expect(downloadProject(URL_OK, 'a', dir, fakeFetch(strToU8('<html>')))).rejects.toThrow(/not a 3MF/);
    expect(existsSync(join(dir, 'a.3mf.part'))).toBe(false);
  });

  it('keeps names inside the folder', () => {
    expect(safeFileName('../../etc/passwd')).toBe('_.._etc_passwd.3mf');
    expect(safeFileName('model.3MF')).toBe('model.3mf');
  });
});

describe('native host registration', () => {
  it('targets Chrome-family folders on macOS, with Brave reading Chrome’s', () => {
    const t = hostTargets('darwin', '/Users/u');
    expect(t.find((x) => x.browser === 'Chrome')!.location).toBe('/Users/u/Library/Application Support/Google/Chrome/NativeMessagingHosts');
    expect(t.find((x) => x.browser === 'Brave')!.location).toBe('/Users/u/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts');
    expect(t.find((x) => x.browser === 'Dia')!.location).toBe('/Users/u/Library/Application Support/Dia/User Data/NativeMessagingHosts');
    expect(t.find((x) => x.browser === 'Firefox')).toMatchObject({ location: '/Users/u/Library/Application Support/Mozilla/NativeMessagingHosts', firefox: true });
  });

  it('uses HKCU registry keys on Windows', () => {
    expect(hostTargets('win32', 'C:\\Users\\u', 'C:\\AppData').map((t) => t.location)[0]).toBe('HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\app.retarget3mf.bridge');
  });

  it('pins the manifest to our extension and runs the host with plain Node', () => {
    expect(hostManifest('/h/host', true)).toMatchObject({ allowed_extensions: ['retarget3mf@retarget3mf.app'] });
    expect(hostManifest('/h/host', true)).not.toHaveProperty('allowed_origins');
    expect(hostManifest('/h/host')).toMatchObject({ type: 'stdio', path: '/h/host', allowed_origins: [expect.stringMatching(/^chrome-extension:\/\/[a-p]{32}\/$/)] });
    const sh = launcherScript({ electron: '/A/Electron', hostScript: '/A/host.js', socket: '/s.sock', appExec: '/A/Electron', appArgs: ['/app'] }, 'darwin');
    expect(sh).toMatch(/^#!\/bin\/sh\nELECTRON_RUN_AS_NODE=1 exec "\/A\/Electron" "\/A\/host.js" --socket "\/s.sock" --app "\/A\/Electron" --app-arg "\/app" "\$@"/);
  });
});

describe('native host ↔ app socket (integration)', () => {
  let close: (() => void) | undefined;
  afterEach(() => close?.());

  it('relays framed browser messages to the running app and back', async () => {
    const socket = process.platform === 'win32' ? `\\\\.\\pipe\\retarget3mf-test-${process.pid}` : join(mkdtempSync(join(tmpdir(), 'sock-')), 'b.sock');
    const server = startBridgeServer(socket, deps());
    close = () => server.close();
    await new Promise((r) => server.once('listening', r));
    const host = spawn(process.execPath, [fileURLToPath(new URL('../src/host/index.ts', import.meta.url)), '--socket', socket, '--app', '/usr/bin/false'], { stdio: ['pipe', 'pipe', 'inherit'] });
    host.stdin.write(encodeNativeMessage({ id: 7, type: 'ping' }));
    host.stdin.write(encodeNativeMessage({ id: 8, type: 'open', url: URL_OK, name: 'a', site: 'makerworld', pageUrl: '' }));
    const replies: BridgeResponse[] = [];
    let buffer: Uint8Array = new Uint8Array(0);
    await new Promise<void>((resolve) => host.stdout.on('data', (chunk: Buffer) => {
      const { messages, rest } = decodeNativeMessages(new Uint8Array([...buffer, ...chunk]));
      buffer = rest;
      replies.push(...(messages as BridgeResponse[]));
      if (replies.some((r) => r.id === 8 && r.type === 'done')) resolve();
    }));
    host.stdin.end();
    expect(replies.find((r) => r.id === 7)).toMatchObject({ type: 'pong', version: '0.1.0' });
    expect(replies.filter((r) => r.id === 8).map((r) => r.type)).toEqual(['progress', 'progress', 'done']);
  });
});
