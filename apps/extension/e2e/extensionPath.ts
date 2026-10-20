import { resolve } from 'node:path';

/** The build the e2e tests load: a separate folder, so test runs never rewrite the copy loaded in a real browser. */
export const EXTENSION = resolve(import.meta.dirname, '../.e2e-dist/chrome-mv3');
