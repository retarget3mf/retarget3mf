import { DOWNLOAD_HOST_PATTERNS, FIREFOX_EXTENSION_ID } from '@retarget3mf/bridge';
import { defineConfig } from 'wxt';

const SITES = ['https://makerworld.com/*', 'https://www.crealitycloud.com/*', 'https://crealitycloud.com/*', 'https://space.snapmaker.com/*', 'https://www.printables.com/*', 'https://printables.com/*'];

const STORE = process.env.STORE_BUILD === '1';

export default defineConfig({
  // The popup is React (shared with the landing page's preview); esbuild compiles its JSX.
  vite: () => ({ esbuild: { jsx: 'automatic' } }),
  // Visible folder: macOS file pickers hide ".output", which is what Chrome's "Load unpacked" needs.
  // e2e runs build elsewhere (WXT_OUT_DIR), so tests never rewrite the copy loaded in a browser.
  outDir: process.env.WXT_OUT_DIR ?? 'dist',
  // STORE_BUILD=1: the Chrome Web Store rejects a manifest `key` and assigns its own ID (add it to EXTENSION_IDS).
  zip: {
    artifactTemplate: `retarget3mf-{{version}}-{{browser}}${STORE ? '-store' : ''}.zip`,
    sourcesTemplate: 'retarget3mf-{{version}}-sources.zip',
  },
  manifest: ({ browser }) => ({
    name: 'Retarget3MF',
    description: 'Adds "Open for your printer" to MakerWorld, Printables, Creality Cloud and Snapmaker Space: converts the project locally and opens it in your slicer.',
    // Fixed IDs that the desktop app's native messaging manifests allow (packages/bridge EXTENSION_IDS, FIREFOX_EXTENSION_ID).
    ...(browser === 'firefox'
      ? { browser_specific_settings: { gecko: { id: FIREFOX_EXTENSION_ID, strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } } } }
      : STORE ? {} : { key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt82dVqMhVpc/9pWH+auvW0CMfvtChi/kMn5zPsc1Bh44fP2sCtUPvZARGZ1W1K5mVjZxsca9Pk0CLXjE/Hj288RNGHOYTlEymFFbbLducPT7BhskNmsgsJUct+sT1ayWRbXEuj4hnQUVZgpS4GmoWc9y2D62LOZoQUjYqWF3B11C5roDMSvA2rEjsgaj9Ofhkc+x1aT6c/ylUClxJLVqhFAS7LuvJ7mU+Py8QHgKwEvXJKD5GAlP8b8DmkUiR9TPbF1MUN7AWHPbg2o3NVquMQfCwBiLdHdHJR/OfdrKNutwAgWP9T1i3Z+Gz9dSWnfXCBgFWmQIyRHnSMiNdznBHQIDAQAB' }),
    // Toolbar sizes (1x/2x of 16 and 19); manifest.icons come from public/icon automatically.
    action: { default_icon: { 16: 'icon/16.png', 19: 'icon/19.png', 32: 'icon/32.png', 38: 'icon/38.png' } },
    permissions: ['nativeMessaging', 'storage'],
    // Passive mode, requested from the popup only when the user turns it on.
    optional_permissions: ['downloads', 'notifications'],
    // Model CDNs: the in-browser converter page downloads projects itself.
    host_permissions: [...SITES, ...DOWNLOAD_HOST_PATTERNS],
    web_accessible_resources: [{ resources: ['page-hook.js'], matches: SITES }],
  }),
});
