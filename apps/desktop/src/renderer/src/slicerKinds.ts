import type { PrinterDefinition } from '@retarget3mf/core';
import type { SlicerInstall, SlicerKind } from '../../shared/api.ts';

export const SLICER_KINDS: Record<SlicerKind, { name: string; blurb: string }> = {
  flashstudio: { name: 'Flash Studio', blurb: "Flashforge's own slicer" },
  bambustudio: { name: 'Bambu Studio', blurb: "Bambu Lab's own slicer" },
  orca: { name: 'OrcaSlicer', blurb: 'Open-source, all brands' },
};

const FALLBACK: readonly SlicerKind[] = ['flashstudio', 'orca'];

/** Slicers that ship profiles for the printer, in its preferred order. */
export function slicersFor(printers: readonly PrinterDefinition[], printer: string | undefined): readonly SlicerKind[] {
  return printers.find((p) => p.id === printer)?.slicers ?? FALLBACK;
}

/** Keeps the current slicer when the printer supports it, else the first supported one that is installed. */
export function pickSlicer(allowed: readonly SlicerKind[], current: SlicerKind, installed: readonly SlicerInstall[]): SlicerKind {
  if (allowed.includes(current)) return current;
  return allowed.find((k) => installed.some((s) => s.kind === k)) ?? allowed[0]!;
}
