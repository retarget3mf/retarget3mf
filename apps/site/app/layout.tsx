import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@retarget3mf/ui/tokens.css';
import './globals.css';
import { DESCRIPTION, SITE_NAME, SITE_URL, TITLE } from '../lib/site';
import { geist, geistMono } from './fonts';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  ...(SITE_URL && { metadataBase: new URL(`${SITE_URL}/`), alternates: { canonical: '/' } }),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['3MF', '3MF converter', 'MakerWorld', 'Printables', 'Creality Cloud', 'Snapmaker Space', 'Bambu Studio', 'OrcaSlicer', 'PrusaSlicer', 'Flashforge', 'Prusa', 'Creality', 'Elegoo', 'Anycubic', 'Qidi', 'Sovol', 'multi-colour', 'AMS', '3D printing'],
  icons: { icon: `${basePath}/favicon.svg` },
  openGraph: { type: 'website', siteName: SITE_NAME, title: TITLE, description: DESCRIPTION, locale: 'en_US', ...(SITE_URL && { url: '/' }) },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f4f4f2' }, { media: '(prefers-color-scheme: dark)', color: '#121314' }],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
