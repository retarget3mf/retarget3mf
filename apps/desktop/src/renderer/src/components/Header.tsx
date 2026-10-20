import type { AppState, Settings, SlicerKind } from '../../../shared/api.ts';
import styles from './Header.module.css';

interface Props {
  state: AppState;
  onChange: (patch: Partial<Settings>) => void;
  onPickSlicer: (kind: SlicerKind) => void;
}

export function Header({ state, onChange, onPickSlicer }: Props) {
  const { settings, printers, slicers } = state;
  const slicerFound = slicers.some((s) => s.kind === settings.slicer);
  return (
    <header className={styles.header}>
      <strong className={styles.brand}>Retarget3MF</strong>
      <label>
        Printer{' '}
        <select value={settings.printer} onChange={(e) => onChange({ printer: e.target.value as NonNullable<Settings['printer']> })}>
          {printers.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
        </select>
      </label>
      <label>
        Slicer{' '}
        <select value={settings.slicer} onChange={(e) => onChange({ slicer: e.target.value as SlicerKind })}>
          <option value="flashstudio">Flash Studio</option>
          <option value="orca">OrcaSlicer</option>
        </select>
      </label>
      {!slicerFound && <button onClick={() => onPickSlicer(settings.slicer)}>Locate slicer…</button>}
      <label className={styles.toggle}>
        <input type="checkbox" checked={settings.output === 'app-folder'} onChange={(e) => onChange({ output: e.target.checked ? 'app-folder' : 'next-to-original' })} />
        Save to {state.outputFolder.split(/[\\/]/).pop()} folder
      </label>
    </header>
  );
}
