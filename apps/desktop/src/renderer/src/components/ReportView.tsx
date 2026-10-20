import { useState } from 'react';
import type { SettingChange, SettingOutcome } from '@retarget3mf/core';
import type { ConvertResult } from '../../../shared/api.ts';
import styles from './ReportView.module.css';

const OUTCOMES: SettingOutcome[] = ['clamped', 'translated', 'kept', 'replaced', 'dropped'];
const show = (v: SettingChange['from']) => (v === undefined ? '' : typeof v === 'string' ? v : v.join('; '));

interface Props { result: ConvertResult; onBack: () => void; onExport: (format: 'md' | 'json') => void }

export function ReportView({ result, onBack, onExport }: Props) {
  const [outcome, setOutcome] = useState<SettingOutcome | 'all'>('all');
  const [query, setQuery] = useState('');
  const { report } = result;
  const q = query.trim().toLowerCase();
  const rows = report.settings.filter((s) => (outcome === 'all' || s.outcome === outcome) && (!q || s.key.toLowerCase().includes(q)));
  const count = (o: SettingOutcome) => report.settings.filter((s) => s.outcome === o).length;

  return (
    <section className={styles.view} aria-labelledby="report-title">
      <div className={styles.head}>
        <h2 id="report-title">Conversion report</h2>
        <div className={styles.actions}>
          <button onClick={() => onExport('md')}>Export Markdown</button>
          <button onClick={() => onExport('json')}>Export JSON</button>
          <button onClick={onBack}>Back</button>
        </div>
      </div>
      {report.warnings.length > 0 && <ul className={styles.warnings}>{report.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      <p className={styles.muted}>{report.source.printer} → {report.target.printer} ({report.target.slicer}, profiles {report.target.profiles})</p>
      <div className={styles.filters} role="group" aria-label="Filter settings">
        <button aria-pressed={outcome === 'all'} onClick={() => setOutcome('all')}>All ({report.settings.length})</button>
        {OUTCOMES.map((o) => <button key={o} aria-pressed={outcome === o} onClick={() => setOutcome(o)}>{o} ({count(o)})</button>)}
        <input type="search" placeholder="Search setting…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search setting" />
      </div>
      <table className={styles.table}>
        <thead><tr><th>Setting</th><th>Outcome</th><th>From</th><th>To</th><th>Why</th></tr></thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={`${s.key}-${s.outcome}-${i}`}>
              <td><code>{s.key}</code></td>
              <td><span className={styles[s.outcome]}>{s.outcome}</span></td>
              <td className={styles.value}>{show(s.from)}</td>
              <td className={styles.value}>{show(s.to)}</td>
              <td>{s.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
