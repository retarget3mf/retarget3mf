import { attrs, buildXml, childrenOf, elements, parseXml, tagOf, type XmlNode } from './xml.ts';

export const MODEL_SETTINGS = 'Metadata/model_settings.config';

export interface PartSettings { id: string; name: string; subtype: string; config: Record<string, string> }
export interface ObjectSettings { id: string; name: string; config: Record<string, string>; parts: PartSettings[] }
export interface PlateSettings { id: number; instances: { objectId: string; instanceId: number }[] }
export interface ModelSettings { objects: ObjectSettings[]; plates: PlateSettings[] }

const SPECIAL_META = new Set(['name', 'module', 'matrix', 'volume_type', 'part_type']);

function metadataConfig(nodes: XmlNode[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of elements(nodes, 'metadata')) {
    const { key, value } = attrs(m);
    if (key && value !== undefined && !SPECIAL_META.has(key) && !key.startsWith('source_')) out[key] = value;
  }
  return out;
}

function root(tree: XmlNode[]): XmlNode[] {
  const config = tree.find((n) => tagOf(n) === 'config');
  return config ? childrenOf(config) : [];
}

export function readModelSettings(text: string | undefined): ModelSettings {
  if (!text) return { objects: [], plates: [] };
  const nodes = root(parseXml(text));
  const objects = elements(nodes, 'object').map((o) => {
    const kids = childrenOf(o);
    const meta = elements(kids, 'metadata').find((m) => attrs(m).key === 'name');
    return {
      id: attrs(o).id ?? '',
      name: (meta && attrs(meta).value) ?? '',
      config: metadataConfig(kids),
      parts: elements(kids, 'part').map((p) => {
        const name = elements(childrenOf(p), 'metadata').find((m) => attrs(m).key === 'name');
        return { id: attrs(p).id ?? '', name: (name && attrs(name).value) ?? '', subtype: attrs(p).subtype ?? 'normal_part', config: metadataConfig(childrenOf(p)) };
      }),
    };
  });
  const plates = elements(nodes, 'plate').map((p, index) => {
    const kids = childrenOf(p);
    const id = elements(kids, 'metadata').find((m) => attrs(m).key === 'plater_id');
    return {
      id: Number(id && attrs(id).value) || index + 1,
      instances: elements(kids, 'model_instance').map((mi) => {
        const meta = metadataConfig(childrenOf(mi));
        return { objectId: meta.object_id ?? '', instanceId: Number(meta.instance_id ?? 0) };
      }),
    };
  });
  return { objects, plates };
}

/** Replacement entries for one metadata key/value; [] removes it. */
export type MetadataEdit = (key: string, value: string) => [string, string][];

export interface ModelSettingsEdit {
  /** Per-object and per-part config keys; `context` is the object's name. */
  config: (key: string, value: string, context: string) => [string, string][];
  /** Plate-level metadata, e.g. filament_maps. */
  plate: MetadataEdit;
}

function editMetadata(nodes: XmlNode[], edit: MetadataEdit): XmlNode[] {
  return nodes.flatMap((n) => {
    if (tagOf(n) !== 'metadata') return [n];
    const { key, value } = attrs(n);
    if (!key || value === undefined || SPECIAL_META.has(key) || key.startsWith('source_')) return [n];
    return edit(key, value).map(([k, v]) => ({ ...n, ':@': { ...attrs(n), key: k, value: v } }));
  });
}

const withChildren = (node: XmlNode, kids: XmlNode[]): XmlNode => ({ ...node, [tagOf(node)!]: kids });

export function editModelSettings(text: string, edit: ModelSettingsEdit): string {
  const tree = parseXml(text).map((top) => {
    if (tagOf(top) !== 'config') return top;
    return withChildren(top, childrenOf(top).map((n) => {
      switch (tagOf(n)) {
        case 'object': {
          const name = attrs(elements(childrenOf(n), 'metadata').find((m) => attrs(m).key === 'name') ?? {}).value ?? attrs(n).id ?? '';
          const objectEdit: MetadataEdit = (k, v) => edit.config(k, v, name);
          return withChildren(n, editMetadata(childrenOf(n), objectEdit).map((k) =>
            tagOf(k) === 'part' ? withChildren(k, editMetadata(childrenOf(k), objectEdit)) : k));
        }
        case 'plate':
          return withChildren(n, editMetadata(childrenOf(n), edit.plate));
        default:
          return n;
      }
    }));
  });
  return buildXml(tree);
}
