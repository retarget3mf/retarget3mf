import { useState, type ReactNode } from 'react';
import type { PrinterDefinition } from '@retarget3mf/core';
import { suggestFilamentMap } from '@retarget3mf/core/suggest';
import { compactMap, UI_MESSAGES, useT } from '@retarget3mf/ui';
import type { InspectResult } from '../../../shared/api.ts';
import { DESKTOP_MESSAGES } from '../messages.ts';
import { Swatch } from './FilamentRows.tsx';
import styles from './Flow.module.css';

interface Props {
  project: InspectResult;
  printer: PrinterDefinition;
  /** Folder the converted file is written to. */
  outputFolder: string;
  actions: (map: Record<number, number>) => ReactNode;
}

/** Every filament with its slot, unused ones dimmed as "Removed"; plate thumbnails beside. */
export function ReviewView({ project, printer, outputFolder, actions }: Props) {
  const t = useT(DESKTOP_MESSAGES);
  const tc = useT(UI_MESSAGES).conversion;
  const used = project.filaments.filter((f) => f.used);
  const [map, setMap] = useState(() => suggestFilamentMap(used, printer.slots.count));
  const slots = Array.from({ length: printer.slots.count }, (_, i) => i + 1);
  const kind = printer.slots.kind;
  const thumbnails = project.plates.filter((p) => p.thumbnail);
  return (
    <section className={styles.review} aria-labelledby="review-title">
      <div className={styles.reviewBody}>
        <div className={styles.column}>
          <h2 id="review-title" className={styles.h3}>{tc.filamentsTo(printer.displayName, kind)}</h2>
          <div className={styles.table} role="table">
            <div role="row" className={styles.tableHead}>
              <span role="columnheader">{t.review.inProject}</span><span aria-hidden /><span role="columnheader">{t.review.onPrinter}</span>
            </div>
            {project.filaments.map((f) => (
              <div role="row" key={f.index} className={`${styles.tableRow} ${f.used ? '' : styles.unusedRow}`}>
                <span role="cell" className={styles.cellName}>
                  <Swatch colour={f.colour} />
                  <span>{tc.filamentLabel(f.index, f.type)} <span className={styles.hex}>{f.used ? f.colour : t.review.unused}</span></span>
                </span>
                <span className={styles.arrow} aria-hidden>→</span>
                <span role="cell">
                  {f.used ? (
                    <label>
                      <span className={styles.hidden}>{tc.slotFor(f.index)}</span>
                      <select className={styles.slotSelect} value={map[f.index]} disabled={slots.length === 1} onChange={(e) => setMap(compactMap({ ...map, [f.index]: Number(e.target.value) }, used))}>
                        {slots.map((s) => <option key={s} value={s}>{tc.slot(s, kind)}</option>)}
                      </select>
                    </label>
                  ) : <span className={styles.muted}>{t.review.removed}</span>}
                </span>
              </div>
            ))}
          </div>
          <p className={styles.small}>{tc.shared}</p>
        </div>
        <div className={styles.column}>
          {thumbnails.length
            ? thumbnails.map((p) => <img key={p.id} className={styles.plate} src={p.thumbnail} alt={tc.plate(p.id)} />)
            : <div className={styles.plate} aria-hidden />}
          {used.length > printer.slots.count && <p className={styles.warnBox}>{tc.tooMany(used.length, printer.slots.count, kind)}</p>}
        </div>
      </div>
      <footer className={styles.footer}>
        <span className={styles.footerPath} title={outputFolder}>{t.review.output(outputFolder)}</span>
        {actions(map)}
      </footer>
    </section>
  );
}
