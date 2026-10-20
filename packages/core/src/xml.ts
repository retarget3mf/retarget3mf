import { XMLBuilder, XMLParser } from 'fast-xml-parser';

// preserveOrder keeps element order, unknown elements and attributes intact for round-trips.
const OPTIONS = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
  suppressEmptyNode: true,
  // Attribute text passes through raw: the parser leaves &#NN; references undecoded but the builder would re-escape them.
  processEntities: false,
} as const;

export interface XmlNode {
  [tag: string]: XmlNode[] | Record<string, string> | string | undefined;
  ':@'?: Record<string, string>;
}

export function parseXml(text: string): XmlNode[] {
  return new XMLParser(OPTIONS).parse(text) as XmlNode[];
}

export function buildXml(nodes: XmlNode[]): string {
  return new XMLBuilder({ ...OPTIONS, format: false }).build(nodes) as string;
}

export function tagOf(node: XmlNode): string | undefined {
  return Object.keys(node).find((k) => k !== ':@');
}

export function childrenOf(node: XmlNode): XmlNode[] {
  const tag = tagOf(node);
  const kids = tag ? node[tag] : undefined;
  return Array.isArray(kids) ? kids : [];
}

export function attrs(node: XmlNode): Record<string, string> {
  return node[':@'] ?? {};
}

export function elements(nodes: XmlNode[], tag: string): XmlNode[] {
  return nodes.filter((n) => tagOf(n) === tag);
}
