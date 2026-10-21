import { useEffect, useState } from 'react';
import type { PrinterDefinition } from '@retarget3mf/core';
import { UI_MESSAGES, useT } from '@retarget3mf/ui';
import type { InspectResult } from '../../../shared/api.ts';
import { DESKTOP_MESSAGES } from '../messages.ts';
import styles from './Flow.module.css';

interface Props {
  project: InspectResult;
  printer: PrinterDefinition;
  map: Record<number, number>;
  /** performance.now() marks: file dropped, project read, conversion started. */
  times: { dropped: number; read: number; started: number };
  folder: string;
  /** Set when the slicer opens afterwards. */
  slicer?: string | undefined;
  onCancel: () => void;
}

const TICK_MS = 100;

/** What the conversion is doing, as a log: done steps ✓, the running one ›, what comes next ·. */
export function ConvertingView({ project, printer, map, times, folder, slicer, onCancel }: Props) {
  const t = useT(DESKTOP_MESSAGES);
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  const at = (mark: number) => `${((mark - times.dropped) / 1000).toFixed(1)}s`;
  const bySlot = new Map<number, number[]>();
  for (const [filament, slot] of Object.entries(map)) bySlot.set(slot, [...(bySlot.get(slot) ?? []), Number(filament)]);
  const slotName = useT(UI_MESSAGES).conversion.slot;
  const merged = [...bySlot].map(([slot, list]) => t.log.slots(list, slotName(slot, printer.slots.kind).toLowerCase())).join(' · ');
  const unused = project.filaments.filter((f) => !f.used).map((f) => f.index);
  const lines = [
    { time: at(times.read), glyph: '✓', text: t.log.read(project.fileName, project.filaments.length, project.plates.length), done: true },
    { time: at(times.read), glyph: '✓', text: t.log.source(project.sourcePrinter, project.sourceSlicer), done: true },
    { time: at(times.started), glyph: '✓', text: t.log.mapping(merged, unused.length ? t.log.removed(unused) : ''), done: true },
    { time: at(times.started), glyph: '›', text: t.log.rewriting(printer.displayName), done: false },
    { time: '', glyph: '·', text: t.log.save(folder, slicer), done: true },
  ];
  return (
    <section className={styles.converting} aria-live="polite" aria-label={t.busy.converting}>
      <div className={styles.log}>
        {lines.map((l) => (
          <div key={l.text} className={l.done ? styles.logMuted : undefined}>
            <span className={styles.logTime}>{l.time}</span><span className={styles.logGlyph}>{l.glyph}</span><span>{l.text}</span>
          </div>
        ))}
      </div>
      <footer className={`${styles.footer} ${styles.footerEnd}`}>
        <button type="button" onClick={onCancel}>{t.actions.cancel}</button>
      </footer>
    </section>
  );
}
