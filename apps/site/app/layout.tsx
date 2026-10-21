import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@retarget3mf/ui/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Retarget3MF: print any 3MF project on your printer',
  description: 'Converts MakerWorld, Printables, Creality Cloud and Snapmaker Space 3MF projects for your printer, keeps the author\'s settings and fits the colours to your slots. Free, open source, runs in your browser.',
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/favicon.svg` },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
