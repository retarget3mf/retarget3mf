import { DOWNLOAD_HOST_PATTERNS, FIREFOX_EXTENSION_ID } from '@retarget3mf/bridge';
import { defineConfig } from 'wxt';

const SITES = ['https://makerworld.com/*', 'https://www.crealitycloud.com/*', 'https://crealitycloud.com/*', 'https://space.snapmaker.com/*', 'https://www.printables.com/*', 'https://printables.com/*'];

export default defineConfig({
  // Visible folder: macOS file pickers hide ".output", which is what Chrome's "Load unpacked" needs.
  outDir: 'dist',
  manifest: ({ browser }) => ({
    name: 'Retarget3MF',
    description: 'Adds "Open for your printer" to MakerWorld, Printables, Creality Cloud and Snapmaker Space: converts the project locally and opens it in your slicer.',
    // Fixed IDs that the desktop app's native messaging manifests allow (packages/bridge EXTENSION_IDS, FIREFOX_EXTENSION_ID).
    ...(browser === 'firefox'
      ? { browser_specific_settings: { gecko: { id: FIREFOX_EXTENSION_ID, strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } } } }
      : { key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt82dVqMhVpc/9pWH+auvW0CMfvtChi/kMn5zPsc1Bh44fP2sCtUPvZARGZ1W1K5mVjZxsca9Pk0CLXjE/Hj288RNGHOYTlEymFFbbLducPT7BhskNmsgsJUct+sT1ayWRbXEuj4hnQUVZgpS4GmoWc9y2D62LOZoQUjYqWF3B11C5roDMSvA2rEjsgaj9Ofhkc+x1aT6c/ylUClxJLVqhFAS7LuvJ7mU+Py8QHgKwEvXJKD5GAlP8b8DmkUiR9TPbF1MUN7AWHPbg2o3NVquMQfCwBiLdHdHJR/OfdrKNutwAgWP9T1i3Z+Gz9dSWnfXCBgFWmQIyRHnSMiNdznBHQIDAQAB' }),
    permissions: ['nativeMessaging', 'storage'],
    // Model CDNs: the in-browser converter page downloads projects itself.
    host_permissions: [...SITES, ...DOWNLOAD_HOST_PATTERNS],
    web_accessible_resources: [{ resources: ['page-hook.js'], matches: SITES }],
  }),
});
