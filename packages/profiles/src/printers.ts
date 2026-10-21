export type SlicerId = 'orca' | 'flashstudio' | 'bambustudio' | 'crealityprint';

export const SLICER_NAMES: Record<SlicerId, string> = { flashstudio: 'Flash Studio', orca: 'OrcaSlicer', bambustudio: 'Bambu Studio', crealityprint: 'Creality Print' };

export type PrinterId =
  | 'ad5x-0.4' | 'adventurer-5m-0.4' | 'adventurer-5m-pro-0.4' | 'creator-5-0.4' | 'creator-5-pro-0.4'
  | 'bambu-a1-mini-0.4' | 'bambu-a1-0.4' | 'bambu-p1p-0.4' | 'bambu-p1s-0.4' | 'bambu-p2s-0.4'
  | 'bambu-x1-0.4' | 'bambu-x1c-0.4' | 'bambu-x1e-0.4' | 'bambu-h2s-0.4'
  | 'prusa-mk4s-0.4' | 'prusa-mk3s-0.4' | 'prusa-mini-0.4' | 'prusa-core-one-0.4' | 'prusa-xl-0.4'
  | 'creality-k1c-0.4' | 'creality-k1-max-0.4' | 'creality-k2-plus-0.4' | 'creality-hi-0.4' | 'creality-ender-3-v3-ke-0.4' | 'creality-ender-3-v3-se-0.4'
  | 'elegoo-centauri-carbon-0.4' | 'elegoo-neptune-4-pro-0.4' | 'elegoo-neptune-4-max-0.4' | 'anycubic-kobra-s1-0.4' | 'anycubic-kobra-3-0.4' | 'anycubic-kobra-2-neo-0.4'
  | 'qidi-q1-pro-0.4' | 'qidi-plus4-0.4' | 'qidi-q2-0.4' | 'sovol-sv06-0.4' | 'sovol-sv08-0.4';

export interface PrinterDefinition {
  id: PrinterId;
  vendor: string;
  displayName: string;
  /** Exact OrcaSlicer machine preset name (identical in Flash Studio). */
  machinePreset: string;
  /** Filament slots that the slicer project may use; `semm` = one nozzle fed by a multi-material unit. */
  slots: { count: number; kind: 'single' | 'semm' | 'toolheads' };
  /** Hardware limits from vendor specs; profiles carry no machine-level maximum. */
  maxNozzleTemp: number;
  maxBedTemp: number;
  /** Slicers that ship this printer's profiles, preferred first. */
  slicers: readonly SlicerId[];
  /** Machine preset names in OrcaSlicer-based vendor slicers whose own presets are used for them (Creality Print). */
  ownSlicerPresets?: Partial<Record<SlicerId, string>>;
}

const FLASHFORGE_SLICERS: readonly SlicerId[] = ['flashstudio', 'orca'];
const ORCA_ONLY: readonly SlicerId[] = ['orca'];

/**
 * Printers with OrcaSlicer profiles; `own` adds the maker's OrcaSlicer-based slicer (preferred) with its preset name.
 * Makers whose slicer has no writer yet stay OrcaSlicer-only.
 */
function orca(
  id: PrinterId, vendor: string, model: string, machinePreset: string, slots: number, kind: 'single' | 'semm',
  maxNozzleTemp: number, maxBedTemp: number, own?: { slicer: SlicerId; machinePreset: string },
): PrinterDefinition {
  return {
    id, vendor, displayName: `${vendor} ${model}`, machinePreset, slots: { count: slots, kind }, maxNozzleTemp, maxBedTemp,
    slicers: own ? [own.slicer, ...ORCA_ONLY] : ORCA_ONLY,
    ...(own && { ownSlicerPresets: { [own.slicer]: own.machinePreset } }),
  };
}
const BAMBU_SLICERS: readonly SlicerId[] = ['bambustudio', 'orca'];

