// Shared between the browser extension, the native messaging host and the desktop app.

export const NATIVE_HOST_NAME = 'app.retarget3mf.bridge';
/** Fixed by the `key` in the extension manifest (apps/extension/.keys); store IDs are added when published. */
export const EXTENSION_IDS = ['gkpcbbjkoifgehdhgdbegojpjaaplfgp'];
/** Firefox add-on ID (browser_specific_settings.gecko.id in the extension manifest). */
export const FIREFOX_EXTENSION_ID = 'retarget3mf@retarget3mf.app';

export type SourceSite = 'makerworld' | 'crealitycloud' | 'snapmaker' | 'printables';

/** Model sites: display name and the hosts their model pages live on. */
export const SITE_INFO: Record<SourceSite, { name: string; hosts: string[] }> = {
  makerworld: { name: 'MakerWorld', hosts: ['makerworld.com', 'www.makerworld.com'] },
  crealitycloud: { name: 'Creality Cloud', hosts: ['www.crealitycloud.com', 'crealitycloud.com'] },
  snapmaker: { name: 'Snapmaker Space', hosts: ['space.snapmaker.com'] },
  printables: { name: 'Printables', hosts: ['www.printables.com', 'printables.com'] },
};

/** A model page URL is only kept (and later opened) if it is https on the site's own host. */
export function isSitePageUrl(raw: string, site: SourceSite): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password && SITE_INFO[site].hosts.includes(url.hostname);
  } catch {
    return false;
  }
}

export type BridgeRequest =
  | { id: number; type: 'ping' }
  | { id: number; type: 'open'; url: string; name: string; site: SourceSite; pageUrl: string };

export type BridgeResponse =
  | { id: number; type: 'pong'; version: string; printer?: string; slicer?: string }
  | { id: number; type: 'progress'; stage: 'downloading' | 'converting' | 'opening' }
  | { id: number; type: 'done'; outcome: 'opened' | 'converted' | 'review'; message: string }
  | { id: number; type: 'error'; message: string };

// File hosts of the supported model sites. MakerWorld: the hosts BambuStudio itself trusts (GUI_App.cpp
// is_trusted_model_download_url). Creality Cloud and Snapmaker Space: file CDNs referenced by their site code
// (2026-10-20) plus the Creality bucket reported by mbv06/slicer-uri-bridge.
const DOWNLOAD_HOSTS = new Set([
  'makerworld.bblmw.com', 'public-cdn.bblmw.com', 'makerworld.bblmw.cn',
  'or-cloud-makerlab-prod.s3-accelerate.amazonaws.com', 'sh-makerlab-prod.oss-cn-shanghai.aliyuncs.com',
  'file-cdn.creality.com', 'file2-cdn.creality.com', 'internal-creality-usa.oss-accelerate.aliyuncs.com',
  'cdn-model.snapmaker.com', 'public.resource.snapmaker.com',
]);

/** Only https downloads from known model-site CDNs, without credentials in the URL. */
export function isAllowedDownloadUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  // Printables: PrusaSlicer itself downloads from any printables.com subdomain (Downloader.cpp start_download).
  const isPrintables = url.hostname === 'printables.com' || url.hostname.endsWith('.printables.com');
  return url.protocol === 'https:' && !url.username && !url.password && (DOWNLOAD_HOSTS.has(url.hostname) || isPrintables);
}

export interface SlicerLink { url: string; name: string }

export const SLICER_SCHEMES = /^(bambustudio|bambustudioopen|bambusuite|crealityprintlink|snapmaker-orca|prusaslicer):\/\//i;

/**
 * The project URL inside a slicer deep link:
 * - MakerWorld: `bambustudio://open?file=<enc url&name=…>`, `bambustudioopen://<enc>` (macOS), `bambusuite://open?file=…`;
 *   the name sits inside the encoded URL.
 * - Creality Cloud: `crealityprintlink://open?file=<enc>&name=<enc>&code=…&lang=…` (the login `code` is ignored).
 * - Snapmaker Space: `snapmaker-orca://open?file=<enc>&name=<enc>`.
 * - Printables: `prusaslicer://open?file=<enc url>`; like PrusaSlicer, everything after `file=` is the URL.
 */
export function parseSlicerLink(href: string): SlicerLink | undefined {
  if (!SLICER_SCHEMES.test(href)) return undefined;
  let file: string | undefined;
  let name: string | undefined;
  try {
    const mac = href.match(/^bambustudioopen:\/\/(.+)$/i);
    const prusa = href.match(/^prusaslicer:\/\/open\/?\?file=(.+)$/i);
    if (mac) file = decodeURIComponent(mac[1]!);
    else if (prusa) file = decodeURIComponent(prusa[1]!);
    else {
      const query = new URLSearchParams(href.slice(href.indexOf('?') + 1));
      file = query.get('file') ?? undefined;
      name = query.get('name') ?? undefined;
    }
  } catch {
    return undefined;
  }
  // Malformed escapes decode to U+FFFD; anything that is not a plain https URL is not a project link.
  if (!file || !/^https:\/\/[^\uFFFD]+$/.test(file)) return undefined;
  const at = file.lastIndexOf('&name=');
  const url = at >= 0 ? file.slice(0, at) : file;
  const base = name ?? (at >= 0 ? file.slice(at + 6) : (url.split('?')[0]!.split('/').pop() ?? 'model'));
  return { url, name: base.toLowerCase().endsWith('.3mf') ? base : `${base}.3mf` };
}

/** The desktop app's own scheme: the fallback hand-off when the native messaging host cannot be reached. */
export const APP_SCHEME = 'retarget3mf';

export interface OpenLink { url: string; name: string; site: SourceSite; pageUrl: string }

export function buildOpenLink(link: OpenLink): string {
  return `${APP_SCHEME}://open?${new URLSearchParams({ url: link.url, name: link.name, site: link.site, page: link.pageUrl })}`;
}

/** Any web page can launch this link, so it gets the same checks as a native message; an off-site page URL is dropped. */
export function parseOpenLink(href: string): OpenLink | undefined {
  if (!href.toLowerCase().startsWith(`${APP_SCHEME}://open?`)) return undefined;
  const query = new URLSearchParams(href.slice(href.indexOf('?') + 1));
  const url = query.get('url') ?? '';
  const site = query.get('site') as SourceSite;
  if (!isAllowedDownloadUrl(url) || !(site in SITE_INFO)) return undefined;
  const pageUrl = query.get('page') ?? '';
  return { url, name: query.get('name') || 'model', site, pageUrl: isSitePageUrl(pageUrl, site) ? pageUrl : '' };
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
