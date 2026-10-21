/** Where the site is published, e.g. https://owner.github.io/retarget3mf (the Pages workflow passes it); empty in local builds. */
export const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/$/, '');

export const SITE_NAME = 'Retarget3MF';
export const TITLE = 'Retarget3MF: convert 3MF projects for your 3D printer';
export const DESCRIPTION = 'Convert MakerWorld, Printables, Creality Cloud and Snapmaker Space 3MF projects for your printer: Bambu Lab, Prusa, Creality, Flashforge, Elegoo, Anycubic, Qidi or Sovol. Keeps the author\'s settings, fits the colours to your slots and opens your slicer. Free, open source, runs in your browser.';
