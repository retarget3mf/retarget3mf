import type { SlicerInstall, SlicerKind } from '../../../shared/api.ts';
import { Dropdown, IconPlaceholder } from '@retarget3mf/ui';
import { SLICER_KINDS } from '../slicerKinds.ts';

interface Props { kinds: readonly SlicerKind[]; slicers: SlicerInstall[]; value: SlicerKind; onChange: (kind: SlicerKind) => void; onManage: () => void }

const icon = (install: SlicerInstall | undefined, name: string) =>
  install?.icon ? <img src={install.icon} alt="" width={20} height={20} /> : <IconPlaceholder>{name[0]}</IconPlaceholder>;

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
      action={{ label: 'Manage slicers…', icon: <IconPlaceholder>⚙</IconPlaceholder>, onSelect: onManage }}
    />
  );
}
