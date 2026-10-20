import type { SlicerInstall, SlicerKind } from '../../../shared/api.ts';
import { SLICER_KINDS } from '../slicerKinds.ts';
import styles from './SlicerCards.module.css';

interface Props {
  /** Slicers that support the chosen printer. */
  kinds: readonly SlicerKind[];
  slicers: SlicerInstall[];
  value: SlicerKind;
  onChange: (kind: SlicerKind) => void;
  onLocate: (kind: SlicerKind) => void;
}

export function SlicerCards({ kinds, slicers, value, onChange, onLocate }: Props) {
  return (
    <div className={styles.grid} role="radiogroup" aria-label="Slicer">
      {kinds.map((kind) => {
        const { name, blurb } = SLICER_KINDS[kind];
        const install = slicers.find((s) => s.kind === kind);
        const selected = value === kind;
        return (
          <div key={kind} className={`${styles.card} ${selected ? styles.selected : ''} ${install ? '' : styles.missing}`}>
            <button type="button" role="radio" aria-checked={selected} className={styles.pick} onClick={() => onChange(kind)} aria-label={name}>
              {install?.icon ? <img src={install.icon} alt="" width={48} height={48} /> : <span className={styles.placeholder} aria-hidden>{name[0]}</span>}
              <strong>{name}</strong>
              <span className={styles.blurb}>{blurb}</span>
            </button>
            <div className={styles.status}>
              {install ? <span className={styles.found} title={install.path}>● Installed</span> : <span>Not found</span>}
              <button type="button" className={styles.link} onClick={() => onLocate(kind)}>{install ? 'Change…' : 'Locate…'}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
