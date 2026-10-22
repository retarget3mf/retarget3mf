import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pngFromIcns } from '../src/main/appIcon.ts';
import { projectPathsFromArgv } from '../src/main/externalFiles.ts';
import { exeFromUninstallEntry, parseRegistry } from '../src/main/slicers.ts';
import { compactMap, groupByVendor } from '@retarget3mf/ui';
import { PRINTERS } from '@retarget3mf/core';
import { describe, expect, it } from 'vitest';
import { outputPathFor } from '../src/main/paths.ts';
import { DEFAULT_SETTINGS, dropPrinter, sanitizeSettings } from '../src/main/settings.ts';
import { launchCommand } from '../src/main/slicers.ts';
import { pickSlicer, slicersFor } from '../src/renderer/src/slicerKinds.ts';
import { browserRows } from '../src/renderer/src/settings/browsers.ts';

describe('dropPrinter', () => {
  const two = sanitizeSettings({ printer: 'qidi-q1-pro-0.4', slicer: 'orca', defaultPrinter: 'ad5x-0.4', printers: [{ model: 'ad5x-0.4', slicer: 'flashstudio' }] });
  it('converts for the last printer used, the default one, or asks', () => {
    expect(dropPrinter(two)).toEqual({ model: 'qidi-q1-pro-0.4', slicer: 'orca' });
    expect(dropPrinter({ ...two, dropTarget: 'default' })).toEqual({ model: 'ad5x-0.4', slicer: 'flashstudio' });
    expect(dropPrinter({ ...two, dropTarget: 'ask' })).toBeUndefined();
  });
  it('never asks with a single printer', () => {
    expect(dropPrinter(sanitizeSettings({ printer: 'ad5x-0.4', dropTarget: 'ask' }))).toEqual({ model: 'ad5x-0.4', slicer: 'flashstudio' });
  });
});

describe('sanitizeSettings', () => {
  it('keeps valid fields and drops unknown or malformed ones', () => {
    const s = sanitizeSettings({ printer: 'ad5x-0.4', slicer: 'orca', output: 'nope', slicerPaths: { orca: '/x', evil: '/y' }, extra: 1 });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, printer: 'ad5x-0.4', slicer: 'orca', slicerPaths: { orca: '/x' }, printers: [{ model: 'ad5x-0.4', slicer: 'orca' }], defaultPrinter: 'ad5x-0.4' });
  });

  it('saves the current printer with its slicer and keeps the others', () => {
    const s = sanitizeSettings({ printer: 'qidi-q1-pro-0.4', slicer: 'orca', printers: [{ model: 'ad5x-0.4', slicer: 'flashstudio' }, { model: 'bogus' }, { model: 'ad5x-0.4' }] });
    expect(s.printers).toEqual([{ model: 'ad5x-0.4', slicer: 'flashstudio' }, { model: 'qidi-q1-pro-0.4', slicer: 'orca' }]);
    expect(s.defaultPrinter).toBe('ad5x-0.4');
    expect(sanitizeSettings({ printer: 'ad5x-0.4', printers: [{ model: 'ad5x-0.4', slicer: 'bambustudio' }] }).printers[0]!.slicer).toBe('flashstudio');
  });

  it('upgrades a single-printer settings file to a one-printer list', () => {
    expect(sanitizeSettings({ printer: 'ad5x-0.4', slicer: 'orca' })).toMatchObject({ printers: [{ model: 'ad5x-0.4', slicer: 'orca' }], defaultPrinter: 'ad5x-0.4', dropTarget: 'last', autoCombine: false });
  });

  it('accepts a file name pattern only when it names the project and stays in its folder', () => {
    expect(sanitizeSettings({ fileNamePattern: '{name} — {printer}.3mf' }).fileNamePattern).toBe('{name} — {printer}');
    expect(sanitizeSettings({ fileNamePattern: '{printer}' }).fileNamePattern).toBe(DEFAULT_SETTINGS.fileNamePattern);
    expect(sanitizeSettings({ fileNamePattern: '../{name}' }).fileNamePattern).toBe(DEFAULT_SETTINGS.fileNamePattern);
    expect(sanitizeSettings({ outputDir: 'relative/dir' }).outputDir).toBeUndefined();
    expect(sanitizeSettings({ historyRetention: '90' }).historyRetention).toBe('90');
  });

  it('keeps a known accent and falls back to lime', () => {
    expect(sanitizeSettings({ accent: 'violet' }).accent).toBe('violet');
    expect(sanitizeSettings({ accent: 'teal' }).accent).toBe('lime');
  });

  it('ignores unknown printers', () => {
    expect(sanitizeSettings({ printer: 'bambu-x9' }).printer).toBeUndefined();
  });

  it('switches to a slicer that has the printer\'s profiles', () => {
    expect(sanitizeSettings({ printer: 'bambu-x1c-0.4', slicer: 'flashstudio' }).slicer).toBe('bambustudio');
    expect(sanitizeSettings({ printer: 'bambu-x1c-0.4', slicer: 'orca' }).slicer).toBe('orca');
    expect(sanitizeSettings({ printer: 'ad5x-0.4', slicer: 'bambustudio' }).slicer).toBe('flashstudio');
  });
});

