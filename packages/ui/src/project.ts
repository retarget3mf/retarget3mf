import type { ProjectFilament } from '@retarget3mf/core';

/** What the review screen shows about a project; thumbnails are image URLs. */
export interface ProjectSummary {
  title: string;
  fileName: string;
  sourcePrinter: string;
  sourceSlicer: string;
  filaments: ProjectFilament[];
  plates: { id: number; thumbnail?: string }[];
}

/** Slots must be filled from 1 without gaps; renumber in first-use order after the user edits. */
export function compactMap(map: Record<number, number>, used: readonly ProjectFilament[]): Record<number, number> {
  const order = [...new Set(used.map((f) => map[f.index]!))].sort((a, b) => a - b);
  return Object.fromEntries(used.map((f) => [f.index, order.indexOf(map[f.index]!) + 1]));
}
