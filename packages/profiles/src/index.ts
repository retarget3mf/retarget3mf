import profiles from './generated/profiles.json' with { type: 'json' };
import options from './generated/options.json' with { type: 'json' };
import prusa from './generated/prusaslicer.json' with { type: 'json' };
import { PRINTERS, SLICER_NAMES, type PrinterDefinition, type PrinterId, type SlicerId } from './printers.ts';

export { PRINTERS, SLICER_NAMES, type PrinterDefinition, type PrinterId, type SlicerId };

/** Flattened preset: every key a vendor JSON sets along the inherits chain. Values are strings or string arrays. */
export type Preset = Readonly<Record<string, string | readonly string[]>>;
export interface OptionInfo { type: string; nullable: boolean; min?: number; max?: number; /** First element of the slicer's default value. */ default?: string; /** Accepted values of an enum option. */ values?: string[] }

export interface TargetProfiles {
  printer: PrinterDefinition;
  /** Machine preset name in the target slicer (an OrcaSlicer-based vendor slicer may name it differently). */
  machineName: string;
  machine: Preset;
  processes: Readonly<Record<string, Preset>>;
  filaments: Readonly<Record<string, Preset>>;
  /** Filament preset names that exist (and fit this printer) in each slicer that supports it. */
  filamentNames: Readonly<Partial<Record<SlicerId, readonly string[]>>>;
  /** The vendor slicer's own presets (same names), where its options differ from OrcaSlicer's in name or shape. */
  native?: { machine: Preset; processes: Readonly<Record<string, Preset>>; filaments: Readonly<Record<string, Preset>> };
}

interface PresetSet { machines: Record<string, Preset>; processes: Record<string, Preset>; filaments: Record<string, Preset> }
interface OwnSet extends PresetSet { compat: Record<string, { machine: string; process: string; filaments: string[] }> }
type Bundle = typeof profiles & PresetSet & { native: PresetSet; own: Partial<Record<SlicerId, OwnSet>> };
const bundle = profiles as Bundle;

export const PROFILE_SOURCE = bundle.source;

export function getPrinter(id: string): PrinterDefinition | undefined {
  return PRINTERS.find((p) => p.id === id);
}

/** For an OrcaSlicer-based vendor slicer with its own presets (Creality Print), those presets; else OrcaSlicer's. */
export function getTargetProfiles(id: PrinterId, slicer?: SlicerId): TargetProfiles {
  const printer = getPrinter(id);
  if (!printer) throw new Error(`Unknown printer "${id}"`);
  const set = slicer ? bundle.own[slicer] : undefined;
  const ownCompat = set?.compat[printer.machinePreset];
  if (set && ownCompat) {
    return {
      printer,
      machineName: ownCompat.machine,
      machine: set.machines[ownCompat.machine]!,
      processes: { [ownCompat.process]: set.processes[ownCompat.process]! },
      filaments: Object.fromEntries(ownCompat.filaments.map((n) => [n, set.filaments[n]!])),
      filamentNames: { [slicer!]: ownCompat.filaments },
    };
  }
  const compat = (bundle.compat as Record<string, { processes: string[]; filaments: Partial<Record<SlicerId, string[]>> }>)[printer.machinePreset];
  const machine = bundle.machines[printer.machinePreset];
  if (!compat || !machine) throw new Error(`No generated profiles for "${printer.machinePreset}"; run sync-profiles`);
  const pick = (names: string[], from: Record<string, Preset>) =>
    Object.fromEntries(names.map((n) => [n, from[n]!]));
  const presetNames = [...new Set(Object.values(compat.filaments).flat())];
  const nativeMachine = bundle.native.machines[printer.machinePreset];
  return {
    printer,
    machineName: printer.machinePreset,
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
  const table = (options as Partial<Record<SlicerId, Record<string, OptionInfo>>>)[slicer];
  if (!table) throw new Error(`No option table for ${slicer}`);
  return table;
}

/** A PrusaSlicer preset as its INI holds it: every value is the raw string after `key = `. */
export type IniPreset = Readonly<Record<string, string>>;
export interface PrusaProfiles {
  printerName: string;
  printName: string;
  printer: IniPreset;
  print: IniPreset;
  /** Filament preset per filament type (upper case); PLA is always present. */
  filaments: Readonly<Record<string, { name: string; preset: IniPreset }>>;
  /** Accepted values of PrusaSlicer's enum options. */
  enums: Readonly<Record<string, readonly string[]>>;
  version: string;
}

type PrusaBundle = { source: { tag: string }; printers: Record<string, { printer: string; print: string; filaments: Record<string, string> }>; presets: Record<'printer' | 'print' | 'filament', Record<string, Record<string, string>>>; enums: Record<string, string[]> };

export function getPrusaProfiles(id: PrinterId): PrusaProfiles {
  const name = getPrinter(id)?.ownSlicerPresets?.prusaslicer;
  const b = prusa as PrusaBundle;
  const entry = name ? b.printers[name] : undefined;
  if (!entry) throw new Error(`No PrusaSlicer profiles for "${id}"; run sync-profiles`);
  return {
    printerName: entry.printer,
    printName: entry.print,
    printer: b.presets.printer[entry.printer]!,
    print: b.presets.print[entry.print]!,
    filaments: Object.fromEntries(Object.entries(entry.filaments).map(([type, n]) => [type, { name: n, preset: b.presets.filament[n]! }])),
    enums: b.enums,
    version: b.source.tag.replace(/^version_/, ''),
  };
}
