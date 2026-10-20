import type { Theme } from '../../../shared/api.ts';
import styles from './ThemeSwitch.module.css';

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'system', label: 'System', icon: '◐' },
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '☾' },
];

export function ThemeSwitch({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
  return (
    <div className={styles.switch} role="radiogroup" aria-label="Colour mode">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.label}
          className={value === o.value ? styles.active : undefined}
          onClick={() => onChange(o.value)}
        >
          <span aria-hidden>{o.icon}</span>
          <span className={styles.label}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
