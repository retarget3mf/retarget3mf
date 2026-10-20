/** MakerWorld adapter (verified against makerworld.com on 2026-10-20). */

export const STUDIO_BUTTON_TEXT = 'Open in Bambu Studio';
export const MARKER = 'data-retarget3mf';

/**
 * MakerWorld's own "Open in Bambu Studio" buttons. Matched by visible text, not generated class names, which change
 * with each site build. Returns the clickable container (the element React attached the handler to, or an ancestor).
 */
export function findStudioButtons(root: ParentNode): HTMLElement[] {
  const leaves = [...root.querySelectorAll<HTMLElement>('span, div, button, a')]
    .filter((el) => el.childElementCount === 0 && el.textContent?.trim() === STUDIO_BUTTON_TEXT);
  return leaves.map((leaf) => (leaf.closest<HTMLElement>('.primaryButton, button, [role="button"]') ?? leaf.parentElement ?? leaf));
}

/** MakerWorld renders the button twice (sticky header + panel); only visible ones get our button. */
export const isVisible = (el: HTMLElement) => el.getClientRects().length > 0;
