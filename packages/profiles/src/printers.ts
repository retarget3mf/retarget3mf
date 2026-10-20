export type PrinterId = 'ad5x-0.4' | 'adventurer-5m-0.4' | 'adventurer-5m-pro-0.4' | 'creator-5-0.4' | 'creator-5-pro-0.4';

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
  },
  {
    id: 'adventurer-5m-0.4',
    vendor: 'Flashforge',
    displayName: 'Flashforge Adventurer 5M',
    machinePreset: 'Flashforge Adventurer 5M 0.4 Nozzle',
    slots: { count: 1, kind: 'single' },
    maxNozzleTemp: 280,
    maxBedTemp: 110,
  },
  {
    id: 'adventurer-5m-pro-0.4',
    vendor: 'Flashforge',
    displayName: 'Flashforge Adventurer 5M Pro',
    machinePreset: 'Flashforge Adventurer 5M Pro 0.4 Nozzle',
    slots: { count: 1, kind: 'single' },
    maxNozzleTemp: 280,
    maxBedTemp: 110,
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
  },
  {
    id: 'creator-5-pro-0.4',
    vendor: 'Flashforge',
    displayName: 'Flashforge Creator 5 Pro',
    machinePreset: 'Flashforge Creator 5 Pro 0.4 nozzle',
    slots: { count: 4, kind: 'toolheads' },
    maxNozzleTemp: 300,
    maxBedTemp: 110,
  },
];
