import type { SourceSite } from '@retarget3mf/bridge';

/** Per-site knowledge (verified on each site on 2026-10-20). Matched by visible text, not generated class names. */
export interface SiteAdapter {
  id: SourceSite;
  hosts: string[];
  /** The site's own "open in its slicer" control, which hands over a signed project link. */
  slicerText: string;
  /** Texts of the rows in the site's download menu, used to recognise that menu. */
  menuTexts: string[];
  /** Confirm button of the site's first-time "import into <slicer>" dialog, if it has one. */
  importText?: string;
  slicerName: string;
}

export const SITES: SiteAdapter[] = [
  {
    id: 'makerworld', hosts: ['makerworld.com'], slicerName: 'Bambu Studio',
    slicerText: 'Open in Bambu Studio', menuTexts: ['Open in Bambu Studio', 'Download 3MF', 'Download STL/CAD Files'],
    importText: 'Import into Bambu Studio',
  },
  {
    id: 'crealitycloud', hosts: ['www.crealitycloud.com', 'crealitycloud.com'], slicerName: 'Creality Print',
    slicerText: 'Open in Creality Print', menuTexts: ['Open in Creality Print', 'Download 3MF', 'View STL/CAD Files'],
  },
  {
    id: 'snapmaker', hosts: ['space.snapmaker.com'], slicerName: 'Snapmaker Orca',
    slicerText: 'Open in Snapmaker Orca', menuTexts: ['Open in Snapmaker Orca', 'Download 3MF'],
  },
];

export const MARKER = 'data-retarget3mf';

export const siteFor = (hostname: string) => SITES.find((s) => s.hosts.includes(hostname));

/** Visible elements whose own text is `text` (the innermost such element; icons alongside the text are allowed). */
function textElements(root: ParentNode, text: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('div, span, button, a, li')].filter((el) =>
    el.textContent?.trim() === text && el.getClientRects().length > 0 && ![...el.children].some((c) => c.textContent?.trim() === text));
}

/** The site's slicer control: a main button or a row of the open menu. */
export function findSlicerTarget(root: ParentNode, site: SiteAdapter): HTMLElement | undefined {
  return textElements(root, site.slicerText)[0];
}

/** The open download menu: the container holding at least two of the site's menu rows. */
export function findMenu(root: ParentNode, site: SiteAdapter): { rows: HTMLElement[]; slicerRow?: HTMLElement } | undefined {
  const rows = site.menuTexts.flatMap((t) => textElements(root, t)).map(rowOf);
  const byParent = new Map<Element, HTMLElement[]>();
  for (const row of rows) if (row.parentElement) byParent.set(row.parentElement, [...(byParent.get(row.parentElement) ?? []), row]);
  const menuRows = [...byParent.values()].filter((r) => r.length >= 2).sort((a, b) => b.length - a.length)[0];
  if (!menuRows) return undefined;
  const slicerRow = menuRows.find((r) => r.textContent?.trim() === site.slicerText);
  return { rows: menuRows, ...(slicerRow && { slicerRow }) };
}

/** The menu row containing `el`: its ancestor whose parent holds several rows. */
function rowOf(el: HTMLElement): HTMLElement {
  let row = el;
  while (row.parentElement && row.parentElement.childElementCount < 2) row = row.parentElement;
  return row;
}

export function findImportButton(root: ParentNode, site: SiteAdapter): HTMLElement | undefined {
  return site.importText ? textElements(root, site.importText).at(-1) : undefined;
}
