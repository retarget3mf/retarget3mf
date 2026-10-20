import type { SlicerInstall, SlicerKind } from '../../../shared/api.ts';
import styles from './SlicerCards.module.css';

const KINDS: { kind: SlicerKind; name: string; blurb: string }[] = [
  { kind: 'flashstudio', name: 'Flash Studio', blurb: "Flashforge's own slicer" },
  { kind: 'orca', name: 'OrcaSlicer', blurb: 'Open-source, all brands' },
];

interface Props {
  slicers: SlicerInstall[];
  value: SlicerKind;
  onChange: (kind: SlicerKind) => void;
  onLocate: (kind: SlicerKind) => void;
}

export function SlicerCards({ slicers, value, onChange, onLocate }: Props) {
  return (
    <div className={styles.grid} role="radiogroup" aria-label="Slicer">
      {KINDS.map(({ kind, name, blurb }) => {
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
