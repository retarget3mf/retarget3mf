import type { ConversionReport, PrinterId, ProjectFilament, SlicerId } from '@retarget3mf/core';

export type WorkerRequest =
  | { id: number; kind: 'inspect'; bytes: Uint8Array }
  | { id: number; kind: 'convert'; bytes: Uint8Array; printer: PrinterId; slicer: SlicerId; filamentMap: Record<number, number> };

export interface Inspected {
  title: string;
  sourcePrinter: string;
  sourceSlicer: string;
  filaments: ProjectFilament[];
  plates: { id: number; thumbnail?: Uint8Array }[];
}
export interface Converted { output: Uint8Array; report: ConversionReport; markdown: string; title: string }

/** `error` is shown as-is when `known` (a conversion error written for users); otherwise the page shows a generic message. */
export type WorkerResponse =
  | { id: number; ok: true; value: Inspected | Converted }
  | { id: number; ok: false; error: string; known: boolean };
