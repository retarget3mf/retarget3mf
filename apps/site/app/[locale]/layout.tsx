import type { ReactNode } from 'react';
import { LOCALES, type Locale } from '@retarget3mf/ui/plural';
import { Document, metadataFor, viewport } from '../../lib/document';

// Only the prerendered languages exist (dynamicParams is off), so the segment is always a Locale.
type Params = { params: Promise<{ locale: string }> };
const localeOf = async ({ params }: Params) => (await params).locale as Locale;

export const dynamicParams = false;
export const generateStaticParams = () => LOCALES.filter((l) => l !== 'en').map((locale) => ({ locale }));
export const generateMetadata = async (props: Params) => metadataFor(await localeOf(props));
export { viewport };

export default async function LocaleLayout({ children, ...props }: Params & { children: ReactNode }) {
  return <Document locale={await localeOf(props)}>{children}</Document>;
}
