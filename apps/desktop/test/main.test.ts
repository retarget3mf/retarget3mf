import { describe, expect, it } from 'vitest';
import { compactMap } from '../src/renderer/src/components/ConversionView.tsx';
import { outputPathFor } from '../src/main/paths.ts';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/main/settings.ts';
import { launchCommand } from '../src/main/slicers.ts';

describe('sanitizeSettings', () => {
  it('keeps valid fields and drops unknown or malformed ones', () => {
    const s = sanitizeSettings({ printer: 'ad5x-0.4', slicer: 'orca', output: 'nope', slicerPaths: { orca: '/x', evil: '/y' }, extra: 1 });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, printer: 'ad5x-0.4', slicer: 'orca', slicerPaths: { orca: '/x' } });
  });

  it('ignores unknown printers', () => {
    expect(sanitizeSettings({ printer: 'bambu-x1' }).printer).toBeUndefined();
  });
});

describe('launchCommand', () => {
  it('uses open -a on macOS so a running slicer still gets a fresh project load', () => {
    expect(launchCommand('/Applications/Flash Studio.app', '/t/a.3mf', 'darwin')).toEqual({ command: 'open', args: ['-a', '/Applications/Flash Studio.app', '/t/a.3mf'] });
  });

  it('passes the file as the only argument elsewhere', () => {
    expect(launchCommand('C:/OrcaSlicer/orca-slicer.exe', 'C:/a b.3mf', 'win32')).toEqual({ command: 'C:/OrcaSlicer/orca-slicer.exe', args: ['C:/a b.3mf'] });
  });
});

describe('outputPathFor', () => {
  it('names the file after the printer, next to the original by default', () => {
    expect(outputPathFor('/m/Benchy.3mf', 'AD5X', undefined)).toBe('/m/Benchy - AD5X.3mf');
    expect(outputPathFor('/m/Benchy.3MF', 'AD5X', '/out')).toBe('/out/Benchy - AD5X.3mf');
  });
});

describe('compactMap', () => {
  const used = [1, 3, 5].map((index) => ({ index, colour: '#000', type: 'PLA', used: true }));
  it('closes gaps so slots start at 1', () => {
    expect(compactMap({ 1: 2, 3: 4, 5: 2 }, used)).toEqual({ 1: 1, 3: 2, 5: 1 });
  });
});
