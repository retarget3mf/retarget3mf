import { useState, type ReactNode } from 'react';
import type { PrinterDefinition, ProjectFilament } from '@retarget3mf/core';
import { suggestFilamentMap } from '@retarget3mf/core/suggest';
import { useT } from './i18n.tsx';
import { UI_MESSAGES } from './messages.ts';
import styles from './ConversionView.module.css';

/** What the review screen shows about a project; thumbnails are image URLs. */
export interface ProjectSummary {
  title: string;
  fileName: string;
  sourcePrinter: string;
  sourceSlicer: string;
  filaments: ProjectFilament[];
  plates: { id: number; thumbnail?: string }[];
}

interface Props {
  project: ProjectSummary;
  printer: PrinterDefinition;
  onCancel: () => void;
  /** The app's convert buttons, given the current filament → slot map. */
  renderActions: (filamentMap: Record<number, number>) => ReactNode;
}

/** Slots must be filled from 1 without gaps; renumber in first-use order after the user edits. */
export function compactMap(map: Record<number, number>, used: readonly ProjectFilament[]): Record<number, number> {
  const order = [...new Set(used.map((f) => map[f.index]!))].sort((a, b) => a - b);
  return Object.fromEntries(used.map((f) => [f.index, order.indexOf(map[f.index]!) + 1]));
}

export function ConversionView({ project, printer, onCancel, renderActions }: Props) {
  const t = useT(UI_MESSAGES).conversion;
  const used = project.filaments.filter((f) => f.used);
  const unused = project.filaments.filter((f) => !f.used);
  const [map, setMap] = useState(() => suggestFilamentMap(used, printer.slots.count));
  const slots = Array.from({ length: printer.slots.count }, (_, i) => i + 1);
  const merged = new Set(Object.values(map)).size < used.length;
  const kind = printer.slots.kind;

  return (
    <section className={styles.view} aria-labelledby="project-title">
      <div className={styles.head}>
        <div>
          <h2 id="project-title">{project.title || project.fileName}</h2>
          <p className={styles.muted}>{t.madeFor(project.sourcePrinter, project.sourceSlicer, project.plates.length)}</p>
        </div>
        <button onClick={onCancel}>{t.chooseAnother}</button>
      </div>

      {project.plates.some((p) => p.thumbnail) && (
        <div className={styles.plates}>
          {project.plates.map((p) => p.thumbnail && <img key={p.id} src={p.thumbnail} alt={t.plate(p.id)} width={160} height={160} />)}
        </div>
      )}

      <h3>{t.filamentsTo(printer.displayName, kind)}</h3>
      {used.length > printer.slots.count && <p className={styles.warn}>{t.tooMany(used.length, printer.slots.count, kind)}</p>}
      <ul className={styles.filaments}>
        {used.map((f) => (
          <li key={f.index}>
            <span className={styles.swatch} style={{ background: f.colour }} aria-hidden />
            <span>{t.filament(f.index, f.type, f.colour)}</span>
            <label>
              <span className={styles.visuallyHidden}>{t.slotFor(f.index)}</span>
              <select value={map[f.index]} onChange={(e) => setMap(compactMap({ ...map, [f.index]: Number(e.target.value) }, used))} disabled={slots.length === 1}>
                {slots.map((s) => <option key={s} value={s}>{t.slot(s, kind)}</option>)}
              </select>
            </label>
          </li>
        ))}
        {unused.map((f) => (
          <li key={f.index} className={styles.unused}>
            <span className={styles.swatch} style={{ background: f.colour }} aria-hidden />
            <span>{t.unused(f.index, f.type)}</span>
          </li>
        ))}
      </ul>
      {merged && <p className={styles.muted}>{t.shared}</p>}
      <div className={styles.actions}>{renderActions(map)}</div>
    </section>
  );
}
