import { useState } from 'react';
import type { ConversionReport, SettingChange, SettingOutcome } from '@retarget3mf/core';
import { useT } from './i18n.tsx';
import { UI_MESSAGES } from './messages.ts';
import styles from './ReportView.module.css';

const OUTCOMES: SettingOutcome[] = ['clamped', 'translated', 'kept', 'replaced', 'dropped'];
const show = (v: SettingChange['from']) => (v === undefined ? '' : typeof v === 'string' ? v : v.join('; '));

interface Props { report: ConversionReport; onBack: () => void; onExport: (format: 'md' | 'json') => void }

export function ReportView({ report, onBack, onExport }: Props) {
  const t = useT(UI_MESSAGES).report;
  const [outcome, setOutcome] = useState<SettingOutcome | 'all'>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = report.settings.filter((s) => (outcome === 'all' || s.outcome === outcome) && (!q || s.key.toLowerCase().includes(q)));
  const count = (o: SettingOutcome) => report.settings.filter((s) => s.outcome === o).length;

  return (
    <section className={styles.view} aria-labelledby="report-title">
      <div className={styles.head}>
        <h2 id="report-title">{t.title}</h2>
        <div className={styles.actions}>
          <button onClick={() => onExport('md')}>{t.exportMd}</button>
          <button onClick={() => onExport('json')}>{t.exportJson}</button>
          <button onClick={onBack}>{t.back}</button>
        </div>
      </div>
      {report.warnings.length > 0 && <ul className={styles.warnings}>{report.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      <p className={styles.muted}>{t.target(report.source.printer, report.target.printer, report.target.slicer, report.target.profiles)}</p>
      <div className={styles.filters} role="group" aria-label={t.filter}>
        <button aria-pressed={outcome === 'all'} onClick={() => setOutcome('all')}>{t.all(report.settings.length)}</button>
        {OUTCOMES.map((o) => <button key={o} aria-pressed={outcome === o} onClick={() => setOutcome(o)}>{t.outcomes[o]} ({count(o)})</button>)}
        <input type="search" placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t.search} />
      </div>
      <table className={styles.table}>
        <thead><tr><th>{t.setting}</th><th>{t.outcome}</th><th>{t.from}</th><th>{t.to}</th><th>{t.why}</th></tr></thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={`${s.key}-${s.outcome}-${i}`}>
              <td><code>{s.key}</code></td>
              <td><span className={styles[s.outcome]}>{t.outcomes[s.outcome]}</span></td>
              <td title={show(s.from)}><span className={styles.value}>{show(s.from)}</span></td>
              <td title={show(s.to)}><span className={styles.value}>{show(s.to)}</span></td>
              <td>{s.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
