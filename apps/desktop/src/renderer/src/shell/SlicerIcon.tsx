import type { SlicerKind } from '../../../shared/api.ts';
import styles from './Stage.module.css';

const ICONS = import.meta.glob<string>('../assets/slicers/*.png', { eager: true, import: 'default' });

/** The slicer's own logo, bundled so it looks the same on every OS whether or not the slicer is installed. */
export function SlicerIcon({ kind, size }: { kind: SlicerKind; size: number }) {
  return <img className={styles.slicerIcon} src={ICONS[`../assets/slicers/${kind}.png`]} alt="" width={size} height={size} />;
}
