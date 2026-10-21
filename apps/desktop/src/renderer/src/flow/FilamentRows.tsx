import type { PrinterDefinition, ProjectFilament } from '@retarget3mf/core';
import { compactMap, UI_MESSAGES, useT } from '@retarget3mf/ui';
import styles from './Flow.module.css';

interface Props {
  filaments: readonly ProjectFilament[];
  printer: PrinterDefinition;
  map: Record<number, number>;
  onChange: (map: Record<number, number>) => void;
}

/** Used filaments with their slot; one row each. */
export function FilamentRows({ filaments, printer, map, onChange }: Props) {
  const t = useT(UI_MESSAGES).conversion;
  const used = filaments.filter((f) => f.used);
  const slots = Array.from({ length: printer.slots.count }, (_, i) => i + 1);
  return (
    <ul className={styles.rows}>
      {used.map((f) => (
        <li key={f.index}>
          <Swatch colour={f.colour} />
          <span className={styles.grow}>{t.filamentLabel(f.index, f.type)} <span className={styles.hex}>{f.colour}</span></span>
          <label>
            <span className={styles.hidden}>{t.slotFor(f.index)}</span>
            <select value={map[f.index]} onChange={(e) => onChange(compactMap({ ...map, [f.index]: Number(e.target.value) }, used))} disabled={slots.length === 1}>
              {slots.map((s) => <option key={s} value={s}>{t.slot(s, printer.slots.kind)}</option>)}
            </select>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** Filament colour dot; the edge ring keeps near-black (dark theme) and white (light theme) visible. */
export function Swatch({ colour, size = 18 }: { colour: string; size?: number }) {
  return <span className={styles.swatch} style={{ background: colour, width: size, height: size }} aria-hidden />;
}
