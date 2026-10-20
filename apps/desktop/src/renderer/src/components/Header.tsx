import type { AppState, Settings } from '../../../shared/api.ts';
import { PrinterSelect } from './PrinterPicker.tsx';
import { SlicerMenu } from './SlicerMenu.tsx';
import { ThemeSwitch } from './ThemeSwitch.tsx';
import styles from './Header.module.css';

interface Props {
  state: AppState;
  onChange: (patch: Partial<Settings>) => void;
  onSettings: () => void;
  onHistory: () => void;
}

export function Header({ state, onChange, onSettings, onHistory }: Props) {
  const { settings, printers, slicers } = state;
  return (
    <header className={styles.header}>
      <strong className={styles.brand}>Retarget3MF</strong>
      <PrinterSelect printers={printers} value={settings.printer} onChange={(printer) => onChange({ printer })} />
      <SlicerMenu slicers={slicers} value={settings.slicer} onChange={(kind) => onChange({ slicer: kind })} onManage={onSettings} />
      <ThemeSwitch value={settings.theme} onChange={(theme) => onChange({ theme })} />
      <button type="button" onClick={onHistory} title="Converted files">History</button>
      <button type="button" onClick={onSettings} aria-label="Settings" title="Settings">⚙</button>
    </header>
  );
}
