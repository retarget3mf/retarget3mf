import type { PrinterDefinition, PrinterId, SlicerId } from '@retarget3mf/core';
import { SLICER_NAMES } from '@retarget3mf/profiles/printers';
import { ExternalIcon } from './icons.tsx';
import { LINKS } from './links.ts';
import { groupByVendor, modelName } from './PrinterPicker.tsx';
import { plural, useT, type Locale } from './i18n.tsx';
import icon from './brand/icon.svg';
import styles from './ExtensionPopup.module.css';

const iconUrl = typeof icon === 'string' ? icon : icon.src;

interface PopupMessages {
  desktop: string; web: string; convertingFor: string; printer: string; slicer: string; choose: string;
  synced: string; webNote: string; offer: string; offerSub: string; hint: [string, string];
  getDesktop: string; getDesktopSub: string; download: string; slots: (n: number) => string;
  stores: string; storeFor: (browser: string) => string; soon: string; privacy: string;
}

const en: PopupMessages = {
  desktop: 'DESKTOP APP', web: 'WEB', convertingFor: 'CONVERTING FOR', printer: 'PRINTER', slicer: 'SLICER', choose: 'Choose your printer',
  synced: 'Synced with the desktop app.',
  webNote: 'Projects open in the web converter in a new tab. Converted files go to your Downloads folder.',
  offer: 'Offer to open 3MF downloads', offerSub: 'When a project from a model site finishes downloading',
  hint: ["On MakerWorld, Printables, Creality Cloud and Snapmaker Space, open the site's download or slicer menu and pick", 'Open for …'],
  getDesktop: 'Get the desktop app', getDesktopSub: 'Opens results straight in your slicer.', download: 'Download',
  slots: (n) => plural('en', n, { one: '{n} slot', other: '{n} slots' }),
  stores: 'Store pages', storeFor: (b) => `Retarget3MF for ${b}`, soon: 'Store page coming soon', privacy: 'Privacy',
};
const pl: PopupMessages = {
  desktop: 'APLIKACJA', web: 'PRZEGLĄDARKA', convertingFor: 'KONWERSJA DLA', printer: 'DRUKARKA', slicer: 'SLICER', choose: 'Wybierz drukarkę',
  synced: 'Zsynchronizowano z aplikacją.',
  webNote: 'Projekty otwierają się w konwerterze w nowej karcie. Przekonwertowane pliki trafiają do folderu Pobrane.',
  offer: 'Proponuj otwarcie pobranych 3MF', offerSub: 'Gdy projekt z serwisu z modelami zostanie pobrany',
  hint: ['Na MakerWorld, Printables, Creality Cloud i Snapmaker Space otwórz menu pobierania lub slicera i wybierz', 'Open for …'],
  getDesktop: 'Aplikacja na komputer', getDesktopSub: 'Otwiera wynik od razu w slicerze.', download: 'Pobierz',
  slots: (n) => plural('pl', n, { one: '{n} slot', few: '{n} sloty', other: '{n} slotów' }),
  stores: 'Strony w sklepach', storeFor: (b) => `Retarget3MF dla ${b}`, soon: 'Strona w sklepie wkrótce', privacy: 'Prywatność',
};
export const POPUP_MESSAGES: Record<Locale, PopupMessages> = { en, pl };

/** The extension's store pages; greyed out until the URLs are filled in (links.ts). */
const STORES = [{ name: 'Chrome', url: LINKS.chromeStore }, { name: 'Firefox', url: LINKS.firefoxAddons }];

export interface ExtensionPopupProps {
  /** The desktop app answered: printer and slicer are its settings, and files go to it. */
  connected: boolean;
  printers: readonly PrinterDefinition[];
  printer: PrinterId | undefined;
  onPrinter: (printer: PrinterId) => void;
  slicer?: SlicerId | undefined;
  onSlicer?: (slicer: SlicerId) => void;
  /** The installed slicer's icon, from the desktop app. */
  slicerIcon?: string | undefined;
  offer: boolean;
  onOffer?: (on: boolean) => void;
  /** Where to get the desktop app; the upsell is hidden without it. */
  desktopUrl?: string | undefined;
}

