import type { MetadataRoute } from 'next';
import { ENABLED_LOCALES } from '@retarget3mf/ui/plural';
import { localePath } from '../lib/paths';
import { APP_URL } from '../lib/links';
import { SITE_URL } from '../lib/site';

export const dynamic = 'force-static';

/** The landing page and the web converter; a sitemap needs absolute URLs, so local builds list none. */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!SITE_URL) return [];
  const languages = Object.fromEntries(ENABLED_LOCALES.map((l) => [l, `${SITE_URL}${localePath(l)}`]));
  return [
    ...ENABLED_LOCALES.map((l) => ({ url: `${SITE_URL}${localePath(l)}`, changeFrequency: 'weekly' as const, priority: l === 'en' ? 1 : 0.9, alternates: { languages } })),
    // A sitemap lists only its own host; a converter on its own subdomain is linked from the page instead.
    ...(APP_URL ? [] : [{ url: `${SITE_URL}/app/`, changeFrequency: 'monthly' as const, priority: 0.8 }]),
  ];
}
