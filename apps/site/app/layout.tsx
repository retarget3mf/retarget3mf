import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@retarget3mf/ui/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Retarget3MF: print any 3MF project on your printer',
  description: 'Converts MakerWorld, Printables, Creality Cloud and Snapmaker Space projects for your Flashforge or Bambu Lab printer, keeps the author\'s settings and opens your slicer. Free, open source, runs locally.',
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/favicon.svg` },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
