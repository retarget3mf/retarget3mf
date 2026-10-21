import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';

const basePath = process.env.PAGES_BASE_PATH ?? '';

const config = (phase: string): NextConfig => ({
  // Plain files for GitHub Pages; the web app is deployed next to the site at app/. Builds only: with it, `next dev`
  // throws on paths outside the prerendered languages (e.g. /app/) instead of showing the 404 page.
  ...(phase === PHASE_PRODUCTION_BUILD && { output: 'export' as const }),
  // A project site lives under /<repo>/; the Pages workflow passes that path.
  basePath,
  // Plain <img> paths need the prefix too.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@retarget3mf/ui', '@retarget3mf/profiles'],
  // One small page: inlined CSS saves the render-blocking stylesheet requests.
  experimental: { inlineCss: true, optimizePackageImports: ['@retarget3mf/ui'], globalNotFound: true },
});

export default config;
