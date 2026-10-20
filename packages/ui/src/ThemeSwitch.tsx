import { useT } from './i18n.tsx';
import { UI_MESSAGES } from './messages.ts';
import styles from './ThemeSwitch.module.css';

export type Theme = 'system' | 'light' | 'dark';
const ICONS: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' };

export function ThemeSwitch({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
  const t = useT(UI_MESSAGES).theme;
  return (
    <div className={styles.switch} role="radiogroup" aria-label={t.label}>
      {(Object.keys(ICONS) as Theme[]).map((theme) => (
        <button
          key={theme}
          type="button"
          role="radio"
          aria-checked={value === theme}
          title={t[theme]}
          className={value === theme ? styles.active : undefined}
          onClick={() => onChange(theme)}
        >
          <span aria-hidden>{ICONS[theme]}</span>
          <span className={styles.label}>{t[theme]}</span>
        </button>
      ))}
    </div>
  );
}
