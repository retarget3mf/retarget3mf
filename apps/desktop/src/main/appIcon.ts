import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
// PNG-carrying icns entries, smallest acceptable first (~128-256 px).
const PREFERRED = ['ic07', 'ic08', 'ic13', 'ic09', 'ic14', 'ic10'];

/** Extracts an embedded PNG from an .icns file (modern icns entries are plain PNGs). */
export function pngFromIcns(icns: Buffer): Buffer | undefined {
  if (icns.subarray(0, 4).toString('latin1') !== 'icns') return undefined;
  const entries = new Map<string, Buffer>();
  for (let i = 8; i + 8 <= icns.length;) {
    const type = icns.subarray(i, i + 4).toString('latin1');
    const length = icns.readUInt32BE(i + 4);
    if (length < 8) break;
    const data = icns.subarray(i + 8, i + length);
    if (data.subarray(0, 4).equals(PNG)) entries.set(type, data);
    i += length;
  }
  const type = PREFERRED.find((t) => entries.has(t));
  return type ? entries.get(type) : undefined;
}

// Electron's app.getFileIcon crashes on macOS app bundles (Electron 43), so the icon is read from the bundle itself.
export function macAppIcon(appPath: string): string | undefined {
  try {
    const resources = join(appPath, 'Contents', 'Resources');
    const plist = readFileSync(join(appPath, 'Contents', 'Info.plist'), 'utf8');
    const named = plist.match(/<key>CFBundleIconFile<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
    const file = named ? (named.endsWith('.icns') ? named : `${named}.icns`) : readdirSync(resources).find((f) => f.endsWith('.icns'));
    if (!file || !existsSync(join(resources, file))) return undefined;
    const png = pngFromIcns(readFileSync(join(resources, file)));
    return png && `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return undefined;
  }
}
