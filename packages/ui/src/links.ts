/** External links. Leave one empty and everything that depends on it stays hidden or shows "coming soon". */
export const LINKS = {
  /** GitHub repository, e.g. https://github.com/owner/retarget3mf */
  repo: '',
  /** Buy Me a Coffee (or similar) page. */
  support: '',
  /** The extension's store pages. */
  chromeStore: '',
  firefoxAddons: '',
};

export const releasesUrl = LINKS.repo ? `${LINKS.repo}/releases/latest` : '';
export const issuesUrl = LINKS.repo ? `${LINKS.repo}/issues/new` : '';
export const releaseNotesUrl = LINKS.repo ? `${LINKS.repo}/releases` : '';
export const licenseUrl = LINKS.repo ? `${LINKS.repo}/blob/main/LICENSE` : '';
