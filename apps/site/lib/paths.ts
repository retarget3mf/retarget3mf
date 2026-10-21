import type { Locale } from '@retarget3mf/ui/plural';

/** Path of the landing page in a language: English at the root, the others in their own folder. */
export const localePath = (locale: Locale) => (locale === 'en' ? '/' : `/${locale}/`);
