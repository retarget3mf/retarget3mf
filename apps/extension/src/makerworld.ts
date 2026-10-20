/** MakerWorld adapter (verified against makerworld.com on 2026-10-20, logged out and logged in). */

export const STUDIO_TEXT = 'Open in Bambu Studio';
export const MARKER = 'data-retarget3mf';
const MENU_TEXTS = [STUDIO_TEXT, 'Download 3MF', 'Download STL/CAD Files'];

const leaves = (root: ParentNode, text: string) =>
  [...root.querySelectorAll<HTMLElement>('div, span, button, a')]
    .filter((el) => el.childElementCount === 0 && el.textContent?.trim() === text && el.getClientRects().length > 0);

/** A visible "Open in Bambu Studio" control: the main green button (logged out) or a menu row (logged in). */
export function findStudioTarget(root: ParentNode): HTMLElement | undefined {
  return leaves(root, STUDIO_TEXT)[0];
}

/**
 * The open download-options menu (a MUI popper) and the rows we can sit next to. Matched by visible text, not the
 * generated class names, which change with each site build.
 */
export function findMenu(root: ParentNode): { rows: HTMLElement[]; studioRow?: HTMLElement } | undefined {
  for (const popper of root.querySelectorAll<HTMLElement>('.MuiPopper-root, [role="tooltip"]')) {
    const rows = MENU_TEXTS.flatMap((t) => leaves(popper, t)).map((leaf) => rowOf(leaf, popper));
    if (rows.length === 0) continue;
    const studioRow = rows.find((r) => r.textContent?.trim() === STUDIO_TEXT);
    return { rows, ...(studioRow && { studioRow }) };
  }
  return undefined;
}

/** The menu row containing `leaf`: the ancestor whose parent holds several rows. */
function rowOf(leaf: HTMLElement, popper: HTMLElement): HTMLElement {
  let row = leaf;
  while (row.parentElement && row.parentElement !== popper && row.parentElement.childElementCount < 2) row = row.parentElement;
  return row;
}

export const IMPORT_TEXT = 'Import into Bambu Studio';

/**
 * The confirm button of MakerWorld's "Import into Bambu Studio" dialog (shown before the first hand-off). The dialog
 * title has the same text, so the last visible match is the button.
 */
export function findImportButton(root: ParentNode): HTMLElement | undefined {
  return leaves(root, IMPORT_TEXT).at(-1);
}
