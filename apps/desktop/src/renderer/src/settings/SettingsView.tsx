import { useState } from 'react';
import { useT } from '@retarget3mf/ui';
import type { AppState, Settings, SlicerKind, UpdateStatus } from '../../../shared/api.ts';
import { DESKTOP_MESSAGES } from '../messages.ts';
import { AboutPage, AppearancePage, BrowserPage, ConvertingPage, SlicersPage } from './Pages.tsx';
import { PrintersPage } from './PrintersPage.tsx';
import { SETTINGS_MESSAGES, type Page } from './messages.ts';
import styles from './Settings.module.css';

interface Props {
  state: AppState;
  historyCount: number;
  onChange: (patch: Partial<Settings>) => void;
  onLocate: (kind: SlicerKind) => void;
  onRescan: () => void;
  onAddPrinter: () => void;
  onPickFolder: () => void;
  onCheckUpdates: () => Promise<UpdateStatus>;
  onInstallUpdate: () => Promise<void>;
  onClearHistory: () => void;
  onBack: () => void;
  initialPage?: Page | undefined;
}

const PAGES: readonly Page[] = ['printers', 'slicers', 'converting', 'browser', 'appearance', 'about'];

export function SettingsView(props: Props) {
  const t = useT(SETTINGS_MESSAGES);
  const back = useT(DESKTOP_MESSAGES).nav.convert;
  const [page, setPage] = useState<Page>(props.initialPage ?? 'printers');
  const { state, onChange } = props;
  return (
    <div className={styles.layout}>
      <nav className={styles.nav} aria-label="Settings">
        <button type="button" className={styles.back} onClick={props.onBack}>{back}</button>
        {PAGES.map((p) => <button key={p} type="button" aria-current={page === p ? 'page' : undefined} onClick={() => setPage(p)}>{t.pages[p]}</button>)}
      </nav>
      <div className={styles.content}>
        <div className={styles.page}>
          <h2 className={styles.title}>{t.pages[page]}</h2>
          {page === 'printers' && <PrintersPage state={state} onChange={onChange} onAddPrinter={props.onAddPrinter} />}
          {page === 'slicers' && <SlicersPage state={state} onLocate={props.onLocate} onRescan={props.onRescan} />}
          {page === 'converting' && <ConvertingPage state={state} onChange={onChange} onPickFolder={props.onPickFolder} />}
          {page === 'browser' && <BrowserPage state={state} onChange={onChange} />}
          {page === 'appearance' && <AppearancePage state={state} onChange={onChange} />}
          {page === 'about' && <AboutPage state={state} historyCount={props.historyCount} onChange={onChange} onCheck={props.onCheckUpdates} onInstall={props.onInstallUpdate} onClearHistory={props.onClearHistory} />}
        </div>
      </div>
    </div>
  );
}