/** Bambu Lab single-nozzle printers: AMS units chain to 16 slots, AMS lite (A1 series) has 4. */
function bambu(id: PrinterId, model: string, slots: number, maxNozzleTemp: number, maxBedTemp: number): PrinterDefinition {
  return {
    id, vendor: 'Bambu Lab', displayName: `Bambu Lab ${model}`, machinePreset: `Bambu Lab ${model} 0.4 nozzle`,
    slots: { count: slots, kind: 'semm' }, maxNozzleTemp, maxBedTemp, slicers: BAMBU_SLICERS,
  };
}

export const PRINTERS: readonly PrinterDefinition[] = [
  {
    id: 'ad5x-0.4',
    vendor: 'Flashforge',
    displayName: 'Flashforge AD5X',
    machinePreset: 'Flashforge AD5X 0.4 nozzle',
    slots: { count: 4, kind: 'semm' },
    maxNozzleTemp: 300,
    maxBedTemp: 110,
    slicers: FLASHFORGE_SLICERS,
  },
  {
    id: 'adventurer-5m-0.4',
    vendor: 'Flashforge',
    displayName: 'Flashforge Adventurer 5M',
    machinePreset: 'Flashforge Adventurer 5M 0.4 Nozzle',
    slots: { count: 1, kind: 'single' },
    maxNozzleTemp: 280,
    maxBedTemp: 110,
    slicers: FLASHFORGE_SLICERS,
  },
  {
    id: 'adventurer-5m-pro-0.4',
    vendor: 'Flashforge',
    displayName: 'Flashforge Adventurer 5M Pro',
    machinePreset: 'Flashforge Adventurer 5M Pro 0.4 Nozzle',
    slots: { count: 1, kind: 'single' },
    maxNozzleTemp: 280,
    maxBedTemp: 110,
    slicers: FLASHFORGE_SLICERS,
  },
  // Four independent toolheads (toolchanger); every filament has its own nozzle.
  {
    id: 'creator-5-0.4',
    vendor: 'Flashforge',
    displayName: 'Flashforge Creator 5',
    machinePreset: 'Flashforge Creator 5 0.4 nozzle',
    slots: { count: 4, kind: 'toolheads' },
    maxNozzleTemp: 300,
    maxBedTemp: 110,
    slicers: FLASHFORGE_SLICERS,
  },
  {
    id: 'creator-5-pro-0.4',
    vendor: 'Flashforge',
    displayName: 'Flashforge Creator 5 Pro',
    machinePreset: 'Flashforge Creator 5 Pro 0.4 nozzle',
    slots: { count: 4, kind: 'toolheads' },
    maxNozzleTemp: 300,
    maxBedTemp: 110,
    slicers: FLASHFORGE_SLICERS,
  },
  // Hardware maxima from Bambu Lab's published specifications.
  bambu('bambu-a1-mini-0.4', 'A1 mini', 4, 300, 80),
  bambu('bambu-a1-0.4', 'A1', 4, 300, 100),
  bambu('bambu-p1p-0.4', 'P1P', 16, 300, 100),
  bambu('bambu-p1s-0.4', 'P1S', 16, 300, 100),
  bambu('bambu-p2s-0.4', 'P2S', 16, 300, 110),
  bambu('bambu-x1-0.4', 'X1', 16, 300, 110),
  bambu('bambu-x1c-0.4', 'X1 Carbon', 16, 300, 110),
  bambu('bambu-x1e-0.4', 'X1E', 16, 320, 120),
  bambu('bambu-h2s-0.4', 'H2S', 16, 350, 120),
  // Hardware maxima from the makers' spec pages; they only clamp, never raise. Multi-colour: Creality CFS (K2 Plus up
  // to four units, Hi one), Anycubic ACE Pro (up to two units).
  orca('prusa-mk4s-0.4', 'Prusa', 'MK4S', 'Prusa MK4S 0.4 nozzle', 1, 'single', 290, 120),
  orca('prusa-mk3s-0.4', 'Prusa', 'MK3S', 'Prusa MK3S 0.4 nozzle', 1, 'single', 300, 120),
  orca('prusa-mini-0.4', 'Prusa', 'MINI', 'Prusa MINI 0.4 nozzle', 1, 'single', 280, 100),
  orca('prusa-core-one-0.4', 'Prusa', 'CORE One', 'Prusa CORE One 0.4 nozzle', 1, 'single', 290, 120),
  orca('prusa-xl-0.4', 'Prusa', 'XL', 'Prusa XL 0.4 nozzle', 1, 'single', 290, 120),
  orca('creality-k1c-0.4', 'Creality', 'K1C', 'Creality K1C 0.4 nozzle', 1, 'single', 300, 100, { slicer: 'crealityprint', machinePreset: 'Creality K1C 0.4 nozzle' }),
  orca('creality-k1-max-0.4', 'Creality', 'K1 Max', 'Creality K1 Max (0.4 nozzle)', 1, 'single', 300, 100, { slicer: 'crealityprint', machinePreset: 'Creality K1 Max 0.4 nozzle' }),
  orca('creality-k2-plus-0.4', 'Creality', 'K2 Plus', 'Creality K2 Plus 0.4 nozzle', 16, 'semm', 350, 120, { slicer: 'crealityprint', machinePreset: 'Creality K2 Plus 0.4 nozzle' }),
  orca('creality-hi-0.4', 'Creality', 'Hi', 'Creality Hi 0.4 nozzle', 4, 'semm', 300, 100, { slicer: 'crealityprint', machinePreset: 'Creality Hi 0.4 nozzle' }),
  orca('creality-ender-3-v3-ke-0.4', 'Creality', 'Ender-3 V3 KE', 'Creality Ender-3 V3 KE 0.4 nozzle', 1, 'single', 300, 100, { slicer: 'crealityprint', machinePreset: 'Creality Ender-3 V3 KE 0.4 nozzle' }),
  orca('creality-ender-3-v3-se-0.4', 'Creality', 'Ender-3 V3 SE', 'Creality Ender-3 V3 SE 0.4 nozzle', 1, 'single', 260, 100, { slicer: 'crealityprint', machinePreset: 'Creality Ender-3 V3 SE 0.4 nozzle' }),
  orca('elegoo-centauri-carbon-0.4', 'Elegoo', 'Centauri Carbon', 'Elegoo Centauri Carbon 0.4 nozzle', 1, 'single', 320, 110),
  orca('elegoo-neptune-4-pro-0.4', 'Elegoo', 'Neptune 4 Pro', 'Elegoo Neptune 4 Pro 0.4 nozzle', 1, 'single', 300, 110),
  orca('elegoo-neptune-4-max-0.4', 'Elegoo', 'Neptune 4 Max', 'Elegoo Neptune 4 Max 0.4 nozzle', 1, 'single', 300, 95),
  orca('anycubic-kobra-s1-0.4', 'Anycubic', 'Kobra S1', 'Anycubic Kobra S1 0.4 nozzle', 8, 'semm', 320, 120),
  orca('anycubic-kobra-3-0.4', 'Anycubic', 'Kobra 3', 'Anycubic Kobra 3 0.4 nozzle', 8, 'semm', 300, 110),
  orca('anycubic-kobra-2-neo-0.4', 'Anycubic', 'Kobra 2 Neo', 'Anycubic Kobra 2 Neo 0.4 nozzle', 1, 'single', 260, 110),
  orca('qidi-q1-pro-0.4', 'Qidi', 'Q1 Pro', 'Qidi Q1 Pro 0.4 nozzle', 1, 'single', 350, 120),
  orca('qidi-plus4-0.4', 'Qidi', 'Plus4', 'Qidi X-Plus 4 0.4 nozzle', 1, 'single', 370, 120),
  orca('qidi-q2-0.4', 'Qidi', 'Q2', 'Qidi Q2 0.4 nozzle', 1, 'single', 370, 120),
  orca('sovol-sv06-0.4', 'Sovol', 'SV06', 'Sovol SV06 0.4 nozzle', 1, 'single', 300, 100),
  orca('sovol-sv08-0.4', 'Sovol', 'SV08', 'Sovol SV08 0.4 nozzle', 1, 'single', 300, 100),
];