describe('pickSlicer', () => {
  const installed = [{ kind: 'orca' as const, name: 'OrcaSlicer', path: '/o' }];
  it('keeps a supported slicer and otherwise prefers an installed one', () => {
    expect(pickSlicer(slicersFor(PRINTERS, 'ad5x-0.4'), 'orca', installed)).toBe('orca');
    expect(pickSlicer(slicersFor(PRINTERS, 'bambu-a1-0.4'), 'flashstudio', installed)).toBe('orca');
    expect(pickSlicer(slicersFor(PRINTERS, 'bambu-a1-0.4'), 'flashstudio', [])).toBe('bambustudio');
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
    const names = { printer: 'AD5X', slicer: 'Flash Studio' };
    expect(outputPathFor('/m/Benchy.3mf', names, undefined)).toBe('/m/Benchy - AD5X.3mf');
    expect(outputPathFor('/m/Benchy.3MF', names, '/out')).toBe('/out/Benchy - AD5X.3mf');
  });

  it('fills in the file name pattern and keeps separators out of it', () => {
    expect(outputPathFor('/m/Benchy.3mf', { printer: 'K2 Plus', slicer: 'Creality Print' }, undefined, '{name} — {printer} ({slicer})')).toBe('/m/Benchy — K2 Plus (Creality Print).3mf');
    expect(outputPathFor('/m/a.3mf', { printer: 'X/Y', slicer: 'S' }, undefined, '{printer}_{name}')).toBe('/m/X-Y_a.3mf');
  });
});

describe('compactMap', () => {
  const used = [1, 3, 5].map((index) => ({ index, colour: '#000', type: 'PLA', used: true }));
  it('closes gaps so slots start at 1', () => {
    expect(compactMap({ 1: 2, 3: 4, 5: 2 }, used)).toEqual({ 1: 1, 3: 2, 5: 1 });
  });
});


describe('Windows uninstall registry', () => {
  const output = [
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OrcaSlicer',
    '    DisplayName    REG_SZ    OrcaSlicer',
    '    DisplayIcon    REG_SZ    "C:\\Program Files\\OrcaSlicer\\orca-slicer.exe",0',
    '',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Flash Studio',
    '    DisplayName    REG_SZ    Flash Studio 1.7.9',
    '    InstallLocation    REG_SZ    C:\\Program Files\\Flash Studio',
  ].join('\r\n');

  it('parses one record per key', () => {
    expect(parseRegistry(output).map((e) => e.DisplayName)).toEqual(['OrcaSlicer', 'Flash Studio 1.7.9']);
  });

  it('finds the executable from DisplayIcon or InstallLocation', () => {
    const [orca, flash] = parseRegistry(output);
    expect(exeFromUninstallEntry(orca!, 'orca-slicer.exe')).toBe('C:\\Program Files\\OrcaSlicer\\orca-slicer.exe');
    expect(exeFromUninstallEntry(flash!, 'Flash Studio.exe')).toMatch(/Flash Studio[\\/]Flash Studio\.exe$/);
  });
});

describe('pngFromIcns', () => {
  const entry = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, 'latin1');
    head.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([head, data]);
  };
  const png = (tag: number) => Buffer.from([0x89, 0x50, 0x4e, 0x47, tag]);

  it('picks a mid-size embedded PNG', () => {
    const body = Buffer.concat([entry('ic10', png(10)), entry('ic07', png(7)), entry('is32', Buffer.from([1, 2, 3]))]);
    const head = Buffer.alloc(8);
    head.write('icns', 0, 'latin1');
    head.writeUInt32BE(body.length + 8, 4);
    expect(pngFromIcns(Buffer.concat([head, body]))?.at(-1)).toBe(7);
  });

  it('ignores non-icns data', () => {
    expect(pngFromIcns(Buffer.from('nope'))).toBeUndefined();
  });
});

describe('projectPathsFromArgv', () => {
  it('keeps existing .3mf files and ignores flags and the app path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'argv-'));
    writeFileSync(join(dir, 'a.3mf'), '');
    expect(projectPathsFromArgv(['/app/Retarget3MF', '--inspect', 'a.3mf', 'missing.3mf', 'notes.txt'], dir)).toEqual([join(dir, 'a.3mf')]);
  });
});

describe('groupByVendor', () => {
  it('groups printers by brand in data order', () => {
    expect(groupByVendor(PRINTERS).map(([vendor, list]) => [vendor, list.length])).toEqual([['Flashforge', 5], ['Bambu Lab', 9], ['Prusa', 5], ['Creality', 6], ['Elegoo', 4], ['Anycubic', 3], ['Qidi', 3], ['Sovol', 2]]);
  });
});

describe('browserRows', () => {
  it('merges Chromium browsers into one row and always lists Firefox and Safari', () => {
    expect(browserRows([{ browser: 'Chrome', registered: true }, { browser: 'Dia', registered: true }, { browser: 'Edge', registered: false }])).toEqual([
      { name: 'Chrome and Chromium browsers', state: 'ready', found: ['Chrome', 'Dia'] },
      { name: 'Firefox', state: 'missing' },
      { name: 'Safari', state: 'unsupported' },
    ]);
    expect(browserRows([{ browser: 'Firefox', registered: true }])[0]!.state).toBe('missing');
    expect(browserRows([{ browser: 'Firefox', registered: true }])[1]!.state).toBe('ready');
  });
});
