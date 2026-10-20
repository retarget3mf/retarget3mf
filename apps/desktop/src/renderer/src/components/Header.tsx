import type { AppState, Settings } from '../../../shared/api.ts';
import { PrinterSelect } from './PrinterPicker.tsx';
import { ThemeSwitch } from './ThemeSwitch.tsx';
import styles from './Header.module.css';

interface Props {
  state: AppState;
  onChange: (patch: Partial<Settings>) => void;
  onSettings: () => void;
}

export function Header({ state, onChange, onSettings }: Props) {
  const { settings, printers, slicers } = state;
  const slicer = slicers.find((s) => s.kind === settings.slicer);
  return (
    <header className={styles.header}>
      <strong className={styles.brand}>Retarget3MF</strong>
      <PrinterSelect printers={printers} value={settings.printer} onChange={(printer) => onChange({ printer })} />
      <button type="button" className={styles.slicer} onClick={onSettings} title="Change slicer in Settings">
        {slicer?.icon && <img src={slicer.icon} alt="" width={20} height={20} />}
        {slicer?.name ?? 'No slicer found'}
      </button>
      <ThemeSwitch value={settings.theme} onChange={(theme) => onChange({ theme })} />
      <button type="button" onClick={onSettings} aria-label="Settings" title="Settings">⚙</button>
    </header>
  );
}
