import { plural, type Locale } from '@retarget3mf/ui';

export interface WebMessages {
  privacy: string;
  change: string;
  slicer: string;
  openWith: string;
  language: string;
  reading: string;
  converting: string;
  hint: (slicer: string) => string;
  viewReport: string;
  another: string;
  failed: string;
  getDesktop: string;
  getDesktopLink: string;
  coffee: string;
  github: string;
  howItWorks: string;
  yourPrinter: string;
  remembered: (slots: string) => string;
  openProject: string;
  project: string;
  convertDownload: string;
  convertedFor: (printer: string) => string;
  colours: (n: number) => string;
  merged: (from: number, to: string) => string;
  slots: (n: number, toolheads: boolean) => string;
  warningCount: (n: number) => string;
  downloaded: (file: string) => string;
  downloadAgain: string;
  reportProblem: string;
  upsell: string;
}

const en: WebMessages = {
  privacy: 'Runs entirely in your browser: files never leave your computer, and it works offline.',
  change: 'Change',
  slicer: 'Slicer',
  openWith: 'Open with',
  language: 'Language',
  reading: 'Reading project…',
  converting: 'Converting…',
  hint: (slicer) => `Open it in ${slicer} with File → Open Project. Dragging it onto the plate imports only the geometry, without the print settings.`,
  viewReport: 'View report',
  another: 'Convert another file',
  failed: 'Something went wrong while converting this file. Please report it together with the model link.',
  getDesktop: 'Get the desktop app',
  getDesktopLink: 'Get the desktop app ↗',
  coffee: 'Buy me a coffee',
  github: 'GitHub',
  howItWorks: 'How it works ↗',
  yourPrinter: '01 YOUR PRINTER',
  remembered: (slots) => `${slots} · remembered in this browser`,
  openProject: '02 OPEN A PROJECT',
  project: '02 PROJECT',
  convertDownload: 'Convert & download',
  convertedFor: (printer) => `Converted for ${printer}`,
  colours: (n) => plural('en', n, { one: '{n} colour', other: '{n} colours' }),
  merged: (from, to) => `${from} colours → ${to}`,
  slots: (n, th) => plural('en', n, th ? { one: '{n} toolhead', other: '{n} toolheads' } : { one: '{n} slot', other: '{n} slots' }),
  warningCount: (n) => plural('en', n, { one: '{n} warning', other: '{n} warnings' }),
  downloaded: (file) => `${file} · downloaded`,
  downloadAgain: 'Download again',
  reportProblem: 'Report a problem',
  upsell: 'With the desktop app, converted files open straight in your slicer.',
};

const pl: WebMessages = {
  privacy: 'Wszystko działa w przeglądarce: pliki nie opuszczają Twojego komputera, działa też offline.',
  change: 'Zmień',
  slicer: 'Slicer',
  openWith: 'Otwórz w',
  language: 'Język',
  reading: 'Wczytywanie projektu…',
  converting: 'Konwertowanie…',
  hint: (slicer) => `Otwórz go w ${slicer} przez Plik → Otwórz projekt. Przeciągnięcie na stół wczyta tylko geometrię, bez ustawień druku.`,
  viewReport: 'Pokaż raport',
  another: 'Konwertuj inny plik',
  failed: 'Coś poszło nie tak podczas konwersji. Zgłoś ten plik razem z linkiem do modelu.',
  getDesktop: 'Aplikacja na komputer',
  getDesktopLink: 'Pobierz aplikację ↗',
  coffee: 'Postaw kawę',
  github: 'GitHub',
  howItWorks: 'Jak to działa ↗',
  yourPrinter: '01 TWOJA DRUKARKA',
  remembered: (slots) => `${slots} · zapamiętana w tej przeglądarce`,
  openProject: '02 OTWÓRZ PROJEKT',
  project: '02 PROJEKT',
  convertDownload: 'Konwertuj i pobierz',
  convertedFor: (printer) => `Przekonwertowano dla ${printer}`,
  colours: (n) => plural('pl', n, { one: '{n} kolor', few: '{n} kolory', other: '{n} kolorów' }),
  merged: (from, to) => `${plural('pl', from, { one: '{n} kolor', few: '{n} kolory', other: '{n} kolorów' })} → ${to}`,
  slots: (n, th) => plural('pl', n, th ? { one: '{n} głowica', few: '{n} głowice', other: '{n} głowic' } : { one: '{n} slot', few: '{n} sloty', other: '{n} slotów' }),
  warningCount: (n) => plural('pl', n, { one: '{n} ostrzeżenie', few: '{n} ostrzeżenia', other: '{n} ostrzeżeń' }),
  downloaded: (file) => `${file} · pobrano`,
  downloadAgain: 'Pobierz ponownie',
  reportProblem: 'Zgłoś problem',
  upsell: 'Z aplikacją na komputer przekonwertowane pliki otwierają się od razu w slicerze.',
};

export const WEB_MESSAGES: Record<Locale, WebMessages> = { en, pl };
