// PrusaSlicer 2.x project → Bambu/Orca project layout, so the rest of the pipeline treats both sources the same.
// Prusa stores one mesh per object with volumes as triangle ranges (vertices already in object space) and settings
// in Slic3r_PE*.config; Orca reads that format as geometry only.
import type { OptionInfo } from '@retarget3mf/profiles';
import type { Config } from '../config.ts';
import { MAIN_MODEL } from '../model.ts';
import { MODEL_SETTINGS } from '../modelSettings.ts';
import { parsePrusaIni, translatePrusaConfig, translatePrusaKey } from '../rules/prusa.ts';
import { attrs, childrenOf, elements, parseXml, tagOf } from '../xml.ts';
import { readText, setText, type Archive } from '../zip.ts';

export const PRUSA_CONFIG = 'Metadata/Slic3r_PE.config';
const PRUSA_MODEL_CONFIG = 'Metadata/Slic3r_PE_model.config';
const PRUSA_RANGES = 'Metadata/Prusa_Slicer_layer_config_ranges.xml';
const PRUSA_HEIGHTS = 'Metadata/Slic3r_PE_layer_heights_profile.txt';
const PRUSA_CUSTOM_GCODE = 'Metadata/Prusa_Slicer_custom_gcode_per_print_z.xml';

const SUBTYPES: Record<string, string> = {
  ModelPart: 'normal_part', ParameterModifier: 'modifier_part', NegativeVolume: 'negative_part',
  SupportBlocker: 'support_blocker', SupportEnforcer: 'support_enforcer',
};
const PAINT_ATTRS: Record<string, string> = {
  'slic3rpe:mmu_segmentation': 'paint_color', 'slic3rpe:custom_supports': 'paint_supports',
  'slic3rpe:custom_seam': 'paint_seam', 'slic3rpe:fuzzy_skin': 'paint_fuzzy_skin',
};
const META_SKIP = new Set(['name', 'volume_type', 'modifier', 'matrix']);

interface PrusaVolume { first: number; last: number; name: string; subtype: string; config: Record<string, string> }
interface PrusaObject { id: string; name: string; config: Record<string, string>; volumes: PrusaVolume[] }

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function readObjects(text: string | undefined): Map<string, PrusaObject> {
  const objects = new Map<string, PrusaObject>();
  const config = parseXml(text ?? '').find((n) => tagOf(n) === 'config');
  for (const o of elements(config ? childrenOf(config) : [], 'object')) {
    const meta = (nodes: ReturnType<typeof childrenOf>) => Object.fromEntries(elements(nodes, 'metadata').map((m) => [attrs(m).key ?? '', attrs(m).value ?? '']));
    const objectMeta = meta(childrenOf(o));
    const volumes = elements(childrenOf(o), 'volume').map((v) => {
      const m = meta(childrenOf(v));
      const subtype = m.modifier === '1' ? 'modifier_part' : (SUBTYPES[m.volume_type ?? 'ModelPart'] ?? 'normal_part');
      const config = Object.fromEntries(Object.entries(m).filter(([k]) => !META_SKIP.has(k) && !k.startsWith('source_')));
      return { first: Number(attrs(v).firstid), last: Number(attrs(v).lastid), name: m.name ?? '', subtype, config };
    });
    const config = Object.fromEntries(Object.entries(objectMeta).filter(([k]) => k !== 'name'));
    objects.set(attrs(o).id ?? '', { id: attrs(o).id ?? '', name: objectMeta.name ?? '', config, volumes });
  }
  return objects;
}

function metadataXml(config: Record<string, string>, indent: string): string {
  return Object.entries(config)
    .flatMap(([k, v]) => translatePrusaKey(k, v))
    .map(([k, v]) => `${indent}<metadata key="${escapeXml(k)}" value="${escapeXml(v)}"/>\n`).join('');
}

/** Splits each Prusa object mesh into one Orca sub-model object per volume, re-indexing vertices. */
function splitMeshes(model: string, objects: Map<string, PrusaObject>, nextId: () => number) {
  const subModels: string[] = [];
  const components = new Map<string, { id: number; volume: PrusaVolume }[]>();
  for (const obj of model.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const id = obj[1]!.match(/\sid="([^"]+)"/)?.[1] ?? '';
    const vertices = [...obj[2]!.matchAll(/<vertex\b[^>]*\/>/g)].map((v) => v[0]);
    const triangles = [...obj[2]!.matchAll(/<triangle\b([^>]*)\/>/g)].map((t) => t[1]!);
    const prusa = objects.get(id);
    const volumes = prusa?.volumes.length ? prusa.volumes : [{ first: 0, last: triangles.length - 1, name: prusa?.name ?? '', subtype: 'normal_part', config: {} }];
    components.set(id, volumes.map((volume) => {
      const meshId = nextId();
      const index = new Map<number, number>();
      const tris: string[] = [];
      for (const attrsText of triangles.slice(volume.first, volume.last + 1)) {
        const remapped = attrsText.replace(/\b(v[123])="(\d+)"/g, (_, k: string, v: string) => {
          const old = Number(v);
          if (!index.has(old)) index.set(old, index.size);
          return `${k}="${index.get(old)}"`;
        }).replace(/\b(slic3rpe:[a-z_]+)=/g, (m, k: string) => (PAINT_ATTRS[k] ? `${PAINT_ATTRS[k]}=` : m));
        tris.push(`<triangle${remapped}/>`);
      }
      const verts = [...index.keys()].map((i) => vertices[i]!);
      const type = volume.subtype === 'normal_part' ? 'model' : 'other';
      subModels.push(`  <object id="${meshId}" type="${type}"><mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>\n`);
      return { id: meshId, volume };
    }));
  }
  return { subModels, components };
}

