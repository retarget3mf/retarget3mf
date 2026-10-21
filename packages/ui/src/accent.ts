export const ACCENTS = ['lime', 'mint', 'magenta', 'violet', 'yellow', 'amber', 'mono'] as const;
export type Accent = (typeof ACCENTS)[number];

/** Lime is the stylesheet's default, so it clears the attribute. */
export function applyAccent(accent: Accent): void {
  if (accent === 'lime') delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
}
