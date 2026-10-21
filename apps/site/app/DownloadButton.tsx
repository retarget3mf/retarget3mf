'use client';
import { useEffect, useState } from 'react';
import { releasesUrl } from '../lib/links';
import styles from './page.module.css';

type Os = 'macOS' | 'Windows' | 'Linux';

function detectOs(ua: string): Os | undefined {
  if (/Mac/i.test(ua)) return 'macOS';
  if (/Win/i.test(ua)) return 'Windows';
  if (/Linux|X11/i.test(ua)) return 'Linux';
  return undefined;
}

/** Names the visitor's platform once it is known; one universal link to the latest release either way. */
export function DownloadButton() {
  const [os, setOs] = useState<Os>();
  useEffect(() => setOs(detectOs(navigator.userAgent)), []);
  const label = os ? `Download for ${os}` : 'Download the app';
  if (!releasesUrl) return <span className={`${styles.primary} ${styles.soon}`} aria-disabled="true">{label} · coming soon</span>;
  return <a className={styles.primary} href={releasesUrl}>{label}</a>;
}
