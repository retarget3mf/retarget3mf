// Bambu/Orca project layout → PrusaSlicer 2.9 project, the reverse of sources/prusa.ts. PrusaSlicer stores one mesh
// per object with volumes as triangle ranges and its settings in Slic3r_PE*.config; it ignores Orca's files.
import type { PrusaProfiles } from '@retarget3mf/profiles';
import { asList, first, type Config } from '../config.ts';
import { apply, compose, IDENTITY, MAIN_MODEL, objectMeshes, readGeometry, type ModelGeometry, type Transform, formatTransform } from '../model.ts';
import { MODEL_SETTINGS, readModelSettings, type ModelSettings } from '../modelSettings.ts';
import { toPrusaSettings } from '../rules/toPrusa.ts';
import { itemPlates, parseBed, plateOrigin, type Bed } from '../stages/placement.ts';
import { readText, setText, type Archive } from '../zip.ts';

const VOLUME_TYPES: Record<string, string> = {
  normal_part: 'ModelPart', modifier_part: 'ParameterModifier', negative_part: 'NegativeVolume',
  support_blocker: 'SupportBlocker', support_enforcer: 'SupportEnforcer',
};
const PAINT_ATTRS: Record<string, string> = {
  paint_color: 'slic3rpe:mmu_segmentation', paint_supports: 'slic3rpe:custom_supports',
  paint_seam: 'slic3rpe:custom_seam', paint_fuzzy_skin: 'slic3rpe:fuzzy_skin',
};

const nozzleOf = (p: PrusaProfiles) => Number(p.printer.nozzle_diameter?.split(',')[0]) || 0.4;
const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const num = (n: number) => String(Number(n.toPrecision(9)));

interface Volume { first: number; last: number; name: string; type: string; config: Record<string, string> }
interface PrusaObject { name: string; config: Record<string, string>; mesh: string; volumes: Volume[] }

/** Concatenates an object's component meshes, baking each component's transform into its vertices. */
function mergeObject(archive: Archive, geo: ModelGeometry, objectId: string, texts: Map<string, string>): { mesh: string; ranges: { partId: string; first: number; last: number }[] } {
  const vertices: string[] = [];
  const triangles: string[] = [];
  const ranges: { partId: string; first: number; last: number }[] = [];
  for (const part of objectMeshes(geo, objectId)) {
    const [path, id] = part.key.split('#') as [string, string];
    if (!texts.has(path)) texts.set(path, readText(archive, path) ?? '');
    const body = texts.get(path)!.match(new RegExp(`<object\\b[^>]*\\sid="${id}"[^>]*>([\\s\\S]*?)</object>`))?.[1] ?? '';
    const offset = vertices.length;
    const start = triangles.length;
    for (const v of body.matchAll(/<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g)) {
      const p = part.transform === IDENTITY ? [v[1], v[2], v[3]] : apply(part.transform, [Number(v[1]), Number(v[2]), Number(v[3])]).map(num);
      vertices.push(`<vertex x="${p[0]}" y="${p[1]}" z="${p[2]}"/>`);
    }
    for (const t of body.matchAll(/<triangle\b([^>]*?)\/?>/g)) {
      const attrs = [...t[1]!.matchAll(/\s([\w:]+)="([^"]*)"/g)].flatMap(([, k, v]) => {
        if (/^v[123]$/.test(k!)) return [`${k}="${Number(v) + offset}"`];
        return PAINT_ATTRS[k!] ? [`${PAINT_ATTRS[k!]}="${v}"`] : [];
      });
      triangles.push(`<triangle ${attrs.join(' ')}/>`);
    }
    if (triangles.length > start) ranges.push({ partId: part.partId, first: start, last: triangles.length - 1 });
  }
  return { mesh: `<mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh>`, ranges };
}

function readObjects(archive: Archive, geo: ModelGeometry, settings: ModelSettings, enums: PrusaProfiles['enums'], nozzle: number): Map<string, PrusaObject> {
  const texts = new Map<string, string>();
  const objects = new Map<string, PrusaObject>();
  // Model order, as PrusaSlicer's side files refer to objects by 1-based position.
  const built = new Set(geo.items.map((i) => i.objectId));
  for (const id of [...geo.objects.keys()].filter((o) => built.has(o))) {
    const s = settings.objects.find((o) => o.id === id);
    const { mesh, ranges } = mergeObject(archive, geo, id, texts);
    const volumes = ranges.map(({ partId, first: f, last }) => {
      const part = s?.parts.find((p) => p.id === partId);
      return { first: f, last, name: part?.name || s?.name || '', type: VOLUME_TYPES[part?.subtype ?? 'normal_part'] ?? 'ModelPart', config: toPrusaSettings(part?.config ?? {}, enums, nozzle) };
    });
    objects.set(id, { name: s?.name ?? '', config: toPrusaSettings(s?.config ?? {}, enums, nozzle), mesh, volumes });
  }
  return objects;
}

