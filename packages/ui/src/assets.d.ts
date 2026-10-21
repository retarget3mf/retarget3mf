declare module '*.svg' {
  /** Vite gives a URL string; Next.js a static image object. */
  const asset: string | { src: string };
  export default asset;
}
