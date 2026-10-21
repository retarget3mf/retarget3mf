import type { ReactNode } from 'react';
import styles from './Settings.module.css';

/** A titled, bordered group of rows. */
export function Group({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.group}>
      {(title || actions) && <div className={styles.groupHead}>{title && <h3>{title}</h3>}{actions && <div className={styles.groupActions}>{actions}</div>}</div>}
      <div className={styles.panel}>{children}</div>
    </section>
  );
}

export function Row({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return <div className={`${styles.row} ${dim ? styles.dim : ''}`}>{children}</div>;
}

interface RadioProps<T extends string> { name: string; value: T; current: T; onChange: (value: T) => void; children: ReactNode; sub?: ReactNode; extra?: ReactNode }

export function RadioRow<T extends string>({ name, value, current, onChange, children, sub, extra }: RadioProps<T>) {
  return (
    <label className={styles.row}>
      <input type="radio" className={styles.radio} name={name} checked={value === current} onChange={() => onChange(value)} />
      <span className={styles.grow}><span>{children}</span>{sub && <span className={styles.sub}>{sub}</span>}</span>
      {extra}
    </label>
  );
}

export function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={styles.row}>
      <span className={styles.grow}>{label}</span>
      <input type="checkbox" role="switch" className={styles.toggle} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
