/** External links. Leave one empty and everything that depends on it stays hidden or shows "coming soon". */
export const LINKS = {
  /** Landing page. */
  site: 'https://retarget3mf.app/',
  /** GitHub repository, e.g. https://github.com/owner/retarget3mf */
  repo: 'https://github.com/retarget3mf/retarget3mf',
  /** Buy Me a Coffee (or similar) page. */
  support: 'https://buymeacoffee.com/retarget3mf',
  /** Privacy policy page (store listings need one). */
  privacy: 'https://retarget3mf.app/privacy/',
  /** The extension's store pages. */
  chromeStore: 'https://chromewebstore.google.com/detail/linjkofcpahliajjmcmemfofemaecjmp',
  firefoxAddons: 'https://addons.mozilla.org/firefox/addon/retarget3mf/',
};

export const releasesUrl = LINKS.repo ? `${LINKS.repo}/releases/latest` : '';
export const issuesUrl = LINKS.repo ? `${LINKS.repo}/issues/new` : '';
export const releaseNotesUrl = LINKS.repo ? `${LINKS.repo}/releases` : '';
export const licenseUrl = LINKS.repo ? `${LINKS.repo}/blob/main/LICENSE` : '';
