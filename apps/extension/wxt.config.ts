import { defineConfig } from 'wxt';

const SITES = ['https://makerworld.com/*', 'https://www.crealitycloud.com/*', 'https://crealitycloud.com/*', 'https://space.snapmaker.com/*'];

export default defineConfig({
  // Visible folder: macOS file pickers hide ".output", which is what Chrome's "Load unpacked" needs.
  outDir: 'dist',
  manifest: {
    name: 'Retarget3MF',
    description: 'Adds "Open for your printer" to MakerWorld, Creality Cloud and Snapmaker Space: converts the project locally and opens it in your slicer.',
    // Pins the extension ID that the desktop app's native messaging manifest allows (packages/bridge EXTENSION_IDS).
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt82dVqMhVpc/9pWH+auvW0CMfvtChi/kMn5zPsc1Bh44fP2sCtUPvZARGZ1W1K5mVjZxsca9Pk0CLXjE/Hj288RNGHOYTlEymFFbbLducPT7BhskNmsgsJUct+sT1ayWRbXEuj4hnQUVZgpS4GmoWc9y2D62LOZoQUjYqWF3B11C5roDMSvA2rEjsgaj9Ofhkc+x1aT6c/ylUClxJLVqhFAS7LuvJ7mU+Py8QHgKwEvXJKD5GAlP8b8DmkUiR9TPbF1MUN7AWHPbg2o3NVquMQfCwBiLdHdHJR/OfdrKNutwAgWP9T1i3Z+Gz9dSWnfXCBgFWmQIyRHnSMiNdznBHQIDAQAB',
    permissions: ['nativeMessaging', 'storage'],
    host_permissions: SITES,
    web_accessible_resources: [{ resources: ['page-hook.js'], matches: SITES }],
  },
});
