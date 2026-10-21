import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PRINTERS } from '@retarget3mf/profiles/printers';
import { ENABLED_LOCALES, type Locale } from '@retarget3mf/ui/plural';
import '@retarget3mf/ui/tokens.css';
import '../app/globals.css';
import { geist, geistMono } from '../app/fonts';
import { Landing } from '../app/landing/Landing';
import { LANDING_MESSAGES } from '../app/landing/messages';
import { asset } from './links';
import { localePath } from './paths';
import { SITE_NAME, SITE_URL } from './site';

const OG_LOCALES: Record<Locale, string> = { en: 'en_US', pl: 'pl_PL' };

export function metadataFor(locale: Locale): Metadata {
  const { title, description } = LANDING_MESSAGES[locale].meta;
  return {
    ...(SITE_URL && {
      metadataBase: new URL(`${SITE_URL}/`),
      alternates: {
        canonical: localePath(locale),
        languages: { ...Object.fromEntries(ENABLED_LOCALES.map((l) => [l, localePath(l)])), 'x-default': '/' },
      },
    }),
    title,
    description,
    applicationName: SITE_NAME,
    keywords: ['3MF', '3MF converter', 'MakerWorld', 'Printables', 'Creality Cloud', 'Snapmaker Space', 'Bambu Studio', 'OrcaSlicer', 'PrusaSlicer', 'Flashforge', 'Prusa', 'Creality', 'Elegoo', 'Anycubic', 'Qidi', 'Sovol', 'multi-colour', 'AMS', '3D printing'],
    icons: { icon: asset('/favicon.svg') },
    openGraph: {
      type: 'website', siteName: SITE_NAME, title, description, locale: OG_LOCALES[locale],
      images: [{ url: asset('/og.png'), width: 1200, height: 630, alt: LANDING_MESSAGES.en.meta.title }],
      ...(SITE_URL && { url: localePath(locale) }),
    },
    twitter: { card: 'summary_large_image', title, description, images: [asset('/og.png')] },
    // Pages in languages not yet offered are built for review only.
    robots: { index: ENABLED_LOCALES.includes(locale), follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f4f4f2' }, { media: '(prefers-color-scheme: dark)', color: '#121314' }],
};

/**
 * Runs before the first paint: applies the saved colour mode, and on the English root page moves a visitor whose
 * saved (or, without a saved one, browser) language is another one to that language's page.
 */
function bootScript(locale: Locale): string {
  const base = JSON.stringify(asset(''));
  const others = JSON.stringify(ENABLED_LOCALES.filter((l) => l !== 'en'));
  return `try{var d=document.documentElement,t=localStorage.getItem('retarget3mf.theme');if(t==='light'||t==='dark')d.dataset.theme=t;`
    + (locale === 'en'
      ? `var s=localStorage.getItem('retarget3mf.locale'),l=s||((navigator.languages||[]).map(function(x){return x.slice(0,2).toLowerCase()}).filter(function(x){return x==='en'||${others}.indexOf(x)>=0})[0]);`
        + `if(${others}.indexOf(l)>=0)location.replace(${base}+'/'+l+'/'+location.hash)`
      : '')
    + `}catch(e){}`;
}

export function Document({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={locale} className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Inline on purpose: it must run before anything paints, and it only reads this site's own localStorage. */}
        <script dangerouslySetInnerHTML={{ __html: bootScript(locale) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

/** Structured data: the app itself, and the FAQ in the page's language. */
function jsonLd(locale: Locale) {
  const t = LANDING_MESSAGES[locale];
  return [
    {
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: SITE_NAME, description: t.meta.description, inLanguage: locale,
      applicationCategory: 'DesignApplication', operatingSystem: 'Web, macOS, Windows, Linux',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, license: 'https://www.gnu.org/licenses/agpl-3.0.html',
      featureList: `Converts 3MF projects for ${PRINTERS.length} printers`,
      ...(SITE_URL && { url: `${SITE_URL}${localePath(locale)}` }),
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: locale, mainEntity: t.faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ];
}

export function LandingPage({ locale }: { locale: Locale }) {
  return (
    <>
      {/* Static JSON from our own constants; escaping "<" keeps it from closing the script element. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(locale)).replace(/</g, '\\u003c') }} />
      <Landing locale={locale} />
    </>
  );
}
