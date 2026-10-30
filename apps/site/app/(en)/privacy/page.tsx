import type { Metadata } from 'next';
import { Logo } from '@retarget3mf/ui/logo';
import { asset, issuesUrl, LINKS } from '../../../lib/links';
import styles from './privacy.module.css';

export const metadata: Metadata = {
  title: 'Privacy · Retarget3MF',
  description: 'Retarget3MF converts projects on your computer. No account, no analytics, no uploads.',
  alternates: { canonical: '/privacy/' },
};

const UPDATED = '30 October 2026';

export default function Privacy() {
  return (
    <>
      <header className={styles.header}><a href={asset('/')} className={styles.logo}><Logo size={22} /></a></header>
      <main className={styles.main}>
        <p className={styles.eyebrow}>PRIVACY · UPDATED {UPDATED.toUpperCase()}</p>
        <h1 className={styles.title}>Your files stay on your computer.</h1>
        <p className={styles.lead}>
          Retarget3MF has no accounts, no analytics, no tracking and no servers of its own. Projects are converted on your
          device and are never uploaded to us, because there is nowhere to upload them to.
        </p>

        <h2>Web converter (app.retarget3mf.app)</h2>
        <ul>
          <li>Files you open are read and converted inside your browser. The converted file is handed back to you as a download.</li>
          <li>After the page has loaded it makes no network requests; it also works offline.</li>
          <li>Your printer, slicer and theme choices are saved in your browser&apos;s local storage and never leave it.</li>
        </ul>

        <h2>Desktop app</h2>
        <ul>
          <li>Conversion runs on your computer. Settings and the conversion history are stored in the app&apos;s folder on your computer.</li>
          <li>When the browser extension hands over a project, the app downloads it from that model site&apos;s file server (MakerWorld, Printables, Creality Cloud or Snapmaker Space) and nowhere else.</li>
          <li>The installed app checks GitHub Releases for new versions. GitHub sees that request like any other visit.</li>
        </ul>

        <h2>Browser extension</h2>
        <ul>
          <li>It runs only on MakerWorld, Printables, Creality Cloud and Snapmaker Space. There it adds its own menu row and, when you click it, takes the project link the site prepares for its slicer.</li>
          <li>That link goes to the Retarget3MF desktop app on your computer (native messaging). Without the app, the extension downloads the project from the site&apos;s file server and converts it in the browser.</li>
          <li>It saves your printer and slicer choices in the browser&apos;s extension storage.</li>
          <li>Only if you turn it on, it looks at finished downloads to offer converting 3MF files that came from those sites. It does not read other downloads.</li>
          <li>It never collects browsing history, personal data or page contents, and sends nothing to us or anyone else.</li>
        </ul>

        <h2>This website</h2>
        <ul>
          <li>This site and the web converter are hosted on GitHub Pages and reached through Cloudflare. Both process the technical data of each visit (such as your IP address) under their own policies: the <a href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement">GitHub Privacy Statement</a> and the <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare Privacy Policy</a>.</li>
          <li>It uses no cookies, analytics or third-party scripts; fonts are served from this site.</li>
          {LINKS.support && <li>The “Buy me a coffee” link opens Buy Me a Coffee, which has its own privacy policy.</li>}
        </ul>

        <h2>Contact</h2>
        <p>
          Retarget3MF is open source{LINKS.repo && <>, so you can check all of the above in the <a href={LINKS.repo}>source code</a></>}.
          {issuesUrl && <> Questions about privacy: <a href={issuesUrl}>open an issue on GitHub</a>.</>}
        </p>
      </main>
    </>
  );
}
