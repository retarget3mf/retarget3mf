// 3MF geometry files are machine-written and can be >100 MB, so they are edited with targeted attribute
// regexes instead of a DOM (docs/decisions/0003-xml-handling.md).
import { strFromU8 } from 'fflate';
import { paintStates } from './paint.ts';
import { readText, type Archive } from './zip.ts';

export const MAIN_MODEL = '3D/3dmodel.model';

/** Column-major 3x4 affine transform, as in 3MF `transform` attributes. */
export type Transform = readonly number[];
export const IDENTITY: Transform = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

export interface Component { path: string; objectId: string; transform: Transform }
export interface BuildItem { objectId: string; transform: Transform }
export interface MeshInfo {
  min: [number, number, number];
  max: [number, number, number];
  paintStates: Set<number>;
  /** Some triangle keeps the volume's own filament (unpainted or painted with state 0). */
  usesBase: boolean;
  hasSupportPaint: boolean;
}

export interface ModelGeometry {
  /** Main-model object id → components (empty when the object holds its own mesh). */
  objects: Map<string, Component[]>;
  items: BuildItem[];
  /** `${path}#${objectId}` → mesh summary. */
  meshes: Map<string, MeshInfo>;
}

const attr = (tag: string, name: string): string | undefined =>
  tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

export function parseTransform(value: string | undefined): Transform {
  if (!value) return IDENTITY;
  const t = value.trim().split(/\s+/).map(Number);
  return t.length === 12 && t.every(Number.isFinite) ? t : IDENTITY;
}

export function formatTransform(t: Transform): string {
  return t.map((n) => String(Number(n.toFixed(9)))).join(' ');
}

export function compose(outer: Transform, inner: Transform): Transform {
  const r = (t: Transform, row: number, col: number) => t[col * 3 + row]!;
  const out: number[] = [];
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 3; row++) {
      let v = 0;
      for (let k = 0; k < 3; k++) v += r(outer, row, k) * r(inner, k, col);
      out.push(col === 3 ? v + r(outer, row, 3) : v);
    }
  }
  return out;
}

export function apply(t: Transform, [x, y, z]: readonly number[]): [number, number, number] {
  return [0, 1, 2].map((row) => t[row]! * x! + t[3 + row]! * y! + t[6 + row]! * z! + t[9 + row]!) as [number, number, number];
}

function scanMeshes(path: string, text: string, into: Map<string, MeshInfo>): void {
  for (const obj of text.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const body = obj[2]!;
    if (!body.includes('<mesh')) continue;
    const info: MeshInfo = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], paintStates: new Set(), usesBase: false, hasSupportPaint: false };
    for (const v of body.matchAll(/<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g)) {
      for (let i = 0; i < 3; i++) {
        const n = Number(v[i + 1]);
        if (n < info.min[i]!) info.min[i] = n;
        if (n > info.max[i]!) info.max[i] = n;
      }
    }
    for (const tri of body.matchAll(/<triangle\b[^>]*>/g)) {
      if (tri[0].includes(' paint_supports="')) info.hasSupportPaint = true;
      const paint = attr(tri[0], 'paint_color');
      if (!paint) { info.usesBase = true; continue; }
      for (const s of paintStates(paint)) s === 0 ? (info.usesBase = true) : info.paintStates.add(s);
    }
    into.set(`${path}#${attr(obj[1]!, 'id')}`, info);
  }
}

export function readGeometry(archive: Archive): ModelGeometry {
  const main = readText(archive, MAIN_MODEL) ?? '';
  const objects = new Map<string, Component[]>();
  for (const obj of main.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const components = [...obj[2]!.matchAll(/<component\b[^>]*>/g)].map((c) => ({
      path: (attr(c[0], 'p:path') ?? `/${MAIN_MODEL}`).replace(/^\//, ''),
      objectId: attr(c[0], 'objectid') ?? '',
      transform: parseTransform(attr(c[0], 'transform')),
    }));
    objects.set(attr(obj[1]!, 'id') ?? '', components);
  }
  const items = [...main.matchAll(/<item\b[^>]*>/g)].map((m) => ({
    objectId: attr(m[0], 'objectid') ?? '',
    transform: parseTransform(attr(m[0], 'transform')),
  }));
  const meshes = new Map<string, MeshInfo>();
  for (const [path, data] of archive) {
    if (path.startsWith('3D/') && path.endsWith('.model')) scanMeshes(path, strFromU8(data), meshes);
  }
  return { objects, items, meshes };
}

/** Meshes (with their placement inside the object) that make up a main-model object. */
export function objectMeshes(geo: ModelGeometry, objectId: string): { key: string; partId: string; transform: Transform }[] {
  const components = geo.objects.get(objectId) ?? [];
  if (components.length === 0) return [{ key: `${MAIN_MODEL}#${objectId}`, partId: objectId, transform: IDENTITY }];
  return components.map((c) => ({ key: `${c.path}#${c.objectId}`, partId: c.objectId, transform: c.transform }));
}

export function itemBounds(geo: ModelGeometry, item: BuildItem): { min: number[]; max: number[] } | undefined {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const part of objectMeshes(geo, item.objectId)) {
    const mesh = geo.meshes.get(part.key);
    if (!mesh || mesh.min[0] === Infinity) continue;
    const t = compose(item.transform, part.transform);
    // ponytail: transformed local AABB corners overestimate rotated parts; exact hull only matters for tight fits.
    for (let c = 0; c < 8; c++) {
      const p = apply(t, [c & 1 ? mesh.max[0] : mesh.min[0], c & 2 ? mesh.max[1] : mesh.min[1], c & 4 ? mesh.max[2] : mesh.min[2]]);
      p.forEach((v, i) => { min[i] = Math.min(min[i]!, v); max[i] = Math.max(max[i]!, v); });
    }
  }
  return min[0] === Infinity ? undefined : { min, max };
}

/** Rewrites build item transforms in order; `translate[i]` is added to item i. */
export function moveItems(text: string, translate: readonly (readonly [number, number])[]): string {
  let i = 0;
  return text.replace(/<item\b[^>]*>/g, (tag) => {
    const d = translate[i++];
    if (!d || (d[0] === 0 && d[1] === 0)) return tag;
    const t = [...parseTransform(attr(tag, 'transform'))];
    t[9] = t[9]! + d[0];
    t[10] = t[10]! + d[1];
    const value = formatTransform(t);
    return / transform="/.test(tag) ? tag.replace(/ transform="[^"]*"/, ` transform="${value}"`) : tag.replace(/<item\b/, `<item transform="${value}"`);
  });
}

export function remapPaintInText(text: string, remap: (hex: string) => string): string {
  return text.replace(/ paint_color="([0-9A-Fa-f]*)"/g, (_, hex: string) => ` paint_color="${remap(hex.toUpperCase())}"`);
}

export function setModelMetadata(text: string, name: string, value: string): string {
  const re = new RegExp(`<metadata name="${name}">[^<]*</metadata>`);
  const tag = `<metadata name="${name}">${value}</metadata>`;
  return re.test(text) ? text.replace(re, tag) : text.replace(/(<model\b[^>]*>)/, `$1\n ${tag}`);
}
