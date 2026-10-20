// Shared between the browser extension, the native messaging host and the desktop app.

export const NATIVE_HOST_NAME = 'app.retarget3mf.bridge';
/** Fixed by the `key` in the extension manifest (apps/extension/.keys); store IDs are added when published. */
export const EXTENSION_IDS = ['gkpcbbjkoifgehdhgdbegojpjaaplfgp'];

export type SourceSite = 'makerworld';

export type BridgeRequest =
  | { id: number; type: 'ping' }
  | { id: number; type: 'open'; url: string; name: string; site: SourceSite; pageUrl: string };

export type BridgeResponse =
  | { id: number; type: 'pong'; version: string; printer?: string; slicer?: string }
  | { id: number; type: 'progress'; stage: 'downloading' | 'converting' | 'opening' }
  | { id: number; type: 'done'; outcome: 'opened' | 'converted' | 'review'; message: string }
  | { id: number; type: 'error'; message: string };

// Hosts BambuStudio itself trusts for "Open in Bambu Studio" downloads (BambuStudio GUI_App.cpp is_trusted_model_download_url).
const MAKERWORLD_HOSTS = new Set([
  'makerworld.bblmw.com', 'public-cdn.bblmw.com', 'makerworld.bblmw.cn',
  'or-cloud-makerlab-prod.s3-accelerate.amazonaws.com', 'sh-makerlab-prod.oss-cn-shanghai.aliyuncs.com',
]);

/** Only https downloads from known model-site CDNs, without credentials in the URL. */
export function isAllowedDownloadUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && !url.username && !url.password && MAKERWORLD_HOSTS.has(url.hostname);
}

export interface SlicerLink { url: string; name: string }

/**
 * The project URL inside a slicer deep link: `bambustudio://open?file=<enc>`, `bambustudioopen://<enc>` (macOS) or
 * `bambusuite://open?file=<enc>[&openMode=...]`. MakerWorld appends `&name=<file name>` inside the encoded URL.
 */
export function parseSlicerLink(href: string): SlicerLink | undefined {
  const m = href.match(/^(?:bambustudio|bambusuite):\/\/open\/?\?file=([^&]+)/i) ?? href.match(/^bambustudioopen:\/\/(.+)$/i);
  if (!m) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(m[1]!);
  } catch {
    return undefined;
  }
  const at = decoded.lastIndexOf('&name=');
  const url = at >= 0 ? decoded.slice(0, at) : decoded;
  const name = at >= 0 ? decoded.slice(at + 6) : (url.split('?')[0]!.split('/').pop() ?? 'model.3mf');
  return { url, name: name.toLowerCase().endsWith('.3mf') ? name : `${name}.3mf` };
}

/** Native messaging framing: 32-bit little-endian length, then UTF-8 JSON. */
export function encodeNativeMessage(message: unknown): Uint8Array {
  const body = new TextEncoder().encode(JSON.stringify(message));
  const out = new Uint8Array(4 + body.length);
  new DataView(out.buffer).setUint32(0, body.length, true);
  out.set(body, 4);
  return out;
}

/** Splits complete frames off the front of `buffer`; returns the messages and the unconsumed rest. */
export function decodeNativeMessages(buffer: Uint8Array): { messages: unknown[]; rest: Uint8Array } {
  const messages: unknown[] = [];
  let offset = 0;
  while (buffer.length - offset >= 4) {
    const length = new DataView(buffer.buffer, buffer.byteOffset + offset, 4).getUint32(0, true);
    if (buffer.length - offset - 4 < length) break;
    messages.push(JSON.parse(new TextDecoder().decode(buffer.subarray(offset + 4, offset + 4 + length))));
    offset += 4 + length;
  }
  return { messages, rest: buffer.subarray(offset) };
}
