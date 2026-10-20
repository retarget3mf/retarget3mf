import { useState } from 'react';
import type { AppState, Settings, SlicerKind } from '../../../shared/api.ts';
import styles from './Onboarding.module.css';

interface Props { state: AppState; onDone: (patch: Partial<Settings>) => void; onPickSlicer: (kind: SlicerKind) => void }

export function Onboarding({ state, onDone, onPickSlicer }: Props) {
  const [printer, setPrinter] = useState(state.printers[0]!.id);
  const found = state.slicers.map((s) => s.kind);
  const [slicer, setSlicer] = useState<SlicerKind>(found[0] ?? 'flashstudio');
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="welcome">
        <h1 id="welcome">Welcome to Retarget3MF</h1>
        <p className={styles.muted}>Converts MakerWorld projects for your printer and opens them in your slicer. Everything stays on this computer.</p>

        <fieldset className={styles.group}>
          <legend>1. Your printer</legend>
          {state.printers.map((p) => (
            <label key={p.id} className={styles.option}>
              <input type="radio" name="printer" checked={printer === p.id} onChange={() => setPrinter(p.id)} />
              {p.displayName}
            </label>
          ))}
        </fieldset>

        <fieldset className={styles.group}>
          <legend>2. Your slicer</legend>
          {(['flashstudio', 'orca'] as const).map((k) => {
            const install = state.slicers.find((s) => s.kind === k);
            return (
              <label key={k} className={styles.option}>
                <input type="radio" name="slicer" checked={slicer === k} onChange={() => setSlicer(k)} />
                {k === 'flashstudio' ? 'Flash Studio' : 'OrcaSlicer'}
                <span className={styles.muted}>{install ? `found` : 'not found'}</span>
                {!install && <button type="button" onClick={() => onPickSlicer(k)}>Locate…</button>}
              </label>
            );
          })}
        </fieldset>

        <button className="primary" onClick={() => onDone({ printer, slicer })}>Start</button>
      </section>
    </main>
  );
}
