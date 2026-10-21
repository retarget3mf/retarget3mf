import { useState } from 'react';
import { useT } from '@retarget3mf/ui';
import type { HistoryEntry } from '../../../shared/api.ts';
import { DESKTOP_MESSAGES } from '../messages.ts';
import styles from './HistoryView.module.css';

interface Props {
  entries: HistoryEntry[];
  onBack: () => void;
  onOpen: (entry: HistoryEntry) => void;
  onShow: (entry: HistoryEntry) => void;
  onReport: (entry: HistoryEntry) => void;
  onSource: (entry: HistoryEntry) => void;
  onRemove: (entry: HistoryEntry, moveFileToTrash: boolean) => void;
}

export const stamp = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** "Flashforge AD5X" → "AD5X": the vendor is implied by the model in a dense table. */
const shortPrinter = (name: string) => name.replace(/^\S+ (Lab )?/, '');

/** Dense table, filterable by printer and searchable; actions appear on the selected row. */
export function HistoryView({ entries, onBack, onOpen, onShow, onReport, onSource, onRemove }: Props) {
  const t = useT(DESKTOP_MESSAGES);
  const [printer, setPrinter] = useState<string>();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string>();
  const [confirming, setConfirming] = useState<string>();
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.printer, (counts.get(e.printer) ?? 0) + 1);
  const q = query.trim().toLowerCase();
  const shown = entries.filter((e) => (!printer || e.printer === printer)
    && (!q || [e.title, e.printer, e.slicer, e.origin?.siteName ?? e.sourceSlicer].some((v) => v.toLowerCase().includes(q))));
  const current = shown.find((e) => e.id === selected) ?? shown[0];

  return (
    <section className={styles.view} aria-labelledby="history-title">
      <h2 id="history-title" className={styles.hidden}>{t.history.title}</h2>
      <div className={styles.bar}>
        <button type="button" className={styles.back} onClick={onBack}>{t.nav.convert}</button>
        <div className={styles.chips} role="radiogroup" aria-label={t.history.cols.printer}>
          <button type="button" role="radio" aria-checked={!printer} onClick={() => setPrinter(undefined)}>{t.history.all(entries.length)}</button>
          {[...counts].map(([name, n]) => (
            <button key={name} type="button" role="radio" aria-checked={printer === name} onClick={() => setPrinter(name)}>{shortPrinter(name)} · {n}</button>
          ))}
        </div>
        <span className={styles.grow} />
        <input className={styles.search} type="search" placeholder={t.history.search} aria-label={t.history.search} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {entries.length === 0 ? <p className={styles.empty}>{t.history.empty}</p> : (
        <div className={styles.table} role="table">
          <div role="row" className={styles.head}>
            {Object.values(t.history.cols).map((c) => <span key={c} role="columnheader">{c}</span>)}
            <span role="columnheader" />
          </div>
          {shown.length === 0 && <p className={styles.empty}>{t.history.noMatch}</p>}
          {shown.map((e) => {
            const active = e.id === current?.id;
            return (
              <div
                key={e.id}
                role="row"
                aria-selected={active}
                className={`${styles.row} ${active ? styles.selected : ''} ${e.exists ? '' : styles.missing}`}
                tabIndex={0}
                onClick={() => setSelected(e.id)}
                onFocus={() => setSelected(e.id)}
              >
                <span role="cell" className={styles.name} title={e.exists ? e.outputPath : t.history.missing}>{e.title}</span>
                <span role="cell" className={styles.muted}>
                  {e.origin
                    ? <button type="button" className={styles.link} onClick={() => onSource(e)} title={e.origin.pageUrl}>{e.origin.siteName} ↗</button>
                    : e.sourceSlicer}
                </span>
                <span role="cell">{shortPrinter(e.printer)}</span>
                <span role="cell">{e.slicer}</span>
                <span role="cell" className={styles.date}>{stamp(e.createdAt)}</span>
                <span role="cell" className={styles.warn}>{e.warnings ? `⚠ ${e.warnings}` : '—'}</span>
                <span role="cell" className={styles.actions}>
                  {active && confirming === e.id && (
                    <span role="group" aria-label={t.history.remove(e.title)} className={styles.confirm}>
                      <button type="button" onClick={() => { setConfirming(undefined); onRemove(e, false); }}>{t.history.removeFromList}</button>
                      {e.exists && <button type="button" className={styles.danger} onClick={() => { setConfirming(undefined); onRemove(e, true); }}>{t.history.trash}</button>}
                      <button type="button" onClick={() => setConfirming(undefined)}>{t.actions.cancel}</button>
                    </span>
                  )}
                  {active && confirming !== e.id && (
                    <>
                      <button type="button" className={styles.link} onClick={() => onOpen(e)} disabled={!e.exists}>{t.history.open}</button>
                      <button type="button" className={styles.link} onClick={() => onShow(e)} disabled={!e.exists}>{t.history.show}</button>
                      <button type="button" className={styles.link} onClick={() => onReport(e)}>{t.history.report}</button>
                      <button type="button" className={styles.icon} aria-label={t.history.remove(e.title)} title={t.history.remove(e.title)} onClick={() => setConfirming(e.id)}>✕</button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
