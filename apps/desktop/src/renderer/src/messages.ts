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
  review: { inProject: string; onPrinter: string; removed: string; unused: string; output: (folder: string) => string };
  log: {
    read: (file: string, filaments: number, plates: number) => string;
    source: (printer: string, slicer: string) => string;
    mapping: (merged: string, removed: string) => string;
    slots: (filaments: number[], slot: string) => string;
    removed: (filaments: number[]) => string;
    rewriting: (printer: string) => string;
    save: (folder: string, slicer: string | undefined) => string;
  };
  history: {
    title: string; all: (n: number) => string; search: string; empty: string; noMatch: string; missing: string;
    cols: { project: string; source: string; printer: string; slicer: string; converted: string; warn: string };
    open: string; show: string; report: string; remove: (title: string) => string; removeFromList: string; trash: string; reportGone: string;
  };
  catalogue: { title: string; search: string; all: string; multi: string; single: string; colours: (n: number) => string; heads: (n: number) => string; close: string };
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
  review: { inProject: 'IN PROJECT', onPrinter: 'ON PRINTER', removed: 'Removed', unused: 'unused', output: (f) => `→ ${f}` },
  log: {
    read: (file, f, p) => `read ${file} · ${plural('en', f, { one: '{n} filament', other: '{n} filaments' })} · ${plural('en', p, { one: '{n} plate', other: '{n} plates' })}`,
    source: (printer, slicer) => `source profile: ${printer} (${slicer})`,
    mapping: (merged, removed) => [merged, removed].filter(Boolean).join(' · '),
    slots: (f, slot) => `filament ${f.join(', ')} → ${slot}`,
    removed: (f) => `filament ${f.join(', ')} removed (unused)`,
    rewriting: (p) => `rewriting plate settings for ${p}…`,
    save: (folder, slicer) => (slicer ? `save to ${folder} and open ${slicer}` : `save to ${folder}`),
  },
  history: {
    title: 'History', all: (n) => `All · ${n}`, search: 'Search', noMatch: 'Nothing matches.', missing: 'file moved or deleted',
    empty: 'No conversions yet. Projects you convert, from here, Finder or the browser extension, appear here.',
    cols: { project: 'PROJECT', source: 'SOURCE', printer: 'PRINTER', slicer: 'SLICER', converted: 'CONVERTED', warn: 'WARN' },
    open: 'Open', show: 'Show', report: 'Report', remove: (t) => `Remove ${t}`, removeFromList: 'Remove from list', trash: 'Also move file to Trash',
    reportGone: 'The report for this conversion is no longer available.',
  },
  catalogue: {
    title: 'Printers', search: 'Search printers…', all: 'All', multi: 'Multi-colour', single: 'Single colour',
    colours: (n) => `${n}c`, heads: (n) => `${n} heads`, close: 'Close',
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
  review: { inProject: 'W PROJEKCIE', onPrinter: 'NA DRUKARCE', removed: 'Usunięty', unused: 'nieużywany', output: (f) => `→ ${f}` },
  log: {
    read: (file, f, p) => `wczytano ${file} · ${plural('pl', f, { one: '{n} filament', few: '{n} filamenty', other: '{n} filamentów' })} · ${plural('pl', p, { one: '{n} stół', few: '{n} stoły', other: '{n} stołów' })}`,
    source: (printer, slicer) => `profil źródłowy: ${printer} (${slicer})`,
    mapping: (merged, removed) => [merged, removed].filter(Boolean).join(' · '),
    slots: (f, slot) => `filament ${f.join(', ')} → ${slot}`,
    removed: (f) => `filament ${f.join(', ')} usunięty (nieużywany)`,
    rewriting: (p) => `przepisuję ustawienia stołu dla ${p}…`,
    save: (folder, slicer) => (slicer ? `zapis do ${folder} i otwarcie w ${slicer}` : `zapis do ${folder}`),
  },
  history: {
    title: 'Historia', all: (n) => `Wszystkie · ${n}`, search: 'Szukaj', noMatch: 'Brak wyników.', missing: 'plik przeniesiony lub usunięty',
    empty: 'Brak konwersji. Pojawią się tu projekty przekonwertowane tutaj, z Findera lub rozszerzenia przeglądarki.',
    cols: { project: 'PROJEKT', source: 'ŹRÓDŁO', printer: 'DRUKARKA', slicer: 'SLICER', converted: 'KIEDY', warn: 'OSTRZ.' },
    open: 'Otwórz', show: 'Pokaż', report: 'Raport', remove: (t) => `Usuń ${t}`, removeFromList: 'Usuń z listy', trash: 'Przenieś też plik do Kosza',
    reportGone: 'Raport tej konwersji nie jest już dostępny.',
  },
  catalogue: {
    title: 'Drukarki', search: 'Szukaj drukarki…', all: 'Wszystkie', multi: 'Wielokolorowe', single: 'Jednokolorowe',
    colours: (n) => `${n}k`, heads: (n) => plural('pl', n, { one: '{n} głowica', few: '{n} głowice', other: '{n} głowic' }), close: 'Zamknij',
  },
};

export const DESKTOP_MESSAGES: Record<Locale, DesktopMessages> = { en, pl };

export const platformKey = (): Platform => (window.desktop.platform === 'darwin' || window.desktop.platform === 'win32' ? window.desktop.platform : 'other');
