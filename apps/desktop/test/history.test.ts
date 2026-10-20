import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConversionReport } from '@retarget3mf/core';
import { History, type NewEntry } from '../src/main/history.ts';

const report = { source: { kind: 'bambu', slicer: 'Bambu Studio', application: 'x', printer: 'X1C' }, target: { printer: 'AD5X', slicer: 'Flash Studio', profiles: 'v' }, warnings: ['w'], filaments: [], plates: [], settings: [] } as ConversionReport;
const entry = (dir: string, name: string, extra: Partial<NewEntry> = {}): NewEntry => {
  const outputPath = join(dir, `${name} - AD5X.3mf`);
  writeFileSync(outputPath, 'x');
  return { title: name, inputPath: join(dir, `${name}.3mf`), outputPath, printer: 'Flashforge AD5X', slicer: 'Flash Studio', report, thumbnail: new Uint8Array([137, 80, 78, 71]), ...extra };
};

describe('History', () => {
  it('lists newest first with thumbnails, survives a restart and keeps reports', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hist-'));
    const h = new History(dir);
    await h.add(entry(dir, 'a'));
    await h.add(entry(dir, 'b'));
    const again = new History(dir).list();
    expect(again.map((e) => e.title)).toEqual(['b', 'a']);
    expect(again[0]).toMatchObject({ exists: true, warnings: 1, sourceSlicer: 'Bambu Studio', thumbnail: 'data:image/png;base64,iVBORw==' });
    expect((await h.report(again[0]!.id))?.target.printer).toBe('AD5X');
  });

  it('keeps only valid model-site pages as source links', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hist-'));
    const h = new History(dir);
    await h.add(entry(dir, 'ok', { origin: { site: 'makerworld', pageUrl: 'https://makerworld.com/en/models/1-x#profileId-2' } }));
    await h.add(entry(dir, 'bad', { origin: { site: 'makerworld', pageUrl: 'javascript:alert(1)' } }));
    const [bad, ok] = h.list();
    expect(ok!.origin).toEqual({ site: 'makerworld', pageUrl: 'https://makerworld.com/en/models/1-x#profileId-2', siteName: 'MakerWorld' });
    expect(bad!.origin).toBeUndefined();
  });

  it('replaces the entry when the same output is converted again, and removes entries', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hist-'));
    const h = new History(dir);
    await h.add(entry(dir, 'a'));
    await h.add(entry(dir, 'a'));
    expect(h.list()).toHaveLength(1);
    await h.remove(h.list()[0]!.id);
    expect(new History(dir).list()).toEqual([]);
  });
});
