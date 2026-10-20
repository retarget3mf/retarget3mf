import flashforge from './generated/flashforge.json' with { type: 'json' };
import options from './generated/options.json' with { type: 'json' };
import { PRINTERS, type PrinterDefinition, type PrinterId } from './printers.ts';

export { PRINTERS, type PrinterDefinition, type PrinterId };

/** Flattened preset: every key a vendor JSON sets along the inherits chain. Values are strings or string arrays. */
export type Preset = Readonly<Record<string, string | readonly string[]>>;
export type SlicerId = 'orca' | 'flashstudio';
export interface OptionInfo { type: string; nullable: boolean; min?: number; max?: number }

export interface TargetProfiles {
  printer: PrinterDefinition;
  machine: Preset;
  processes: Readonly<Record<string, Preset>>;
  filaments: Readonly<Record<string, Preset>>;
  /** Filament preset names that exist (and fit this printer) in the given slicer. */
  filamentNames: Readonly<Record<SlicerId, readonly string[]>>;
}

type Bundle = typeof flashforge & {
  machines: Record<string, Preset>;
  processes: Record<string, Preset>;
  filaments: Record<string, Preset>;
};
const bundle = flashforge as Bundle;

export const PROFILE_SOURCE = bundle.source;

export function getPrinter(id: string): PrinterDefinition | undefined {
  return PRINTERS.find((p) => p.id === id);
}

export function getTargetProfiles(id: PrinterId): TargetProfiles {
  const printer = getPrinter(id);
  if (!printer) throw new Error(`Unknown printer "${id}"`);
  const compat = (bundle.compat as Record<string, { processes: string[]; filaments: string[]; flashStudioFilaments: string[] }>)[printer.machinePreset];
  const machine = bundle.machines[printer.machinePreset];
  if (!compat || !machine) throw new Error(`No generated profiles for "${printer.machinePreset}"; run sync-profiles`);
  const pick = (names: string[], from: Record<string, Preset>) =>
    Object.fromEntries(names.map((n) => [n, from[n]!]));
  return {
    printer,
    machine,
    processes: pick(compat.processes, bundle.processes),
    filaments: pick(compat.filaments, bundle.filaments),
    filamentNames: { orca: compat.filaments, flashstudio: compat.flashStudioFilaments },
  };
}

export function getOptions(slicer: SlicerId): Readonly<Record<string, OptionInfo>> {
  return (options as Record<SlicerId, Record<string, OptionInfo>>)[slicer];
}
