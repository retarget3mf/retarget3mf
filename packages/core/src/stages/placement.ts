import { asList, type ConfigValue } from '../config.ts';
import { itemBounds, type ModelGeometry } from '../model.ts';
import type { ModelSettings } from '../modelSettings.ts';
import type { PlateSummary } from '../report.ts';

export interface Bed { min: [number, number]; max: [number, number] }

export interface PlacementPlan {
  /** Per build item (document order): XY shift in mm. */
  shifts: [number, number][];
  plates: PlateSummary[];
  /** Wipe tower position per plate in the target plate's coordinates, or undefined if the source has none. */
  wipeTower?: { x: string[]; y: string[] };
}

// Plate grid of the slicer GUI (OrcaSlicer@v2.4.2:src/slic3r/GUI/PartPlate.cpp:3952-3964, 4836-4850, Plater.cpp:11394).
const PLATE_GAP = 1 / 5;
const AXES_TIP_RADIUS = 1.25;
const TOWER_MARGIN = 5;

export function parseBed(printableArea: ConfigValue | undefined): Bed {
  const pts = asList(printableArea).map((p) => p.split('x').map(Number) as [number, number]);
  if (pts.length < 3 || pts.some((p) => p.some((n) => !Number.isFinite(n)))) throw new Error('printable_area is missing or invalid');
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { min: [Math.min(...xs), Math.min(...ys)], max: [Math.max(...xs), Math.max(...ys)] };
}

export function plateColumns(count: number): number {
  const value = Math.sqrt(count);
  const rounded = Math.round(value);
  return value > rounded ? rounded + 1 : rounded;
}

export function plateOrigin(index: number, count: number, bed: Bed): [number, number] {
  const cols = plateColumns(count);
  // The GUI stores plate size as int, truncating.
  const strideX = Math.trunc(bed.max[0] - bed.min[0] - AXES_TIP_RADIUS) * (1 + PLATE_GAP);
  const strideY = Math.trunc(bed.max[1] - bed.min[1] - AXES_TIP_RADIUS) * (1 + PLATE_GAP);
  return [(index % cols) * strideX, -Math.floor(index / cols) * strideY];
}

function itemPlates(geo: ModelGeometry, settings: ModelSettings): number[] {
  const seen = new Map<string, number>();
  return geo.items.map((item) => {
    const instanceId = seen.get(item.objectId) ?? 0;
    seen.set(item.objectId, instanceId + 1);
    const plate = settings.plates.find((p) => p.instances.some((i) => i.objectId === item.objectId && i.instanceId === instanceId));
    return plate?.id ?? 1;
  });
}

/** Centres each plate's layout on the matching target plate, keeping relative positions; never scales. */
export function planPlacement(geo: ModelGeometry, settings: ModelSettings, source: { bed: Bed; wipeTower?: { x: ConfigValue; y: ConfigValue }; towerWidth: number }, target: Bed): PlacementPlan {
  const plateOfItem = itemPlates(geo, settings);
  const plateCount = Math.max(1, settings.plates.length, ...plateOfItem);
  const shifts: [number, number][] = geo.items.map(() => [0, 0]);
  const plates: PlateSummary[] = [];
  const deltas: [number, number][] = [];

  for (let plate = 1; plate <= plateCount; plate++) {
    const indices = plateOfItem.flatMap((p, i) => (p === plate ? [i] : []));
    const boxes = indices.map((i) => itemBounds(geo, geo.items[i]!)).filter((b) => b !== undefined);
    if (boxes.length === 0) { deltas.push([0, 0]); continue; }
    const min = [Math.min(...boxes.map((b) => b.min[0]!)), Math.min(...boxes.map((b) => b.min[1]!))];
    const max = [Math.max(...boxes.map((b) => b.max[0]!)), Math.max(...boxes.map((b) => b.max[1]!))];
    const origin = plateOrigin(plate - 1, plateCount, target);
    const centre = [origin[0] + (target.min[0] + target.max[0]) / 2, origin[1] + (target.min[1] + target.max[1]) / 2];
    const delta: [number, number] = [centre[0]! - (min[0]! + max[0]!) / 2, centre[1]! - (min[1]! + max[1]!) / 2];
    for (const i of indices) shifts[i] = delta;
    deltas.push(delta);
    const fits = max[0]! - min[0]! <= target.max[0] - target.min[0] && max[1]! - min[1]! <= target.max[1] - target.min[1];
    plates.push({ id: plate, objects: indices.length, fits, shift: delta });
  }

  if (!source.wipeTower) return { shifts, plates };
  const xs = asList(source.wipeTower.x);
  const ys = asList(source.wipeTower.y);
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const x: string[] = [];
  const y: string[] = [];
  for (let p = 0; p < plateCount; p++) {
    const src = plateOrigin(p, plateCount, source.bed);
    const dst = plateOrigin(p, plateCount, target);
    const d = deltas[p] ?? [0, 0];
    const tx = src[0] + Number(xs[p] ?? xs[0] ?? 0) + d[0] - dst[0];
    const ty = src[1] + Number(ys[p] ?? ys[0] ?? 0) + d[1] - dst[1];
    // ponytail: tower depth is computed by the slicer at slice time; width is a fair upper bound for the clamp.
    x.push(String(Number(clamp(tx, target.min[0] + TOWER_MARGIN, target.max[0] - source.towerWidth - TOWER_MARGIN).toFixed(3))));
    y.push(String(Number(clamp(ty, target.min[1] + TOWER_MARGIN, target.max[1] - source.towerWidth - TOWER_MARGIN).toFixed(3))));
  }
  return { shifts, plates, wipeTower: { x, y } };
}
