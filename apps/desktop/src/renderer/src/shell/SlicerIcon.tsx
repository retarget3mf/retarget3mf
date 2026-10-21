import type { SlicerInstall, SlicerKind } from '../../../shared/api.ts';
import { SLICER_KINDS } from '../slicerKinds.ts';
import styles from './Stage.module.css';

/** The installed app's own icon; a letter tile when the slicer is not installed. */
export function SlicerIcon({ install, kind, size }: { install: SlicerInstall | undefined; kind: SlicerKind; size: number }) {
  if (install?.icon) return <img className={styles.slicerIcon} src={install.icon} alt="" width={size} height={size} />;
  return <span className={styles.letterTile} style={{ width: size, height: size, fontSize: size * 0.48 }} aria-hidden>{SLICER_KINDS[kind].name[0]}</span>;
}
