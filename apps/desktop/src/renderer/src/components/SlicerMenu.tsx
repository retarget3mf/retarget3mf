import type { SlicerInstall, SlicerKind } from '../../../shared/api.ts';
import { Dropdown } from './Dropdown.tsx';
import { SLICER_KINDS } from '../slicerKinds.ts';
import styles from './Dropdown.module.css';

interface Props { kinds: readonly SlicerKind[]; slicers: SlicerInstall[]; value: SlicerKind; onChange: (kind: SlicerKind) => void; onManage: () => void }

const icon = (install: SlicerInstall | undefined, name: string) =>
  install?.icon ? <img src={install.icon} alt="" width={20} height={20} /> : <span className={styles.placeholder} aria-hidden>{name[0]}</span>;

export function SlicerMenu({ kinds, slicers, value, onChange, onManage }: Props) {
  const options = kinds.map((kind) => {
    const { name } = SLICER_KINDS[kind];
    const install = slicers.find((s) => s.kind === kind);
    return { value: kind, label: name, icon: icon(install, name), ...(!install && { note: 'not installed', muted: true }) };
  });
  return (
    <Dropdown
      label="Slicer"
      value={value}
      groups={[{ options }]}
      onChange={(kind) => (slicers.some((s) => s.kind === kind) ? onChange(kind) : onManage())}
      action={{ label: 'Manage slicers…', icon: <span className={styles.placeholder} aria-hidden>⚙</span>, onSelect: onManage }}
    />
  );
}
