import type { Metadata } from 'next';
import { Logo } from '@retarget3mf/ui/logo';
import { Document, viewport } from '../lib/document';
import { appHref, asset } from '../lib/links';
import styles from './not-found.module.css';

export const metadata: Metadata = {
  title: 'Page not found · Retarget3MF',
  description: 'This page does not exist. Open the Retarget3MF converter or go to the home page.',
  robots: { index: false, follow: true },
};
export { viewport };

/** One plate, one empty slot: the 404 in the site's own picture language. */
const SLOTS = ['#1D1D1F', '#D8352A', '#F2F2EE'];

export default function GlobalNotFound() {
  return (
    <Document locale="en" redirect={false}>
      <header className={styles.header}><a href={asset('/')} className={styles.logo}><Logo size={22} /></a></header>
      <main className={styles.main}>
        <div className={styles.slots} aria-hidden>
          {SLOTS.map((c) => <span key={c} style={{ background: c }} />)}
          <span className={styles.empty}>?</span>
        </div>
        <p className={styles.eyebrow}>404 · PAGE NOT FOUND</p>
        <h1 className={styles.title}>This page isn’t on the plate.</h1>
        <p className={styles.text}>The link may be old or mistyped. The converter and everything else are still where they were.</p>
        <div className={styles.actions}>
          <a className={styles.primary} href={appHref()}>Open the converter →</a>
          <a className={styles.secondary} href={asset('/')}>Go to the home page</a>
        </div>
      </main>
    </Document>
  );
}
