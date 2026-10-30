import { useState } from 'react';
import type { PrinterDefinition, PrinterId } from '@retarget3mf/core';
import { Dropdown } from './Dropdown.tsx';
import { useT } from './i18n.tsx';
import { UI_MESSAGES, type UiMessages } from './messages.ts';
import styles from './PrinterPicker.module.css';

/** Printers grouped by brand; the brand list comes from the printer data, so new vendors appear without UI changes. */
export function groupByVendor(printers: readonly PrinterDefinition[]): [string, PrinterDefinition[]][] {
  const groups = new Map<string, PrinterDefinition[]>();
  for (const p of printers) groups.set(p.vendor, [...(groups.get(p.vendor) ?? []), p]);
  return [...groups];
}

export const modelName = (p: PrinterDefinition) => p.displayName.replace(new RegExp(`^${p.vendor} `), '');
export const slotsLabel = (t: UiMessages['printer'], p: PrinterDefinition) =>
  (p.slots.kind === 'semm' ? t.colours(p.slots.count) : p.slots.kind === 'toolheads' ? t.toolheads(p.slots.count) : t.single);

interface Props { printers: readonly PrinterDefinition[]; value: PrinterId | undefined; onChange: (id: PrinterId) => void }
type SelectProps = Props & Pick<Parameters<typeof Dropdown<PrinterId>>[0], 'triggerClassName' | 'renderTrigger'>;

/** Brand chips, then that brand's models: the full catalogue would fill the screen. */
export function PrinterPicker({ printers, value, onChange }: Props) {
  const t = useT(UI_MESSAGES).printer;
  const groups = groupByVendor(printers);
  const [vendor, setVendor] = useState(() => printers.find((p) => p.id === value)?.vendor ?? groups[0]?.[0]);
  const list = groups.find(([v]) => v === vendor)?.[1] ?? [];
  return (
    <div className={styles.groups}>
      <div className={styles.brands} role="group" aria-label={t.label}>
        {groups.map(([v]) => (
          <button key={v} type="button" className={styles.brand} aria-pressed={v === vendor} onClick={() => setVendor(v)}>{v}</button>
        ))}
      </div>
      <fieldset className={styles.group}>
        <legend className={styles.visuallyHidden}>{vendor}</legend>
        <div className={styles.grid}>
          {list.map((p) => (
            <label key={p.id} className={`${styles.card} ${value === p.id ? styles.selected : ''}`}>
              {/* A checked radio fires no change event, so re-choosing the current printer goes through click. */}
              <input type="radio" name="printer" value={p.id} checked={value === p.id} onChange={() => onChange(p.id)} onClick={() => value === p.id && onChange(p.id)} aria-label={p.displayName} />
              <strong>{modelName(p)}</strong>
              <span>{slotsLabel(t, p)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** Header variant: the shared dropdown with one group per brand. */
export function PrinterSelect({ printers, value, onChange, ...trigger }: SelectProps) {
  const t = useT(UI_MESSAGES).printer;
  const groups = groupByVendor(printers).map(([vendor, list]) => ({
    label: vendor,
    options: list.map((p) => ({ value: p.id, label: modelName(p), note: slotsLabel(t, p) })),
  }));
  return <Dropdown label={t.label} value={value} groups={groups} onChange={onChange} {...trigger} />;
}
