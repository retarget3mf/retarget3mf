import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { isAllowedDownloadUrl } from '@retarget3mf/bridge';

const MAX_BYTES = 512 * 1024 * 1024;
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/** Safe file name: no path separators or characters Windows rejects; always .3mf. */
export function safeFileName(name: string): string {
  const base = name.replace(/\.3mf$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim().slice(0, 120) || 'model';
  return `${base}.3mf`;
}

export class DownloadError extends Error {}

/**
 * Downloads a model-site project into `folder`. URLs come from a web page via the extension, so the host is
 * checked before and after redirects, the size is capped and the body must be a zip.
 */
export async function downloadProject(url: string, name: string, folder: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (!isAllowedDownloadUrl(url)) throw new DownloadError('This link is not from a supported model site.');
  const response = await fetchImpl(url, { redirect: 'follow', credentials: 'omit' });
  if (!isAllowedDownloadUrl(response.url || url)) throw new DownloadError('The download was redirected to an unsupported site.');
  if (!response.ok || !response.body) throw new DownloadError(`The model site refused the download (HTTP ${response.status}). The link may have expired; try again.`);
  if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) throw new DownloadError('The project is too large (over 512 MB).');

  await mkdir(folder, { recursive: true });
  const target = join(folder, safeFileName(name));
  const partial = `${target}.part`;
  let size = 0;
  let head: number[] = [];
  const guard = async function* (source: AsyncIterable<Uint8Array>) {
    for await (const chunk of source) {
      size += chunk.length;
      if (size > MAX_BYTES) throw new DownloadError('The project is too large (over 512 MB).');
      if (head.length < 4) head = [...head, ...chunk.subarray(0, 4 - head.length)];
      yield chunk;
    }
  };
  try {
    await pipeline(Readable.fromWeb(response.body as never), guard, createWriteStream(partial));
    if (ZIP_MAGIC.some((b, i) => head[i] !== b)) throw new DownloadError('The download is not a 3MF project.');
    await rename(partial, target);
    return target;
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
}
