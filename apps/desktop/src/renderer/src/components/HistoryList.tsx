import { useState } from 'react';
import type { HistoryEntry } from '../../../shared/api.ts';
import styles from './HistoryList.module.css';

interface Props {
  entries: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onShow: (entry: HistoryEntry) => void;
  onReport: (entry: HistoryEntry) => void;
  onSource: (entry: HistoryEntry) => void;
  onRemove: (entry: HistoryEntry, moveFileToTrash: boolean) => void;
}

const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function HistoryList({ entries, onOpen, onShow, onReport, onSource, onRemove }: Props) {
  const [confirming, setConfirming] = useState<string>();
  if (entries.length === 0) return null;
  return (
    <section className={styles.history} aria-labelledby="history-title">
      <h2 id="history-title">Recent conversions</h2>
      <ul>
        {entries.map((e) => (
          <li key={e.id} className={e.exists ? undefined : styles.missing}>
            {e.thumbnail ? <img src={e.thumbnail} alt="" width={56} height={56} /> : <span className={styles.noThumb} aria-hidden>3MF</span>}
            <div className={styles.info}>
              <strong title={e.outputPath}>{e.title}</strong>
              <span className={styles.meta}>
                {e.printer.replace(/^Flashforge /, '')} · {e.slicer} · {when.format(new Date(e.createdAt))}
                {e.warnings > 0 && <> · {e.warnings} warning{e.warnings > 1 ? 's' : ''}</>}
                {!e.exists && <> · file moved or deleted</>}
              </span>
              <span className={styles.meta}>
                {e.origin
                  ? <button type="button" className={styles.link} onClick={() => onSource(e)} title={e.origin.pageUrl}>{e.origin.siteName} ↗</button>
                  : <>From {e.sourceSlicer}</>}
              </span>
            </div>
            {confirming === e.id ? (
              <div className={styles.actions} role="group" aria-label={`Remove ${e.title}`}>
                <button type="button" onClick={() => { setConfirming(undefined); onRemove(e, false); }}>Remove from list</button>
                {e.exists && <button type="button" className={styles.danger} onClick={() => { setConfirming(undefined); onRemove(e, true); }}>Also move file to Trash</button>}
                <button type="button" onClick={() => setConfirming(undefined)}>Cancel</button>
              </div>
            ) : (
              <div className={styles.actions}>
                <button type="button" onClick={() => onOpen(e)} disabled={!e.exists}>Open</button>
                <button type="button" onClick={() => onShow(e)} disabled={!e.exists}>Show</button>
                <button type="button" onClick={() => onReport(e)}>Report</button>
                <button type="button" aria-label={`Remove ${e.title}`} title="Remove" onClick={() => setConfirming(e.id)}>✕</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
