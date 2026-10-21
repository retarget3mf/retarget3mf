import { useEffect, useRef, useState } from 'react';
import type { PrinterDefinition, PrinterId } from '@retarget3mf/core';
import { groupByVendor, modelName, useT } from '@retarget3mf/ui';
import { DESKTOP_MESSAGES } from '../messages.ts';
import styles from './Catalogue.module.css';

type Filter = 'all' | 'multi' | 'single';

interface Props {
  printers: readonly PrinterDefinition[];
  /** Highlighted as the current choice. */
  value?: PrinterId | undefined;
  /** Printers already saved; shown but not offered again when adding. */
  saved?: readonly PrinterId[];
  onChoose: (printer: PrinterId) => void;
  onClose: () => void;
}

export const isMulti = (p: PrinterDefinition) => p.slots.count > 1;

/** Every supported printer by brand, behind "Add printer…" and the printer stage. */
export function Catalogue({ printers, value, saved = [], onChoose, onClose }: Props) {
  const t = useT(DESKTOP_MESSAGES);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    search.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const capability = (p: PrinterDefinition) => (p.slots.kind === 'toolheads' ? t.catalogue.heads(p.slots.count) : t.catalogue.colours(p.slots.count));
  const brands = groupByVendor(printers.filter((p) => (filter === 'all' || (filter === 'multi') === isMulti(p)) && (!q || p.displayName.toLowerCase().includes(q))));

  return (
    <div className={styles.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={t.catalogue.title}>
        <div className={styles.bar}>
          <input ref={search} type="search" className={styles.search} placeholder={t.catalogue.search} aria-label={t.catalogue.search} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className={styles.chips} role="radiogroup" aria-label={t.catalogue.title}>
            {(['all', 'multi', 'single'] as const).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)}>{t.catalogue[f]}</button>
            ))}
          </div>
          <button type="button" className={styles.close} aria-label={t.catalogue.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.grid}>
          {brands.map(([vendor, list]) => (
            <div key={vendor} role="group" aria-label={vendor} className={styles.brand}>
              <div className={styles.vendor}>{vendor.toUpperCase()}</div>
              {list.map((p) => {
                const taken = saved.includes(p.id) && p.id !== value;
                return (
                  <button key={p.id} type="button" className={styles.item} aria-current={p.id === value || undefined} disabled={taken} onClick={() => onChoose(p.id)} aria-label={p.displayName}>
                    <span>{modelName(p)}</span><span className={styles.cap}>{capability(p)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
