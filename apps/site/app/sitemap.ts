import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/site';

export const dynamic = 'force-static';

/** The landing page and the web converter; a sitemap needs absolute URLs, so local builds list none. */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!SITE_URL) return [];
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/app/`, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
