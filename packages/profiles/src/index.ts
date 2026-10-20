import profiles from './generated/profiles.json' with { type: 'json' };
import options from './generated/options.json' with { type: 'json' };
import { PRINTERS, type PrinterDefinition, type PrinterId, type SlicerId } from './printers.ts';

export { PRINTERS, type PrinterDefinition, type PrinterId, type SlicerId };

/** Flattened preset: every key a vendor JSON sets along the inherits chain. Values are strings or string arrays. */
export type Preset = Readonly<Record<string, string | readonly string[]>>;
export interface OptionInfo { type: string; nullable: boolean; min?: number; max?: number; /** First element of the slicer's default value. */ default?: string; /** Accepted values of an enum option. */ values?: string[] }

export interface TargetProfiles {
  printer: PrinterDefinition;
  machine: Preset;
  processes: Readonly<Record<string, Preset>>;
  filaments: Readonly<Record<string, Preset>>;
  /** Filament preset names that exist (and fit this printer) in each slicer that supports it. */
  filamentNames: Readonly<Partial<Record<SlicerId, readonly string[]>>>;
  /** The vendor slicer's own presets (same names), where its options differ from OrcaSlicer's in name or shape. */
  native?: { machine: Preset; processes: Readonly<Record<string, Preset>>; filaments: Readonly<Record<string, Preset>> };
}

interface PresetSet { machines: Record<string, Preset>; processes: Record<string, Preset>; filaments: Record<string, Preset> }
type Bundle = typeof profiles & PresetSet & { native: PresetSet };
const bundle = profiles as Bundle;

export const PROFILE_SOURCE = bundle.source;

export function getPrinter(id: string): PrinterDefinition | undefined {
  return PRINTERS.find((p) => p.id === id);
}

export function getTargetProfiles(id: PrinterId): TargetProfiles {
  const printer = getPrinter(id);
  if (!printer) throw new Error(`Unknown printer "${id}"`);
  const compat = (bundle.compat as Record<string, { processes: string[]; filaments: Partial<Record<SlicerId, string[]>> }>)[printer.machinePreset];
  const machine = bundle.machines[printer.machinePreset];
  if (!compat || !machine) throw new Error(`No generated profiles for "${printer.machinePreset}"; run sync-profiles`);
  const pick = (names: string[], from: Record<string, Preset>) =>
    Object.fromEntries(names.map((n) => [n, from[n]!]));
  const presetNames = [...new Set(Object.values(compat.filaments).flat())];
  const nativeMachine = bundle.native.machines[printer.machinePreset];
  return {
    printer,
    machine,
    processes: pick(compat.processes, bundle.processes),
    filaments: pick(presetNames, bundle.filaments),
    filamentNames: compat.filaments,
    ...(nativeMachine && {
      native: {
        machine: nativeMachine,
        processes: pick(compat.processes.filter((n) => bundle.native.processes[n]), bundle.native.processes),
        filaments: pick(presetNames.filter((n) => bundle.native.filaments[n]), bundle.native.filaments),
      },
    }),
  };
}

export function getOptions(slicer: SlicerId): Readonly<Record<string, OptionInfo>> {
  return (options as Record<SlicerId, Record<string, OptionInfo>>)[slicer];
}
