import { basename, dirname, extname, join } from 'node:path';
import { DEFAULT_FILE_NAME } from '../shared/api.ts';

/** The file name pattern filled in (`{name}`, `{printer}`, `{slicer}`), next to the original unless a folder is given. */
export function outputPathFor(input: string, names: { printer: string; slicer: string }, folder: string | undefined, pattern = DEFAULT_FILE_NAME): string {
  const values: Record<string, string> = { name: basename(input, extname(input)), printer: names.printer, slicer: names.slicer };
  const file = pattern.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all).replace(/[\\/:*?"<>|]/g, '-');
  return join(folder ?? dirname(input), `${file}.3mf`);
}
