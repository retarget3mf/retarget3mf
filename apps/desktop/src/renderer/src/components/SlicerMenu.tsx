import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { SlicerInstall, SlicerKind } from '../../../shared/api.ts';
import styles from './SlicerMenu.module.css';

const KINDS: { kind: SlicerKind; name: string }[] = [
  { kind: 'flashstudio', name: 'Flash Studio' },
  { kind: 'orca', name: 'OrcaSlicer' },
];

interface Props {
  slicers: SlicerInstall[];
  value: SlicerKind;
  onChange: (kind: SlicerKind) => void;
  onManage: () => void;
}

function Icon({ install, name }: { install: SlicerInstall | undefined; name: string }) {
  return install?.icon
    ? <img src={install.icon} alt="" width={20} height={20} />
    : <span className={styles.placeholder} aria-hidden>{name[0]}</span>;
}

export function SlicerMenu({ slicers, value, onChange, onManage }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const current = KINDS.find((k) => k.kind === value)!;

  useEffect(() => {
    if (!open) return;
    items.current[Math.max(0, KINDS.findIndex((k) => k.kind === value))]?.focus();
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, value]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); root.current?.querySelector<HTMLButtonElement>('button')?.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = items.current.filter((b): b is HTMLButtonElement => b !== null);
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
  };

  const pick = (kind: SlicerKind) => { onChange(kind); setOpen(false); };

  return (
    <div className={styles.root} ref={root} onKeyDown={onKeyDown}>
      <button type="button" className={styles.trigger} aria-haspopup="menu" aria-expanded={open} aria-label={`Slicer: ${current.name}`} onClick={() => setOpen(!open)}>
        <Icon install={slicers.find((s) => s.kind === value)} name={current.name} />
        {current.name}
        <span className={styles.chevron} aria-hidden>▾</span>
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {KINDS.map(({ kind, name }, i) => {
            const install = slicers.find((s) => s.kind === kind);
            return (
              <button
                key={kind}
                ref={(el) => { items.current[i] = el; }}
                type="button"
                role="menuitemradio"
                aria-checked={kind === value}
                className={`${styles.item} ${install ? '' : styles.missing}`}
                onClick={() => (install ? pick(kind) : (setOpen(false), onManage()))}
              >
                <Icon install={install} name={name} />
                <span className={styles.name}>{name}</span>
                <span className={styles.status}>{kind === value ? '✓' : install ? '' : 'not installed'}</span>
              </button>
            );
          })}
          <div className={styles.separator} role="separator" />
          <button ref={(el) => { items.current[KINDS.length] = el; }} type="button" role="menuitem" className={styles.item} onClick={() => { setOpen(false); onManage(); }}>
            <span className={styles.placeholder} aria-hidden>⚙</span>
            <span className={styles.name}>Manage slicers…</span>
          </button>
        </div>
      )}
    </div>
  );
}
