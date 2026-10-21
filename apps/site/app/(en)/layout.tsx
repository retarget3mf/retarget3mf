import type { ReactNode } from 'react';
import { Document, metadataFor, viewport } from '../../lib/document';

export const metadata = metadataFor('en');
export { viewport };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <Document locale="en">{children}</Document>;
}
