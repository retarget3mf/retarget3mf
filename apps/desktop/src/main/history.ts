import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isSitePageUrl, SITE_INFO } from '@retarget3mf/bridge';
import type { ConversionReport } from '@retarget3mf/core';
import type { HistoryEntry, ProjectOrigin } from '../shared/api.ts';

const MAX_ENTRIES = 200;
type Stored = Omit<HistoryEntry, 'exists' | 'thumbnail'> & { hasThumbnail: boolean };

export interface NewEntry {
  title: string;
  inputPath: string;
  outputPath: string;
  printer: string;
  slicer: string;
  report: ConversionReport;
  thumbnail?: Uint8Array;
  origin?: ProjectOrigin;
}

/** Converted files, newest first, in <userData>/history: index.json plus one report and thumbnail per entry. */
export class History {
  private entries: Stored[];
  private readonly dir: string;

  constructor(userData: string) {
    this.dir = join(userData, 'history');
    this.entries = this.load();
  }

  private load(): Stored[] {
    try {
      const raw = JSON.parse(readFileSync(join(this.dir, 'index.json'), 'utf8')) as unknown;
      return Array.isArray(raw) ? (raw as Stored[]).filter((e) => typeof e?.id === 'string' && typeof e.outputPath === 'string') : [];
    } catch {
      return [];
    }
  }

  private async save(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, 'index.json'), JSON.stringify(this.entries, null, 1));
  }

  async add(entry: NewEntry): Promise<void> {
    const id = randomUUID();
    const origin = entry.origin && isSitePageUrl(entry.origin.pageUrl, entry.origin.site)
      ? { ...entry.origin, siteName: SITE_INFO[entry.origin.site].name }
      : undefined;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, `${id}.report.json`), JSON.stringify(entry.report));
    if (entry.thumbnail) await writeFile(join(this.dir, `${id}.png`), entry.thumbnail);
    const stored: Stored = {
      id,
      createdAt: new Date().toISOString(),
      title: entry.title,
      inputPath: entry.inputPath,
      outputPath: entry.outputPath,
      printer: entry.printer,
      slicer: entry.slicer,
      sourceSlicer: entry.report.source.slicer,
      warnings: entry.report.warnings.length,
      hasThumbnail: Boolean(entry.thumbnail),
      ...(origin && { origin }),
    };
    // Re-converting the same output replaces its old entry.
    const replaced = this.entries.filter((e) => e.outputPath === entry.outputPath);
    const dropped = [...replaced, ...this.entries.filter((e) => e.outputPath !== entry.outputPath).slice(MAX_ENTRIES - 1)];
    this.entries = [stored, ...this.entries.filter((e) => !dropped.includes(e))];
    await Promise.all(dropped.map((e) => this.removeFiles(e.id)));
    await this.save();
  }

  list(): HistoryEntry[] {
    return this.entries.map(({ hasThumbnail, ...e }) => {
      const png = join(this.dir, `${e.id}.png`);
      const thumbnail = hasThumbnail && existsSync(png) ? `data:image/png;base64,${readFileSync(png).toString('base64')}` : undefined;
      return { ...e, exists: existsSync(e.outputPath), ...(thumbnail && { thumbnail }) };
    });
  }

  get(id: string): HistoryEntry | undefined {
    return this.list().find((e) => e.id === id);
  }

  async report(id: string): Promise<ConversionReport | undefined> {
    if (!this.entries.some((e) => e.id === id)) return undefined;
    try {
      return JSON.parse(await readFile(join(this.dir, `${id}.report.json`), 'utf8')) as ConversionReport;
    } catch {
      return undefined;
    }
  }

  async remove(id: string): Promise<HistoryEntry | undefined> {
    const entry = this.get(id);
    if (!entry) return undefined;
    this.entries = this.entries.filter((e) => e.id !== id);
    await this.removeFiles(id);
    await this.save();
    return entry;
  }

  private async removeFiles(id: string): Promise<void> {
    await rm(join(this.dir, `${id}.report.json`), { force: true });
    await rm(join(this.dir, `${id}.png`), { force: true });
  }
}
