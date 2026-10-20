export type SlicerId = 'orca' | 'flashstudio' | 'bambustudio';

export type PrinterId =
  | 'ad5x-0.4' | 'adventurer-5m-0.4' | 'adventurer-5m-pro-0.4' | 'creator-5-0.4' | 'creator-5-pro-0.4'
  | 'bambu-a1-mini-0.4' | 'bambu-a1-0.4' | 'bambu-p1p-0.4' | 'bambu-p1s-0.4' | 'bambu-p2s-0.4'
  | 'bambu-x1-0.4' | 'bambu-x1c-0.4' | 'bambu-x1e-0.4' | 'bambu-h2s-0.4';

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
}

const FLASHFORGE_SLICERS: readonly SlicerId[] = ['flashstudio', 'orca'];
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
];
