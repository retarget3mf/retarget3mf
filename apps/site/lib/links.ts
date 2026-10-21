/** External links. Leave one empty and everything that depends on it stays hidden or shows "coming soon". */
export const LINKS = {
  /** GitHub repository, e.g. https://github.com/owner/retarget3mf */
  repo: '',
  /** Buy Me a Coffee (or similar) page. */
  support: '',
};

export const releasesUrl = LINKS.repo ? `${LINKS.repo}/releases/latest` : '';
export const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;
