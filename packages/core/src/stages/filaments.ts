import { asList, type Config } from '../config.ts';
import { objectMeshes, type ModelGeometry } from '../model.ts';
import type { ModelSettings } from '../modelSettings.ts';
import { FILAMENT_REF_KEYS } from '../rules/index.ts';

export interface FilamentPlan {
  /** Source filament numbers (1-based) that survive, ascending. */
  keep: number[];
  /** Source filament number → output filament number. */
  map: Map<number, number>;
  hasPaintedSupports: boolean;
}

const IGNORED_SUBTYPES = new Set(['negative_part', 'support_blocker', 'support_enforcer']);
// Bambu feature filaments use 1 for "default", so only higher values prove use.
const BAMBU_FEATURE_KEYS = ['wall_filament', 'sparse_infill_filament', 'solid_infill_filament'];

function refsIn(config: Readonly<Record<string, unknown>>, add: (n: number) => void): void {
  for (const key of FILAMENT_REF_KEYS) if (key !== 'extruder') add(Number(config[key]));
  for (const key of BAMBU_FEATURE_KEYS) {
    const n = Number(config[key]);
    if (n > 1) add(n);
  }
}

/** Which source filaments the project prints with: object/part filaments, painted states, feature filaments, per-layer changes. */
export function planFilaments(config: Config, settings: ModelSettings, geo: ModelGeometry, customGcode: string | undefined): FilamentPlan {
  const count = asList(config.filament_colour).length;
  const used = new Set<number>();
  const add = (n: number) => { if (Number.isInteger(n) && n >= 1 && n <= count) used.add(n); };
  let hasPaintedSupports = false;

  const objects = new Map(settings.objects.map((o) => [o.id, o]));
  const objectIds = new Set([...geo.items.map((i) => i.objectId)]);
  for (const objectId of objectIds) {
    const object = objects.get(objectId);
    const objectFilament = Number(object?.config.extruder) || 1;
    if (object) refsIn(object.config, add);
    for (const mesh of objectMeshes(geo, objectId)) {
      const part = object?.parts.find((p) => p.id === mesh.partId);
      if (part && IGNORED_SUBTYPES.has(part.subtype)) continue;
      const filament = Number(part?.config.extruder) || objectFilament;
      if (part) refsIn(part.config, add);
      if (part?.subtype === 'modifier_part') {
        if (part.config.extruder) add(filament);
        continue;
      }
      const info = geo.meshes.get(mesh.key);
      if (!info || info.usesBase) add(filament);
      info?.paintStates.forEach(add);
      hasPaintedSupports ||= info?.hasSupportPaint ?? false;
    }
  }
  refsIn(config, add);
  for (const m of customGcode?.matchAll(/\bextruder="(\d+)"/g) ?? []) add(Number(m[1]));

  const keep = used.size ? [...used].sort((a, b) => a - b) : [1];
  return { keep, map: new Map(keep.map((n, i) => [n, i + 1])), hasPaintedSupports };
}

/**
 * Printers with independent toolheads get one filament per toolhead: OrcaSlicer pads the filament list to the
 * nozzle count anyway (OrcaSlicer@v2.4.2:src/libslic3r/PresetBundle.cpp:5195-5200). Spare toolheads repeat the first
 * filament's settings; nothing is assigned to them.
 */
export function padToToolheads(plan: FilamentPlan, toolheads: number): FilamentPlan {
  const spare = Math.max(0, toolheads - plan.keep.length);
  return spare === 0 ? plan : { ...plan, keep: [...plan.keep, ...Array<number>(spare).fill(plan.keep[0]!)] };
}

/** Remaps a 1-based filament reference; 0 ("default") stays 0. */
export function remapRef(value: string, map: ReadonlyMap<number, number>): string {
  const n = Number(value);
  if (!Number.isInteger(n) || n === 0) return value;
  return String(map.get(n) ?? 1);
}

/** Source filament (1-based) → target filament (1-based). Several sources may share a target (colour merge). */
export type FilamentMap = Readonly<Record<number, number>>;

/** Applies a user mapping; targets must be 1..k without gaps and every used filament must be mapped. */
/** Unused filaments stay after the used ones, in their order, while the printer has free slots. */
export function keepUnusedFilaments(plan: FilamentPlan, total: number, slots: number): FilamentPlan {
  const free = Math.max(0, slots - plan.keep.length);
  const extras = Array.from({ length: total }, (_, i) => i + 1).filter((f) => !plan.map.has(f)).slice(0, free);
  return { ...plan, keep: [...plan.keep, ...extras], map: new Map([...plan.map, ...extras.map((f, i): [number, number] => [f, plan.keep.length + i + 1])]) };
}

export function applyFilamentMap(plan: FilamentPlan, user: FilamentMap): FilamentPlan {
  const targets = plan.keep.map((f) => user[f]);
  if (targets.some((t) => t === undefined || !Number.isInteger(t) || t < 1)) {
    throw new Error(`filament map must assign every used filament (${plan.keep.join(', ')}) to a slot`);
  }
  const count = Math.max(...(targets as number[]));
  const representatives: number[] = [];
  for (let slot = 1; slot <= count; slot++) {
    const first = plan.keep.find((f) => user[f] === slot);
    if (first === undefined) throw new Error(`filament map leaves slot ${slot} empty; slots must be filled from 1 without gaps`);
    representatives.push(first);
  }
  return { ...plan, keep: representatives, map: new Map(plan.keep.map((f) => [f, user[f]!])) };
}
