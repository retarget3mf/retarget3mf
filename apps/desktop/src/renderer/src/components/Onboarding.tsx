import { useState } from 'react';
import type { AppState, Settings, SlicerKind } from '../../../shared/api.ts';
import { PrinterPicker } from './PrinterPicker.tsx';
import { pickSlicer, slicersFor } from '../slicerKinds.ts';
import { SlicerCards } from './SlicerCards.tsx';
import { ThemeSwitch } from './ThemeSwitch.tsx';
import styles from './Onboarding.module.css';

interface Props { state: AppState; onDone: (patch: Partial<Settings>) => void; onPickSlicer: (kind: SlicerKind) => void }

export function Onboarding({ state, onDone, onPickSlicer }: Props) {
  const [printer, setPrinter] = useState(state.printers[0]!.id);
  const kinds = slicersFor(state.printers, printer);
  const [chosen, setSlicer] = useState<SlicerKind>(state.slicers[0]?.kind ?? kinds[0]!);
  const slicer = pickSlicer(kinds, chosen, state.slicers);
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="welcome">
        <div className={styles.top}>
          <h1 id="welcome">Welcome to Retarget3MF</h1>
          <ThemeSwitch value={state.settings.theme} onChange={(theme) => onDone({ theme })} />
        </div>
        <p className={styles.muted}>Converts 3D-printing projects from MakerWorld, Printables and other sites for your printer and opens them in your slicer. Everything stays on this computer.</p>
        <h2 className={styles.step}>1. Your printer</h2>
        <PrinterPicker printers={state.printers} value={printer} onChange={setPrinter} />
        <h2 className={styles.step}>2. Your slicer</h2>
        <SlicerCards kinds={kinds} slicers={state.slicers} value={slicer} onChange={setSlicer} onLocate={onPickSlicer} />
        <button className="primary" onClick={() => onDone({ printer, slicer })}>Start</button>
      </section>
    </main>
  );
}