/** Bed `index` offset in PrusaSlicer 2.9's bed grid (MultipleBeds::get_bed_translation, BedsGrid::index2grid_coords). */
export function prusaBedOffset(index: number, bed: Bed): [number, number] {
  if (index === 0) return [0, 0];
  let a = 1;
  while ((a + 1) * (a + 1) < index + 1) a++;
  const id = index + 1 - a * a;
  const [x, y] = id <= a ? [a, id - 1] : [id - a - 1, a];
  const [w, d] = [bed.max[0] - bed.min[0], bed.max[1] - bed.min[1]];
  const gap = Math.min(100, Math.hypot(w, d) * 0.3);
  return [x * (w + gap), y * (d + gap)];
}

function modelXml(main: string, objects: Map<string, PrusaObject>, geo: ModelGeometry, moves: [number, number][], version: string): string {
  const ids = new Map([...objects.keys()].map((id, i) => [id, i + 1]));
  const resources = [...objects].map(([id, o]) => `  <object id="${ids.get(id)}" type="model">${o.mesh}</object>\n`).join('');
  const items = geo.items.map((item, i) => {
    const t: Transform = compose([1, 0, 0, 0, 1, 0, 0, 0, 1, moves[i]![0], moves[i]![1], 0], item.transform);
    return `  <item objectid="${ids.get(item.objectId)}" transform="${formatTransform(t)}" printable="1"/>\n`;
  }).join('');
  const metadata = [...main.matchAll(/<metadata name="(Title|Designer|Description|Copyright|LicenseTerms|License)">[^<]*<\/metadata>/g)].map((m) => ` ${m[0]}\n`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">\n`
    + ` <metadata name="slic3rpe:Version3mf">1</metadata>\n <metadata name="slic3rpe:MmPaintingVersion">1</metadata>\n <metadata name="slic3rpe:FdmSupportsPaintingVersion">1</metadata>\n <metadata name="slic3rpe:SeamPaintingVersion">1</metadata>\n <metadata name="slic3rpe:FuzzySkinPaintingVersion">1</metadata>\n`
    + `${metadata} <metadata name="Application">PrusaSlicer-${version}</metadata>\n <resources>\n${resources} </resources>\n <build>\n${items} </build>\n</model>\n`;
}

function modelConfigXml(objects: Map<string, PrusaObject>, geo: ModelGeometry): string {
  const meta = (type: string, config: Record<string, string>, indent: string) => Object.entries(config).map(([k, v]) => `${indent}<metadata type="${type}" key="${escapeXml(k)}" value="${escapeXml(v)}"/>\n`).join('');
  const body = [...objects].map(([id, o], i) => {
    const count = geo.items.filter((it) => it.objectId === id).length;
    const volumes = o.volumes.map((v) => `  <volume firstid="${v.first}" lastid="${v.last}">\n${meta('volume', { name: v.name, volume_type: v.type, ...v.config }, '   ')}  </volume>\n`).join('');
    return ` <object id="${i + 1}" instances_count="${count}">\n${meta('object', { name: o.name, ...o.config }, '  ')}${volumes} </object>\n`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n${body}</config>\n`;
}

/** Orca per-plate layer codes → PrusaSlicer per-bed print_z codes (same type numbers). */
function customGcodeXml(text: string): string {
  const beds = [...text.matchAll(/<plate>([\s\S]*?)<\/plate>/g)].map((p) => {
    const id = Number(p[1]!.match(/<plate_info id="(\d+)"/)?.[1] ?? 1);
    const codes = [...p[1]!.matchAll(/<layer\b([^>]*)\/>/g)].map((c) => `<code${c[1]!.replace(/\btop_z=/, 'print_z=')}/>`);
    const mode = p[1]!.match(/<mode value="([^"]*)"/)?.[1] ?? 'SingleExtruder';
    return `<custom_gcodes_per_print_z bed_idx="${id - 1}">\n${codes.join('\n')}\n<mode value="${mode}"/>\n</custom_gcodes_per_print_z>`;
  });
  return `<?xml version="1.0" encoding="utf-8"?>\n${beds.join('\n')}\n`;
}

function rangesXml(text: string, enums: PrusaProfiles['enums'], nozzle: number): string {
  return text.replace(/(<range\b[^>]*>)([\s\S]*?)(<\/range>)/g, (_, open: string, body: string, close: string) => {
    const options = Object.fromEntries([...body.matchAll(/<option opt_key="([^"]+)">([^<]*)<\/option>/g)].map((m) => [m[1]!, m[2]!]));
    const out = toPrusaSettings(options, enums, nozzle);
    return `${open}${Object.entries(out).map(([k, v]) => `<option opt_key="${k}">${v}</option>`).join('')}${close}`;
  });
}

/** `; key = value` lines: the Prusa presets for the printer, then the author's settings that PrusaSlicer has. */
export function prusaConfig(config: Config, profiles: PrusaProfiles): string {
  const type = (first(config.filament_type) ?? 'PLA').toUpperCase();
  const filament = profiles.filaments[type] ?? profiles.filaments.PLA!;
  const scalars = Object.fromEntries(Object.entries(config).map(([k, v]) => [k, first(v) ?? '']));
  const colour = asList(config.filament_colour)[0] ?? '';
  const ini: Record<string, string> = {
    ...profiles.printer, ...profiles.print, ...filament.preset,
    ...toPrusaSettings(scalars, profiles.enums, nozzleOf(profiles)),
    ...(colour && { extruder_colour: colour, filament_colour: colour }),
    printer_settings_id: profiles.printerName,
    print_settings_id: profiles.printName,
    filament_settings_id: `"${filament.name}"`,
    physical_printer_settings_id: '',
  };
  return `; generated by Retarget3MF for PrusaSlicer ${profiles.version}\n\n${Object.keys(ini).sort().map((k) => `; ${k} = ${ini[k]}`).join('\n')}\n`;
}

/** Repackages a converted (Orca-layout) project for PrusaSlicer; plates become beds of its 2.9 multi-bed grid. */
export function toPrusaSlicer(archive: Archive, config: Config, profiles: PrusaProfiles): Archive {
  const geo = readGeometry(archive);
  const settings = readModelSettings(readText(archive, MODEL_SETTINGS));
  const plateOfItem = itemPlates(geo, settings);
  const plateCount = Math.max(1, settings.plates.length, ...plateOfItem);
  const orcaBed = parseBed(config.printable_area);
  const prusaBed = parseBed(profiles.printer.bed_shape!.split(','));
  const moves = plateOfItem.map((plate): [number, number] => {
    const from = plateOrigin(plate - 1, plateCount, orcaBed);
    const to = prusaBedOffset(plate - 1, prusaBed);
    return [to[0] - from[0], to[1] - from[1]];
  });
  const nozzle = nozzleOf(profiles);
  const objects = readObjects(archive, geo, settings, profiles.enums, nozzle);

  const out: Archive = new Map();
  setText(out, '[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n <Default Extension="png" ContentType="image/png"/>\n</Types>\n');
  const thumbnail = archive.get('Metadata/plate_1.png');
  setText(out, '_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n${thumbnail ? ' <Relationship Target="/Metadata/thumbnail.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>\n' : ''}</Relationships>\n`);
  if (thumbnail) out.set('Metadata/thumbnail.png', thumbnail);
  setText(out, MAIN_MODEL, modelXml(readText(archive, MAIN_MODEL) ?? '', objects, geo, moves, profiles.version));
  setText(out, 'Metadata/Slic3r_PE.config', prusaConfig(config, profiles));
  setText(out, 'Metadata/Slic3r_PE_model.config', modelConfigXml(objects, geo));
  const ranges = readText(archive, 'Metadata/layer_config_ranges.xml');
  if (ranges) setText(out, 'Metadata/Prusa_Slicer_layer_config_ranges.xml', rangesXml(ranges, profiles.enums, nozzle));
  const heights = readText(archive, 'Metadata/layer_heights_profile.txt');
  if (heights) setText(out, 'Metadata/Slic3r_PE_layer_heights_profile.txt', heights);
  const gcode = readText(archive, 'Metadata/custom_gcode_per_layer.xml');
  if (gcode) setText(out, 'Metadata/Prusa_Slicer_custom_gcode_per_print_z.xml', customGcodeXml(gcode));
  return out;
}
