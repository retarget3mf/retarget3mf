import { modelName, useT } from '@retarget3mf/ui';
import type { PrinterDefinition } from '@retarget3mf/core';
import type { ConvertResult, InspectResult } from '../../../shared/api.ts';
import { DESKTOP_MESSAGES, platformKey } from '../messages.ts';
import styles from './Flow.module.css';

interface Props {
  project: InspectResult;
  result: ConvertResult;
  printer: PrinterDefinition;
  /** Seconds the conversion took. */
  elapsed?: number | undefined;
  launchError?: string | undefined;
  /** Shown when the file was not opened automatically. */
  openLabel?: string | undefined;
  onOpen: () => void;
  onShow: () => void;
  onReport: () => void;
  onNext: () => void;
}

export function DoneView({ project, result, printer, elapsed, launchError, openLabel, onOpen, onShow, onReport, onNext }: Props) {
  const t = useT(DESKTOP_MESSAGES);
  const used = project.filaments.filter((f) => f.used).length;
  const kept = result.report.filaments.length ? new Set(result.report.filaments.map((f) => f.to)).size : used;
  const colours = kept < used ? t.done.merged(used, t.slots(kept, printer.slots.kind === 'toolheads')) : `${t.done.colours(used)}, ${t.done.nothingToMerge}`;
  const thumbnail = result.thumbnail ?? project.plates.find((p) => p.thumbnail)?.thumbnail;
  return (
    <section className={styles.done} aria-labelledby="done-title">
      <div className={styles.doneHead}>
        {thumbnail ? <img className={styles.bigThumb} src={thumbnail} alt="" /> : <span className={styles.bigThumb} aria-hidden />}
        <div>
          <h2 id="done-title" className={styles.h2}>{t.done.title(modelName(printer))}</h2>
          <p className={styles.muted}>{[result.title || project.title || project.fileName, colours, elapsed !== undefined && t.done.seconds(Math.max(elapsed, 0.1).toFixed(1))].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <div className={styles.path} title={result.outputPath}>{result.outputPath}</div>
      {launchError && <p role="alert" className={styles.error}>{launchError}</p>}
      {result.report.warnings.length > 0 && <ul className={styles.warnings}>{result.report.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      {openLabel && <p className={styles.small}>{t.done.hint}</p>}
      <div className={styles.doneActions}>
        <button type="button" onClick={onShow}>{t.done.show[platformKey()]}</button>
        <button type="button" onClick={onReport}>{t.done.review}</button>
        <span className={styles.grow} />
        {openLabel && <button type="button" onClick={onOpen}>{openLabel}</button>}
        <button type="button" className="primary" onClick={onNext}>{t.done.another}</button>
      </div>
    </section>
  );
}
