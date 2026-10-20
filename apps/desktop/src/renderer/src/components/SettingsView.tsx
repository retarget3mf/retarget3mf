import type { AppState, Settings, SlicerKind } from '../../../shared/api.ts';
import { PrinterPicker } from './PrinterPicker.tsx';
import { SlicerCards } from './SlicerCards.tsx';
import { ThemeSwitch } from './ThemeSwitch.tsx';
import styles from './SettingsView.module.css';

interface Props {
  state: AppState;
  onChange: (patch: Partial<Settings>) => void;
  onLocate: (kind: SlicerKind) => void;
  onRescan: () => void;
  onBack: () => void;
}

export function SettingsView({ state, onChange, onLocate, onRescan, onBack }: Props) {
  const { settings } = state;
  return (
    <section className={styles.view} aria-labelledby="settings-title">
      <div className={styles.head}>
        <h2 id="settings-title">Settings</h2>
        <button onClick={onBack}>Done</button>
      </div>

      <h3>Printer</h3>
      <PrinterPicker printers={state.printers} value={settings.printer} onChange={(printer) => onChange({ printer })} />

      <div className={styles.row}>
        <h3>Slicer</h3>
        <button type="button" onClick={onRescan}>Search again</button>
      </div>
      <SlicerCards slicers={state.slicers} value={settings.slicer} onChange={(slicer) => onChange({ slicer })} onLocate={onLocate} />

      <h3>Converted files</h3>
      <label className={styles.option}>
        <input type="radio" name="output" checked={settings.output === 'next-to-original'} onChange={() => onChange({ output: 'next-to-original' })} />
        Next to the original file
      </label>
      <label className={styles.option}>
        <input type="radio" name="output" checked={settings.output === 'app-folder'} onChange={() => onChange({ output: 'app-folder' })} />
        In <code>{state.outputFolder}</code>
      </label>
      <label className={styles.option}>
        <input type="checkbox" checked={settings.openAfterConvert} onChange={(e) => onChange({ openAfterConvert: e.target.checked })} />
        Open in the slicer after converting
      </label>

      <h3>When a .3mf is opened from Finder / Explorer</h3>
      <label className={styles.option}>
        <input type="radio" name="openMode" checked={settings.openMode === 'auto'} onChange={() => onChange({ openMode: 'auto' })} />
        Convert right away (ask only when colours need merging)
      </label>
      <label className={styles.option}>
        <input type="radio" name="openMode" checked={settings.openMode === 'review'} onChange={() => onChange({ openMode: 'review' })} />
        Show the review screen first
      </label>

      <h3>Browser extension</h3>
      <p className={styles.muted}>The extension adds an “Open for your printer” button on MakerWorld and hands the project to this app.</p>
      {state.browsers.length === 0 && <p className={styles.muted}>No supported browser found (Chrome, Edge, Brave, Chromium).</p>}
      <ul className={styles.browsers}>
        {state.browsers.map((b) => (
          <li key={b.browser}>
            <span>{b.browser}</span>
            <span className={b.registered ? styles.ok : styles.muted}>{b.registered ? '● Ready for the extension' : 'Not installed'}</span>
          </li>
        ))}
      </ul>

      <h3>Appearance</h3>
      <ThemeSwitch value={settings.theme} onChange={(theme) => onChange({ theme })} />
    </section>
  );
}
