import type { NextConfig } from 'next';

const basePath = process.env.PAGES_BASE_PATH ?? '';

const config: NextConfig = {
  // Plain files for GitHub Pages; the web app is deployed next to the site at app/.
  output: 'export',
  // A project site lives under /<repo>/; the Pages workflow passes that path.
  basePath,
  // Plain <img> paths need the prefix too.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@retarget3mf/ui', '@retarget3mf/profiles'],
  // One small page: inlined CSS saves the render-blocking stylesheet requests.
  experimental: { inlineCss: true, optimizePackageImports: ['@retarget3mf/ui'] },
};

export default config;
