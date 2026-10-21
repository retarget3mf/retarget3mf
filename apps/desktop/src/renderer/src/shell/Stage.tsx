import type { ReactNode } from 'react';
import styles from './Stage.module.css';

/** idle: line border · active: accent + soft fill · done: accent border, ✓ · needs: warning border and fill. */
export type StageState = 'idle' | 'drop' | 'active' | 'done' | 'needs';

export const stageClass = (state: StageState, extra = '') => `${styles.card} ${styles[state]} ${extra}`;

interface BodyProps {
  label: string;
  /** Right side of the label row, e.g. "✓ SAVED". */
  note?: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  chevron?: boolean;
  large?: boolean;
  /** 0–1; a 3px bar on the card's bottom edge. `true` animates without a known amount. */
  progress?: number | true;
}

export function StageBody({ label, note, value, sub, icon, chevron, large, progress }: BodyProps) {
  return (
    <>
      {icon}
      <span className={styles.body}>
        <span className={styles.label}><span>{label}</span>{note && <span>{note}</span>}</span>
        <span className={`${styles.value} ${large ? styles.large : ''}`}><span className={styles.ellipsis}>{value}</span>{chevron && <span className={styles.chevron} aria-hidden>⌄</span>}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </span>
      {progress !== undefined && <span className={`${styles.progress} ${progress === true ? styles.indeterminate : ''}`} style={progress === true ? undefined : { width: `${Math.round(progress * 100)}%` }} />}
    </>
  );
}

export function Arrow({ done }: { done?: boolean }) {
  return <span className={`${styles.arrow} ${done ? styles.arrowDone : ''}`} aria-hidden>→</span>;
}

export function StageStrip({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={`${styles.strip} ${wide ? styles.wide : ''}`}>{children}</div>;
}
