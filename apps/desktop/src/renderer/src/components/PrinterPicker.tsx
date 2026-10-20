import type { PrinterDefinition, PrinterId } from '@retarget3mf/core';
import { Dropdown } from './Dropdown.tsx';
import styles from './PrinterPicker.module.css';

/** Printers grouped by brand; the brand list comes from the printer data, so new vendors appear without UI changes. */
export function groupByVendor(printers: readonly PrinterDefinition[]): [string, PrinterDefinition[]][] {
  const groups = new Map<string, PrinterDefinition[]>();
  for (const p of printers) groups.set(p.vendor, [...(groups.get(p.vendor) ?? []), p]);
  return [...groups];
}

const modelName = (p: PrinterDefinition) => p.displayName.replace(new RegExp(`^${p.vendor} `), '');
const slotsLabel = (p: PrinterDefinition) => (p.slots.kind === 'semm' ? `${p.slots.count}-colour` : p.slots.kind === 'toolheads' ? `${p.slots.count} toolheads` : 'single colour');

interface Props { printers: readonly PrinterDefinition[]; value: PrinterId | undefined; onChange: (id: PrinterId) => void }

export function PrinterPicker({ printers, value, onChange }: Props) {
  return (
    <div className={styles.groups}>
      {groupByVendor(printers).map(([vendor, list]) => (
        <fieldset key={vendor} className={styles.group}>
          <legend>{vendor}</legend>
          <div className={styles.grid}>
            {list.map((p) => (
              <label key={p.id} className={`${styles.card} ${value === p.id ? styles.selected : ''}`}>
                <input type="radio" name="printer" value={p.id} checked={value === p.id} onChange={() => onChange(p.id)} aria-label={p.displayName} />
                <strong>{modelName(p)}</strong>
                <span>{slotsLabel(p)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/** Header variant: the shared dropdown with one group per brand. */
export function PrinterSelect({ printers, value, onChange }: Props) {
  const groups = groupByVendor(printers).map(([vendor, list]) => ({
    label: vendor,
    options: list.map((p) => ({ value: p.id, label: modelName(p), note: slotsLabel(p) })),
  }));
  return <Dropdown label="Printer" value={value} groups={groups} onChange={onChange} />;
}
