import { unzipSync, zipSync, strFromU8, strToU8, type Zippable } from 'fflate';
import { ConversionError } from './errors.ts';

/** Ordered archive contents; insertion order is the output order. */
export type Archive = Map<string, Uint8Array>;

// Fixed timestamp keeps output byte-stable for golden tests.
const FIXED_MTIME = new Date('2000-01-01T00:00:00Z');

export function readArchive(data: Uint8Array): Archive {
  try {
    return new Map(Object.entries(unzipSync(data)));
  } catch (cause) {
    throw new ConversionError('not-a-zip', 'This file is not a valid .3mf project (it could not be opened as an archive). Download the 3MF again and retry.', { cause });
  }
}

export function writeArchive(archive: Archive): Uint8Array {
  const files: Zippable = {};
  for (const [path, data] of archive) files[path] = [data, { level: path.endsWith('.png') ? 0 : 6 }];
  return zipSync(files, { mtime: FIXED_MTIME });
}

export function readText(archive: Archive, path: string): string | undefined {
  const data = archive.get(path);
  return data && strFromU8(data);
}

export function setText(archive: Archive, path: string, text: string): void {
  archive.set(path, strToU8(text));
}