function rangesXml(text: string): string {
  return text.replace(/<option opt_key="([^"]+)">([^<]*)<\/option>/g, (_, k: string, v: string) =>
    translatePrusaKey(k, v).map(([key, value]) => `<option opt_key="${key}">${value}</option>`).join(''));
}

/** Prusa per-print-Z codes → Orca per-layer codes (same type numbers and attributes, renamed print_z → top_z). */
function customGcodeXml(text: string): string {
  const codes = [...text.matchAll(/<code\b([^>]*)\/>/g)].map((c) => `<layer${c[1]!.replace(/\bprint_z=/, 'top_z=')}/>`);
  const mode = text.match(/<mode value="([^"]*)"/)?.[1] ?? 'SingleExtruder';
  return `<?xml version="1.0" encoding="utf-8"?>\n<custom_gcodes_per_layer>\n<plate>\n<plate_info id="1"/>\n${codes.join('\n')}\n<mode value="${mode}"/>\n</plate>\n</custom_gcodes_per_layer>\n`;
}

export function prusaToBambu(archive: Archive, options: Readonly<Record<string, OptionInfo>>): { archive: Archive; config: Config } {
  const config = translatePrusaConfig(parsePrusaIni(readText(archive, PRUSA_CONFIG) ?? ''), options);
  const model = readText(archive, MAIN_MODEL) ?? '';
  const objects = readObjects(readText(archive, PRUSA_MODEL_CONFIG));
  let counter = 1;
  const { subModels, components } = splitMeshes(model, objects, () => counter++);

  // Main objects get ids after all mesh ids so no id is reused across files (as BambuStudio writes them).
  const mainIds = new Map([...components.keys()].map((id) => [id, String(counter++)]));
  const SUB_MODEL = '3D/Objects/object_1.model';
  const mainObjects = [...components].map(([prusaId, parts]) => {
    const id = mainIds.get(prusaId)!;
    const refs = parts.map((p) => `    <component p:path="/${SUB_MODEL}" objectid="${p.id}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>\n`).join('');
    return `  <object id="${id}" type="model">\n   <components>\n${refs}   </components>\n  </object>\n`;
  }).join('');
  const items = [...model.matchAll(/<item\b[^>]*>/g)]
    .map((m) => `  ${m[0].replace(/objectid="([^"]+)"/, (_, id: string) => `objectid="${mainIds.get(id) ?? id}"`).replace(/\/?>$/, '/>')}\n`).join('');
  const metadata = [...model.matchAll(/<metadata name="(Title|Designer|Description|Copyright|License|Application)">[^<]*<\/metadata>/g)].map((m) => ` ${m[0]}\n`).join('');

  const settingsObjects = [...components].map(([prusaId, parts]) => {
    const id = mainIds.get(prusaId)!;
    const prusa = objects.get(prusaId);
    const partXml = parts.map(({ id: partId, volume }) =>
      `    <part id="${partId}" subtype="${volume.subtype}">\n      <metadata key="name" value="${escapeXml(volume.name)}"/>\n${metadataXml(volume.config, '      ')}    </part>\n`).join('');
    return `  <object id="${id}">\n    <metadata key="name" value="${escapeXml(prusa?.name ?? '')}"/>\n${metadataXml(prusa?.config ?? {}, '    ')}${partXml}  </object>\n`;
  }).join('');
  const seen = new Map<string, number>();
  const instances = [...model.matchAll(/<item\b[^>]*objectid="([^"]+)"/g)].map((m) => {
    const n = seen.get(m[1]!) ?? 0;
    seen.set(m[1]!, n + 1);
    return `    <model_instance>\n      <metadata key="object_id" value="${mainIds.get(m[1]!) ?? m[1]}"/>\n      <metadata key="instance_id" value="${n}"/>\n    </model_instance>\n`;
  }).join('');

  const out: Archive = new Map();
  for (const [path, data] of archive) {
    if (path.startsWith('Metadata/Slic3r_PE') || path.startsWith('Metadata/Prusa_Slicer')) continue;
    out.set(path, data);
  }
  setText(out, MAIN_MODEL, `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">\n${metadata} <resources>\n${mainObjects} </resources>\n <build>\n${items} </build>\n</model>\n`);
  setText(out, SUB_MODEL, `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n <resources>\n${subModels.join('')} </resources>\n</model>\n`);
  setText(out, '3D/_rels/3dmodel.model.rels', `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n <Relationship Target="/${SUB_MODEL}" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>\n`);
  setText(out, MODEL_SETTINGS, `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n${settingsObjects}  <plate>\n    <metadata key="plater_id" value="1"/>\n${instances}  </plate>\n</config>\n`);

  const ranges = readText(archive, PRUSA_RANGES);
  if (ranges) setText(out, 'Metadata/layer_config_ranges.xml', rangesXml(ranges));
  const heights = readText(archive, PRUSA_HEIGHTS);
  if (heights) setText(out, 'Metadata/layer_heights_profile.txt', heights);
  const gcode = readText(archive, PRUSA_CUSTOM_GCODE);
  if (gcode) setText(out, 'Metadata/custom_gcode_per_layer.xml', customGcodeXml(gcode));
  const thumbnail = archive.get('Metadata/thumbnail.png');
  if (thumbnail && !out.has('Metadata/plate_1.png')) out.set('Metadata/plate_1.png', thumbnail);
  return { archive: out, config };
}
