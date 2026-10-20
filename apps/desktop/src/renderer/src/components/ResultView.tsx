import type { AppState, ConvertResult } from '../../../shared/api.ts';
import styles from './ResultView.module.css';

interface Props {
  state: AppState;
  result: ConvertResult;
  launchError?: string;
  onOpen: () => void;
  onShow: () => void;
  onReport: () => void;
  onNext: () => void;
}

export function ResultView({ state, result, launchError, onOpen, onShow, onReport, onNext }: Props) {
  const slicer = state.slicers.find((s) => s.kind === state.settings.slicer);
  const fileName = result.outputPath.split(/[\\/]/).pop();
  return (
    <section className={styles.view} aria-labelledby="done-title">
      <h2 id="done-title">✓ Converted: {fileName}</h2>
      {launchError && <p role="alert" className={styles.error}>{launchError}</p>}
      {result.report.warnings.length > 0 && (
        <ul className={styles.warnings}>{result.report.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      )}
      <p className={styles.hint}>If you open it yourself, use <strong>File → Open Project</strong> in the slicer. Dragging it onto the plate imports only the geometry.</p>
      <div className={styles.actions}>
        {slicer && <button className="primary" onClick={onOpen}>Open in {slicer.name}</button>}
        <button onClick={onShow}>Show in folder</button>
        <button onClick={onReport}>View report</button>
        <button onClick={onNext}>Convert another</button>
      </div>
    </section>
  );
}
