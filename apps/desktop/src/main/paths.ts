import { basename, dirname, extname, join } from 'node:path';

/** `<name> - <printer>.3mf`, next to the original unless a folder is given. */
export function outputPathFor(input: string, printerName: string, folder: string | undefined): string {
  return join(folder ?? dirname(input), `${basename(input, extname(input))} - ${printerName}.3mf`);
}
