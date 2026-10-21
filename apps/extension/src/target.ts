import { PRINTERS, SLICER_NAMES, type SlicerId } from '@retarget3mf/profiles/printers';

/** Printer and slicer for the extension's own use (in-browser conversion); mirrors the desktop app when connected. */
export interface Target { printer?: string; slicer?: string }

export const storedTarget = async (): Promise<Target> => (await browser.storage.local.get(['printer', 'slicer'])) as Target;
export const storeTarget = (target: Target) => browser.storage.local.set(target);

export function fillPrinters(select: HTMLSelectElement, selected: string | undefined, placeholder?: string): void {
  const groups = [...new Set(PRINTERS.map((p) => p.vendor))].map((vendor) => {
    const group = document.createElement('optgroup');
    group.label = vendor;
    group.append(...PRINTERS.filter((p) => p.vendor === vendor).map((p) => new Option(p.displayName, p.id, false, p.id === selected)));
    return group;
  });
  const none = placeholder && !PRINTERS.some((p) => p.id === selected) ? [new Option(placeholder, '', true, true)] : [];
  select.replaceChildren(...none, ...groups);
}

/** Only slicers that ship the printer's profiles; keeps `selected` when it is one of them. */
export function fillSlicers(select: HTMLSelectElement, printerId: string, selected: string | undefined): void {
  const printer = PRINTERS.find((p) => p.id === printerId);
  const slicers = printer?.slicers ?? [];
  const keep = slicers.includes(selected as SlicerId) ? selected : slicers[0];
  select.replaceChildren(...slicers.map((s) => new Option(SLICER_NAMES[s], s, false, s === keep)));
  select.disabled = slicers.length === 0;
}
