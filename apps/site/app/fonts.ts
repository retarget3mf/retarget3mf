import localFont from 'next/font/local';

// Preloaded Latin Geist with a size-matched fallback, so the text does not jump when it arrives. Other scripts
// (e.g. Cyrillic) still come from the shared stylesheet's Geist faces, listed next in --font-sans.
export const geist = localFont({
  src: '../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-geist',
  fallback: ['system-ui', 'Arial'],
});

export const geistMono = localFont({
  src: '../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-geist-mono',
  fallback: ['ui-monospace', 'Menlo', 'Courier New'],
});