/** The browser extension's popup; also rendered on the landing page as a live preview. */
export function ExtensionPopup({ connected, printers, printer, onPrinter, slicer, onSlicer, slicerIcon, offer, onOffer, desktopUrl }: ExtensionPopupProps) {
  const t = useT(POPUP_MESSAGES);
  const current = printers.find((p) => p.id === printer);
  return (
    <div className={styles.popup}>
      <header className={styles.top}>
        <img src={iconUrl} width={18} height={18} alt="" className={styles.icon} />
        <span className={styles.name}>Retarget3MF</span>
        <span className={`${styles.status} ${connected ? styles.connected : ''}`}><span className={styles.dot} />{connected ? t.desktop : t.web}</span>
      </header>
      <div className={styles.body}>
        <span className={styles.label}>{t.convertingFor}</span>
        <div className={styles.card}>
          <label className={styles.row}>
            <span className={styles.grow}><span className={styles.small}>{t.printer}</span><span className={styles.value}>{current?.displayName ?? t.choose}</span></span>
            <span className={styles.chevron} aria-hidden>⌄</span>
            <select aria-label={t.printer} value={printer ?? ''} onChange={(e) => onPrinter(e.target.value as PrinterId)}>
              {!current && <option value="" disabled>{t.choose}</option>}
              {groupByVendor(printers).map(([vendor, list]) => (
                <optgroup key={vendor} label={vendor}>{list.map((p) => <option key={p.id} value={p.id}>{modelName(p)}</option>)}</optgroup>
              ))}
            </select>
          </label>
          {connected && current && slicer && (
            <label className={styles.row}>
              <span className={styles.slicerIcon}>{slicerIcon ? <img src={slicerIcon} alt="" width={32} height={32} /> : <span className={styles.tile} aria-hidden>{SLICER_NAMES[slicer][0]}</span>}</span>
              <span className={styles.grow}><span className={styles.small}>{t.slicer}</span><span className={styles.value}>{SLICER_NAMES[slicer]}</span></span>
              <span className={styles.chevron} aria-hidden>⌄</span>
              <select aria-label={t.slicer} value={slicer} onChange={(e) => onSlicer?.(e.target.value as SlicerId)}>
                {current.slicers.map((s) => <option key={s} value={s}>{SLICER_NAMES[s]}</option>)}
              </select>
            </label>
          )}
        </div>
        <p className={styles.note}>{connected ? t.synced : t.webNote}</p>
        <label className={styles.toggle}>
          <span className={styles.grow}><strong>{t.offer}</strong><span className={styles.note}>{t.offerSub}</span></span>
          <input type="checkbox" role="switch" checked={offer} onChange={(e) => onOffer?.(e.target.checked)} />
        </label>
        {!connected && desktopUrl && (
          <a className={styles.upsell} href={desktopUrl} target="_blank" rel="noreferrer">
            <span className={styles.grow}><strong>{t.getDesktop}</strong><span className={styles.note}>{t.getDesktopSub}</span></span>
            <span className={styles.button}>{t.download}</span>
          </a>
        )}
      </div>
      {connected && <p className={styles.hint}>{t.hint[0]} <b>{t.hint[1]}</b></p>}
      <footer className={styles.stores}>
        <span>{t.stores}</span>
        {STORES.map(({ name, url }) => (url
          ? <a key={name} className={styles.store} href={url} target="_blank" rel="noreferrer" aria-label={t.storeFor(name)} title={t.storeFor(name)}><ExternalIcon /><span>{name}</span></a>
          : <span key={name} className={`${styles.store} ${styles.storeSoon}`} role="link" aria-disabled="true" aria-label={`${t.storeFor(name)} (${t.soon})`} title={t.soon}><ExternalIcon /><span>{name}</span></span>))}
        {LINKS.privacy && <a className={styles.store} href={LINKS.privacy} target="_blank" rel="noreferrer">{t.privacy}</a>}
      </footer>
    </div>
  );
}
