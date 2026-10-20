import { useState } from 'react';
import type { ProjectFilament } from '@retarget3mf/core';
import { suggestFilamentMap } from '@retarget3mf/core/suggest';
import type { AppState, InspectResult } from '../../../shared/api.ts';
import styles from './ConversionView.module.css';

interface Props {
  project: InspectResult;
  state: AppState;
  onConvert: (filamentMap: Record<number, number>, openAfter: boolean) => void;
  onCancel: () => void;
}

/** Slots must be filled from 1 without gaps; renumber in first-use order after the user edits. */
export function compactMap(map: Record<number, number>, used: readonly ProjectFilament[]): Record<number, number> {
  const order = [...new Set(used.map((f) => map[f.index]!))].sort((a, b) => a - b);
  return Object.fromEntries(used.map((f) => [f.index, order.indexOf(map[f.index]!) + 1]));
}

export function ConversionView({ project, state, onConvert, onCancel }: Props) {
  const printer = state.printers.find((p) => p.id === state.settings.printer)!;
  const used = project.filaments.filter((f) => f.used);
  const unused = project.filaments.filter((f) => !f.used);
  const [map, setMap] = useState(() => suggestFilamentMap(used, printer.slots.count));
  const slots = Array.from({ length: printer.slots.count }, (_, i) => i + 1);
  const merged = new Set(Object.values(map)).size < used.length;
  const slicer = state.slicers.find((s) => s.kind === state.settings.slicer);

  return (
    <section className={styles.view} aria-labelledby="project-title">
      <div className={styles.head}>
        <div>
          <h2 id="project-title">{project.title || project.fileName}</h2>
          <p className={styles.muted}>Made for {project.sourcePrinter} · {project.plates.length} plate(s)</p>
        </div>
        <button onClick={onCancel}>Choose another file</button>
      </div>

      {project.plates.some((p) => p.thumbnail) && (
        <div className={styles.plates}>
          {project.plates.map((p) => p.thumbnail && <img key={p.id} src={p.thumbnail} alt={`Plate ${p.id}`} width={160} height={160} />)}
        </div>
      )}

      <h3>Filaments → {printer.displayName} {printer.slots.kind === 'semm' ? 'IFS slots' : 'extruder'}</h3>
      {used.length > printer.slots.count && (
        <p className={styles.warn}>This project uses {used.length} colours but the printer has {printer.slots.count} slot(s). Similar colours were combined; adjust below.</p>
      )}
      <ul className={styles.filaments}>
        {used.map((f) => (
          <li key={f.index}>
            <span className={styles.swatch} style={{ background: f.colour }} aria-hidden />
            <span>Filament {f.index} · {f.type} · {f.colour}</span>
            <label>
              <span className={styles.visuallyHidden}>Slot for filament {f.index}</span>
              <select value={map[f.index]} onChange={(e) => setMap(compactMap({ ...map, [f.index]: Number(e.target.value) }, used))} disabled={slots.length === 1}>
                {slots.map((s) => <option key={s} value={s}>Slot {s}</option>)}
              </select>
            </label>
          </li>
        ))}
        {unused.map((f) => (
          <li key={f.index} className={styles.unused}>
            <span className={styles.swatch} style={{ background: f.colour }} aria-hidden />
            <span>Filament {f.index} · {f.type} — not used by any object, will be removed</span>
          </li>
        ))}
      </ul>
      {merged && <p className={styles.muted}>Colours sharing a slot will print in the same filament.</p>}

      <div className={styles.actions}>
        <button className="primary" onClick={() => onConvert(map, true)} disabled={!slicer}>
          Convert &amp; open in {slicer?.name ?? 'slicer'}
        </button>
        <button onClick={() => onConvert(map, false)}>Convert only</button>
        {!slicer && <span className={styles.muted}>Slicer not found: use “Locate slicer…” above.</span>}
      </div>
    </section>
  );
}
