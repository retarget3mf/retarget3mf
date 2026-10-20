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
  /** For menus shared by every file of a model: whether the control that opened it belongs to a 3MF project. */
  isProjectMenu?: (opener: Element) => boolean;
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
  {
    // Each file row has its own "Slice" menu, mounted outside the row; the row's badge names the file type.
    id: 'printables', hosts: ['www.printables.com', 'printables.com'], slicerName: 'PrusaSlicer',
    slicerText: 'Open in PrusaSlicer', menuTexts: ['Open in PrusaSlicer', 'Open in OrcaSlicer', 'Open in Bambu Studio'],
    importText: 'Open file in PrusaSlicer',
    isProjectMenu: (opener) => opener.closest('.download-item')?.querySelector('.badge')?.textContent?.trim().toLowerCase() === '3mf',
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

/**
 * The open download menu: the smallest element holding at least two of the site's menu texts; its children are the
 * rows. A row may wrap its text with icons (MakerWorld's "Download STL/CAD Files" ⓘ), but holds no other text, which
 * keeps page sections that merely contain two of the texts from passing as a menu.
 */
export function findMenu(root: ParentNode, site: SiteAdapter): { rows: HTMLElement[]; slicerRow?: HTMLElement } | undefined {
  const texts = site.menuTexts.flatMap((t) => textElements(root, t));
  let menu: HTMLElement | undefined;
  for (const text of texts) {
    let box = text.parentElement;
    while (box && texts.filter((t) => box!.contains(t)).length < 2) box = box.parentElement;
    if (box && (!menu || menu.contains(box))) menu = box;
  }
  if (!menu) return undefined;
  const rows = [...menu.children].filter((c): c is HTMLElement => texts.some((t) => c.contains(t)));
  if (rows.length < 2 || rows.some((r) => !site.menuTexts.includes(r.textContent?.trim() ?? ''))) return undefined;
  const slicerRow = rows.find((r) => r.textContent?.trim() === site.slicerText);
  return { rows, ...(slicerRow && { slicerRow }) };
}

export function findImportButton(root: ParentNode, site: SiteAdapter): HTMLElement | undefined {
  return site.importText ? textElements(root, site.importText).at(-1) : undefined;
}
