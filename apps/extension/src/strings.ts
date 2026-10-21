import { detectLocale, type Locale } from '@retarget3mf/ui';

interface Strings {
  converts: (slicer: string) => string; convertsHere: string; otherPrinter: string;
  chooseTitle: string; open: string; cancel: string; close: string;
  downloadedFrom: (site: string) => string; downloaded: string; notNow: string; always: string;
}

const STRINGS: Record<Locale, Strings> = {
  en: {
    converts: (s) => `Converts and opens in ${s}`, convertsHere: 'Converts in your browser', otherPrinter: 'Other printer…',
    chooseTitle: 'Open for another printer', open: 'Open', cancel: 'Cancel', close: 'Close',
    downloadedFrom: (s) => `Downloaded from ${s}`, downloaded: 'Downloaded', notNow: 'Not now', always: 'Always open without asking',
  },
  pl: {
    converts: (s) => `Konwertuje i otwiera w ${s}`, convertsHere: 'Konwertuje w przeglądarce', otherPrinter: 'Inna drukarka…',
    chooseTitle: 'Otwórz dla innej drukarki', open: 'Otwórz', cancel: 'Anuluj', close: 'Zamknij',
    downloadedFrom: (s) => `Pobrano z ${s}`, downloaded: 'Pobrano', notNow: 'Nie teraz', always: 'Zawsze otwieraj bez pytania',
  },
};

/** Content scripts and the background have no React tree; they read the browser's language once. */
export const strings = (): Strings => STRINGS[detectLocale(navigator.languages)];
