import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Dropdown.module.css';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Shown on the right, e.g. "not installed". */
  note?: string;
  muted?: boolean;
}

export interface DropdownGroup<T extends string> { label?: string; options: DropdownOption<T>[] }

interface Props<T extends string> {
  label: string;
  value: T | undefined;
  groups: DropdownGroup<T>[];
  onChange: (value: T) => void;
  /** Optional last item under a separator, e.g. "Manage slicers…". */
  action?: { label: string; icon?: ReactNode; onSelect: () => void };
}

/** Header dropdown: grouped options with icons, keyboard navigation, closes on outside click or Escape. */
export function Dropdown<T extends string>({ label, value, groups, onChange, action }: Props<T>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = groups.flatMap((g) => g.options);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"], [role^="menuitem"]')?.focus();
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  const choose = (fn: () => void) => { setOpen(false); fn(); };

  return (
    <div className={styles.root} ref={root} onKeyDown={onKeyDown}>
      <button ref={trigger} type="button" className={styles.trigger} aria-haspopup="menu" aria-expanded={open} aria-label={`${label}: ${current?.label ?? 'none'}`} onClick={() => setOpen(!open)}>
        {current?.icon}
        {current?.label ?? `Choose ${label.toLowerCase()}`}
        <span className={styles.chevron} aria-hidden>▾</span>
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label={label}>
          {groups.map((group, gi) => (
            <div key={group.label ?? gi} role="group" aria-label={group.label}>
              {group.label && <div className={styles.heading}>{group.label}</div>}
              {group.options.map((o) => (
                <button key={o.value} type="button" role="menuitemradio" aria-checked={o.value === value} className={`${styles.item} ${o.muted ? styles.muted : ''}`} onClick={() => choose(() => onChange(o.value))}>
                  <span className={styles.check} aria-hidden>{o.value === value ? '✓' : ''}</span>
                  {o.icon}
                  <span className={styles.name}>{o.label}</span>
                  {o.note && <span className={styles.note}>{o.note}</span>}
                </button>
              ))}
            </div>
          ))}
          {action && (
            <>
              <div className={styles.separator} role="separator" />
              <button type="button" role="menuitem" className={styles.item} onClick={() => choose(action.onSelect)}>
                <span className={styles.check} aria-hidden />
                {action.icon}
                <span className={styles.name}>{action.label}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
