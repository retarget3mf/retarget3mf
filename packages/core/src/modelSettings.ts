import { attrs, buildXml, childrenOf, elements, parseXml, tagOf, type XmlNode } from './xml.ts';

export const MODEL_SETTINGS = 'Metadata/model_settings.config';

export interface PartSettings { id: string; subtype: string; config: Record<string, string> }
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
      parts: elements(kids, 'part').map((p) => ({ id: attrs(p).id ?? '', subtype: attrs(p).subtype ?? 'normal_part', config: metadataConfig(childrenOf(p)) })),
    };
  });
  const plates = elements(nodes, 'plate').map((p) => {
    const kids = childrenOf(p);
    const id = elements(kids, 'metadata').find((m) => attrs(m).key === 'plater_id');
    return {
      id: Number((id && attrs(id).value) ?? 0),
      instances: elements(kids, 'model_instance').map((mi) => {
        const meta = metadataConfig(childrenOf(mi));
        return { objectId: meta.object_id ?? '', instanceId: Number(meta.instance_id ?? 0) };
      }),
    };
  });
  return { objects, plates };
}

export interface ModelSettingsEdit {
  /** Return the new value, or undefined to remove the key. Called for per-object and per-part config keys. */
  config: (key: string, value: string) => string | undefined;
  /** Plate-level metadata, e.g. filament_maps. Same contract as `config`. */
  plate: (key: string, value: string) => string | undefined;
}

function editMetadata(nodes: XmlNode[], edit: (key: string, value: string) => string | undefined): XmlNode[] {
  return nodes.flatMap((n) => {
    if (tagOf(n) !== 'metadata') return [n];
    const { key, value } = attrs(n);
    if (!key || value === undefined || SPECIAL_META.has(key) || key.startsWith('source_')) return [n];
    const next = edit(key, value);
    if (next === undefined) return [];
    return [{ ...n, ':@': { ...attrs(n), value: next } }];
  });
}

const withChildren = (node: XmlNode, kids: XmlNode[]): XmlNode => ({ ...node, [tagOf(node)!]: kids });

export function editModelSettings(text: string, edit: ModelSettingsEdit): string {
  const tree = parseXml(text).map((top) => {
    if (tagOf(top) !== 'config') return top;
    return withChildren(top, childrenOf(top).map((n) => {
      switch (tagOf(n)) {
        case 'object':
          return withChildren(n, editMetadata(childrenOf(n), edit.config).map((k) =>
            tagOf(k) === 'part' ? withChildren(k, editMetadata(childrenOf(k), edit.config)) : k));
        case 'plate':
          return withChildren(n, editMetadata(childrenOf(n), edit.plate));
        default:
          return n;
      }
    }));
  });
  return buildXml(tree);
}
