import { plural, type Locale } from '@retarget3mf/ui';

type Platform = 'darwin' | 'win32' | 'other';

export interface DesktopMessages {
  appName: string;
  nav: { history: string; settings: string; convert: string };
  stage: { source: string; printer: string; slicer: string; needsInput: string; saved: string };
  source: { orOpen: string; remove: string };
  manageSlicers: string;
  slicerState: { installed: string; missing: string; opened: (slicer: string) => string };
  plates: (n: number) => string;
  slots: (n: number, toolheads: boolean) => string;
  busy: { reading: string; converting: string };
  firstRun: { title: string; sub: string; found: string; notFound: string; locate: string; several: string; continue: string };
  home: {
    usedForEvery: string; opensAfter: string; followsPrinter: string; addPrinter: string; addPrinterLabel: string;
    recent: string; viewAll: string; warnings: (n: number) => string;
  };
  choose: { title: string; sub: string };
  actions: { cancel: string; convertOnly: string; convertOpen: (slicer: string) => string; convert: string; slicerMissing: string };
  done: {
    title: (printer: string) => string;
    colours: (n: number) => string;
    nothingToMerge: string;
    merged: (from: number, to: string) => string;
    seconds: (s: string) => string;
    show: Record<Platform, string>;
    review: string;
    another: string;
    openIn: (slicer: string) => string;
    hint: string;
  };
}

const en: DesktopMessages = {
  appName: 'Retarget3MF',
  nav: { history: 'History', settings: 'Settings', convert: '← Convert' },
  stage: { source: '01 SOURCE', printer: '02 PRINTER', slicer: '03 SLICER', needsInput: 'NEEDS INPUT', saved: '✓ SAVED' },
  source: { orOpen: 'or', remove: 'Close project' },
  manageSlicers: 'Manage slicers…',
  slicerState: { installed: '● Installed', missing: 'Not found', opened: (s) => `Opened in ${s}` },
  plates: (n) => plural('en', n, { one: '{n} plate', other: '{n} plates' }),
  slots: (n, th) => plural('en', n, th ? { one: '{n} toolhead', other: '{n} toolheads' } : { one: '{n} slot', other: '{n} slots' }),
  busy: { reading: 'Reading project…', converting: 'Converting…' },
  firstRun: {
    title: 'Which printer do you print on?',
    sub: 'Asked once. Every project you drop afterwards is converted for this printer.',
    found: '● Found on this computer', notFound: 'Not found on this computer', locate: 'Locate…',
    several: 'I have more than one printer', continue: 'Continue',
  },
  home: {
    usedForEvery: 'Used for every file until you change it.', opensAfter: 'Opens after converting.', followsPrinter: 'follows printer',
    addPrinter: '+ Add printer…', addPrinterLabel: 'Add printer', recent: 'RECENT', viewAll: 'VIEW ALL →',
    warnings: (n) => plural('en', n, { one: '{n} warning', other: '{n} warnings' }),
  },
  choose: { title: 'Which printer is this project for?', sub: 'You asked to choose the printer for every file. Change this in Settings › Printers.' },
  actions: {
    cancel: 'Cancel', convertOnly: 'Convert only', convertOpen: (s) => `Convert & open in ${s}`, convert: 'Convert',
    slicerMissing: 'Slicer not found: locate it in Settings › Slicers.',
  },
  done: {
    title: (p) => `Converted for ${p}`,
    colours: (n) => plural('en', n, { one: '{n} colour', other: '{n} colours' }),
    nothingToMerge: 'nothing to merge',
    merged: (from, to) => `${from} colours → ${to}`,
    seconds: (s) => `${s}s`,
    show: { darwin: 'Show in Finder', win32: 'Show in Explorer', other: 'Show in folder' },
    review: 'Review settings', another: 'Drop another', openIn: (s) => `Open in ${s}`,
    hint: 'If you open it yourself, use File → Open Project in the slicer. Dragging it onto the plate imports only the geometry.',
  },
};

const pl: DesktopMessages = {
  appName: 'Retarget3MF',
  nav: { history: 'Historia', settings: 'Ustawienia', convert: '← Konwersja' },
  stage: { source: '01 ŹRÓDŁO', printer: '02 DRUKARKA', slicer: '03 SLICER', needsInput: 'WYMAGA DECYZJI', saved: '✓ ZAPISANO' },
  source: { orOpen: 'lub', remove: 'Zamknij projekt' },
  manageSlicers: 'Zarządzaj slicerami…',
  slicerState: { installed: '● Zainstalowany', missing: 'Nie znaleziono', opened: (s) => `Otwarto w ${s}` },
  plates: (n) => plural('pl', n, { one: '{n} stół', few: '{n} stoły', other: '{n} stołów' }),
  slots: (n, th) => plural('pl', n, th ? { one: '{n} głowica', few: '{n} głowice', other: '{n} głowic' } : { one: '{n} slot', few: '{n} sloty', other: '{n} slotów' }),
  busy: { reading: 'Czytam projekt…', converting: 'Konwertuję…' },
  firstRun: {
    title: 'Na jakiej drukarce drukujesz?',
    sub: 'Pytamy raz. Każdy projekt, który potem upuścisz, zostanie przekonwertowany dla tej drukarki.',
    found: '● Znaleziono na tym komputerze', notFound: 'Nie znaleziono na tym komputerze', locate: 'Wskaż…',
    several: 'Mam więcej niż jedną drukarkę', continue: 'Dalej',
  },
  home: {
    usedForEvery: 'Używana dla każdego pliku, dopóki jej nie zmienisz.', opensAfter: 'Otworzy się po konwersji.', followsPrinter: 'zależy od drukarki',
    addPrinter: '+ Dodaj drukarkę…', addPrinterLabel: 'Dodaj drukarkę', recent: 'OSTATNIE', viewAll: 'WSZYSTKIE →',
    warnings: (n) => plural('pl', n, { one: '{n} ostrzeżenie', few: '{n} ostrzeżenia', other: '{n} ostrzeżeń' }),
  },
  choose: { title: 'Dla której drukarki jest ten projekt?', sub: 'Wybrano pytanie o drukarkę przy każdym pliku. Zmienisz to w Ustawienia › Drukarki.' },
  actions: {
    cancel: 'Anuluj', convertOnly: 'Tylko konwertuj', convertOpen: (s) => `Konwertuj i otwórz w ${s}`, convert: 'Konwertuj',
    slicerMissing: 'Nie znaleziono slicera: wskaż go w Ustawienia › Slicery.',
  },
  done: {
    title: (p) => `Przekonwertowano dla ${p}`,
    colours: (n) => plural('pl', n, { one: '{n} kolor', few: '{n} kolory', other: '{n} kolorów' }),
    nothingToMerge: 'nic do łączenia',
    merged: (from, to) => `${plural('pl', from, { one: '{n} kolor', few: '{n} kolory', other: '{n} kolorów' })} → ${to}`,
    seconds: (s) => `${s} s`,
    show: { darwin: 'Pokaż w Finderze', win32: 'Pokaż w Eksploratorze', other: 'Pokaż w folderze' },
    review: 'Przejrzyj ustawienia', another: 'Upuść kolejny', openIn: (s) => `Otwórz w ${s}`,
    hint: 'Otwierając samodzielnie, użyj w slicerze Plik → Otwórz projekt. Przeciągnięcie na stół importuje tylko geometrię.',
  },
};

export const DESKTOP_MESSAGES: Record<Locale, DesktopMessages> = { en, pl };

export const platformKey = (): Platform => (window.desktop.platform === 'darwin' || window.desktop.platform === 'win32' ? window.desktop.platform : 'other');
