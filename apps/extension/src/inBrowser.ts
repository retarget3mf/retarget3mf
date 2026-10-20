import { isAllowedDownloadUrl } from '@retarget3mf/bridge';
import { convert, inspect, PRINTERS, suggestFilamentMap, type ConversionReport, type SlicerId } from '@retarget3mf/core';

const MAX_BYTES = 512 * 1024 * 1024;
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export class InBrowserError extends Error {}

/** Same checks as the desktop download: allowlisted host before and after redirects, size cap, zip body. */
export async function downloadProject(url: string, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  if (!isAllowedDownloadUrl(url)) throw new InBrowserError('This link is not from a supported model site.');
  const response = await fetchImpl(url, { redirect: 'follow', credentials: 'omit' });
  if (!isAllowedDownloadUrl(response.url || url)) throw new InBrowserError('The download was redirected to an unsupported site.');
  if (!response.ok) throw new InBrowserError(`The model site refused the download (HTTP ${response.status}). The link may have expired; go back to the model page and try again.`);
  if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) throw new InBrowserError('The project is too large (over 512 MB).');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new InBrowserError('The project is too large (over 512 MB).');
  if (ZIP_MAGIC.some((b, i) => bytes[i] !== b)) throw new InBrowserError('The download is not a 3MF project.');
  return bytes;
}

export interface InBrowserResult { output: Uint8Array; report: ConversionReport; title: string; fileName: string }

/** Converts with the desktop fast path's defaults: colours beyond the printer's slots are merged by similarity. */
export async function convertInBrowser(bytes: Uint8Array, name: string, printerId: string, slicer: SlicerId): Promise<InBrowserResult> {
  const printer = PRINTERS.find((p) => p.id === printerId);
  if (!printer) throw new InBrowserError('Choose your printer first.');
  const info = await inspect(bytes);
  const used = info.filaments.filter((f) => f.used);
  const { output, report } = await convert(bytes, { printer: printer.id, slicer, filamentMap: suggestFilamentMap(used, printer.slots.count) });
  const shortName = printer.displayName.replace(new RegExp(`^${printer.vendor} `), '');
  const base = name.replace(/\.3mf$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'model';
  return { output, report, title: info.title || base, fileName: `${base} - ${shortName}.3mf` };
}
