import { useT } from '@retarget3mf/ui';
import { DESKTOP_MESSAGES } from '../messages.ts';
import styles from './TitleBar.module.css';

export type Section = 'convert' | 'history' | 'settings';

interface Props { section: Section; onHistory: () => void; onSettings: () => void }

export function TitleBar({ section, onHistory, onSettings }: Props) {
  const t = useT(DESKTOP_MESSAGES);
  return (
    <header className={`${styles.bar} ${window.desktop.platform === 'darwin' ? styles.mac : ''}`}>
      <span />
      <span className={styles.title}>{t.appName}</span>
      <nav className={styles.nav}>
        <button type="button" aria-current={section === 'history' ? 'page' : undefined} onClick={onHistory}>{t.nav.history}</button>
        <button type="button" aria-current={section === 'settings' ? 'page' : undefined} onClick={onSettings}>{t.nav.settings}</button>
      </nav>
    </header>
  );
}
