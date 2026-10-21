'use client';
import { useEffect, useState } from 'react';
import { PRINTERS } from '@retarget3mf/profiles/printers';
import {
  applyTheme, CoffeeIcon, ENABLED_LOCALES, GitHubIcon, I18nProvider, LOCALE_NAMES, Logo, stored, ThemeButton, useT, type Locale, type Theme,
} from '@retarget3mf/ui';
import { issuesUrl, LINKS, releaseNotesUrl } from '@retarget3mf/ui/links';
import { asset } from '../../lib/links';
import { localePath } from '../../lib/paths';
import { LANDING_MESSAGES } from './messages';
import { PlateDemo } from './PlateDemo';
import { BRANDS, Download, Extension, Faq, HowItWorks, Printers } from './Sections';
import styles from './landing.module.css';

const SITES = ['MakerWorld', 'Printables', 'Creality Cloud', 'Snapmaker Space'];
const name = (id: string) => PRINTERS.find((p) => p.id === id)!.displayName;

/** Each language is its own prerendered page; switching language goes to that page and remembers the choice. */
export function Landing({ locale }: { locale: Locale }) {
  // The boot script already applied the saved mode before paint; this only keeps the button in sync.
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => setTheme((stored.get('theme') as Theme | undefined) ?? 'system'), []);
  useEffect(() => applyTheme(theme), [theme]);
  return (
    <I18nProvider locale={locale}>
      <Page
        locale={locale}
        onLocale={(l) => { stored.set('locale', l); location.href = `${asset(localePath(l))}${location.hash}`; }}
        theme={theme}
        onTheme={(th) => { stored.set('theme', th); setTheme(th); }}
      />
    </I18nProvider>
  );
}

interface PageProps { locale: Locale; onLocale: (l: Locale) => void; theme: Theme; onTheme: (t: Theme) => void }

function LanguageSelect({ locale, onLocale, className }: Pick<PageProps, 'locale' | 'onLocale'> & { className?: string | undefined }) {
  const t = useT(LANDING_MESSAGES).nav;
  if (ENABLED_LOCALES.length < 2) return null;
  return (
    <select className={className} value={locale} aria-label={t.language} onChange={(e) => onLocale(e.target.value as Locale)}>
      {ENABLED_LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
    </select>
  );
}

function Page({ locale, onLocale, theme, onTheme }: PageProps) {
  const t = useT(LANDING_MESSAGES);
  const [menu, setMenu] = useState(false);
  const app = asset('/app/');
  const links = [['#how', t.nav.how], ['#printers', t.nav.printers], ['#extension', t.nav.extension], ['#download', t.nav.download], ['#faq', t.nav.faq]] as const;
  return (
    <>
      <header className={styles.header}>
        <div className={`${styles.wrap} ${styles.headerRow}`}>
          <a href="#top" className={styles.logo}><Logo size={22} /></a>
          <nav className={styles.links} aria-label={t.nav.menu}>{links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
          <span className={styles.grow} />
          <div className={styles.tools}>
            <LanguageSelect className={`${styles.language} ${styles.wide}`} locale={locale} onLocale={onLocale} />
            {LINKS.support && <a className={`${styles.coffee} ${styles.wide}`} href={LINKS.support} target="_blank" rel="noreferrer"><CoffeeIcon />{t.nav.coffee}</a>}
            {LINKS.repo && <a className={styles.square} href={LINKS.repo} target="_blank" rel="noreferrer" aria-label={t.nav.github} title={t.nav.github}><GitHubIcon /></a>}
            <ThemeButton className={styles.square} value={theme} onChange={onTheme} />
            <button type="button" className={`${styles.menuButton} ${styles.narrow}`} aria-label={t.nav.menu} aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
          <a className={`${styles.primarySmall} ${styles.wide}`} href={app}>{t.nav.open}</a>
        </div>
        {menu && (
          <nav className={styles.mobileMenu} aria-label={t.nav.menu} onClick={() => setMenu(false)}>
            {links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
            <a className={styles.primarySmall} href={app}>{t.nav.open}</a>
          </nav>
        )}
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={styles.wrap}>
            <div className={styles.heroText}>
              <p className={`${styles.mono} ${styles.ink} ${styles.eyebrow}`}>{t.hero.eyebrow}</p>
              <h1 className={styles.h1}>{t.hero.title}</h1>
              <p className={styles.heroSub}>{t.hero.sub}</p>
            </div>
            <div className={styles.ctas}>
              <a className={styles.primary} href={app}>{t.hero.cta}</a>
              <a className={styles.secondary} href="#download">{t.hero.desktop}</a>
              <span className={styles.ctaNote}>{t.hero.note}</span>
            </div>
            <PlateDemo from={name('bambu-x1c-0.4')} to={name('ad5x-0.4')} />
          </div>
        </section>

        <section className={styles.strip}>
          <div className={`${styles.wrap} ${styles.stripRow}`}>
            <span className={styles.mono}>{t.sites.from}</span>
            {SITES.map((s) => <span key={s} className={styles.site}>{s}</span>)}
            <span className={styles.grow} />
            <span className={styles.mono}>{t.sites.count(PRINTERS.length, BRANDS.length)}</span>
          </div>
        </section>

        <HowItWorks />
        <Printers />
        <Extension />
        <Download />
        <Faq />
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerRow}`}>
          <Logo size={16} />
          <span className={styles.grow} />
          {LINKS.repo && <a href={LINKS.repo}>{t.nav.github}</a>}
          {LINKS.support && <a href={LINKS.support}>{t.nav.coffee}</a>}
          {issuesUrl && <a href={issuesUrl}>{t.footer.report}</a>}
          {releaseNotesUrl && <a href={releaseNotesUrl}>{t.footer.notes}</a>}
          <a href="#privacy">{t.footer.privacy}</a>
          <LanguageSelect className={styles.language} locale={locale} onLocale={onLocale} />
        </div>
      </footer>
    </>
  );
}
