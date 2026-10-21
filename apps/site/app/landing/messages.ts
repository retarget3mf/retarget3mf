import { plural, type Locale } from '@retarget3mf/ui/plural';

interface Os { os: string; req: string; button: string }

export interface LandingMessages {
  nav: { how: string; printers: string; extension: string; download: string; faq: string; open: string; coffee: string; github: string; menu: string; language: string };
  hero: { eyebrow: string; title: string; sub: string; cta: string; desktop: string; note: string };
  plate: { label: string; madeFor: string; retargeted: string; colours: (n: number) => string; slots: (n: number) => string; chips: string[]; opens: (slicer: string) => string; caption: string };
  sites: { from: string; count: (printers: number, brands: number) => string };
  how: { title: string; steps: (printers: number) => { title: string; body: string }[] };
  printers: { title: string; sub: (printers: number, brands: number) => string; search: string; single: string; colours: (n: number) => string; heads: (n: number) => string; none: string };
  extension: { title: string; body: string; chromium: string; addChrome: string; addFirefox: string; later: string; soon: string };
  download: { title: string; sub: string; detected: string; mac: Os; windows: Os; linux: Os; soon: string };
  faq: { title: string; items: { q: string; a: string }[] };
  footer: { report: string; notes: string; privacy: string };
}

const en: LandingMessages = {
  nav: { how: 'How it works', printers: 'Printers', extension: 'Extension', download: 'Download', faq: 'FAQ', open: 'Open converter', coffee: 'Buy me a coffee', github: 'GitHub', menu: 'Menu', language: 'Language' },
  hero: {
    eyebrow: 'FREE · RUNS IN YOUR BROWSER',
    title: 'Convert 3D-printing projects for your printer, right in your browser.',
    sub: 'Drop a 3MF made for another printer. Retarget3MF rewrites its print settings and colours for yours, ready to open in your slicer.',
    cta: 'Open the converter →', desktop: 'Get the desktop app', note: 'Files never leave your computer, and it works offline.',
  },
  plate: {
    label: 'PLATE 1', madeFor: 'DOWNLOADED · MADE FOR', retargeted: 'RETARGETED FOR',
    colours: (n) => `${n} colours`, slots: (n) => `${n} slots`,
    chips: ['Printer profile', 'Nozzle & speeds', 'Plate size', 'Filament slots', 'Unused filaments removed'],
    opens: (s) => `Opens in ${s} →`, caption: 'A six-colour plate made for one printer, recoloured to the four slots of another.',
  },
  sites: { from: 'PROJECTS FROM', count: (p, b) => `FOR ${p} PRINTERS · ${b} BRANDS` },
  how: {
    title: 'How it works',
    steps: (n) => [
      { title: 'Pick your printer once', body: `Choose from ${n} supported printers. It is remembered for every project after.` },
      { title: 'Drop a 3MF project', body: 'From MakerWorld, Printables, Creality Cloud or Snapmaker Space. If it has more colours than your printer, similar colours are combined and you can adjust them.' },
      { title: 'Open it in your slicer', body: 'Save the converted file and open it in OrcaSlicer, QIDI Studio, Flash Studio or your printer’s own slicer.' },
    ],
  },
  printers: {
    title: 'Supported printers', sub: (p, b) => `${p} printers from ${b} brands. Pick yours once; it's remembered.`, search: 'Search printers',
    single: 'single', colours: (n) => `${n}-colour`, heads: (n) => `${n} heads`, none: 'No printer matches.',
  },
  extension: {
    title: 'Browser extension',
    body: 'Sends 3MF downloads from MakerWorld, Printables, Creality Cloud and Snapmaker Space straight to Retarget3MF, already converted for your printer.',
    chromium: 'Chrome, Edge, Brave, Arc', addChrome: 'Add to Chrome', addFirefox: 'Add to Firefox', later: 'Coming later', soon: 'Coming soon',
  },
  download: {
    title: 'Download the desktop app',
    sub: 'Same converter, plus: open .3mf files straight from Finder or Explorer, keep several printers, and have the slicer open automatically.',
    detected: 'DETECTED',
    mac: { os: 'macOS', req: 'Apple silicon and Intel', button: 'Download for Mac' },
    windows: { os: 'Windows', req: 'Windows 10 and 11, 64-bit', button: 'Download for Windows' },
    linux: { os: 'Linux', req: 'AppImage and .deb, 64-bit', button: 'Download for Linux' },
    soon: 'Coming soon',
  },
  faq: {
    title: 'FAQ',
    items: [
      { q: 'Are my files uploaded anywhere?', a: 'No. Conversion runs entirely in your browser, so files never leave your computer. After the first visit it also works offline.' },
      { q: 'Which files work?', a: '3MF projects saved with print settings: from MakerWorld (Bambu Studio), Printables (PrusaSlicer 2.x), Creality Cloud (Creality Print), Snapmaker Space (Snapmaker Orca), and files from OrcaSlicer or Anycubic Slicer Next. A plain STL or a 3MF with only the model has no settings to convert. PrusaSlicer 3.0 projects are not supported yet.' },
      { q: 'My project has more colours than my printer. What happens?', a: 'Similar colours are combined onto shared slots, and you can change which colours share a slot before converting. Filaments that no object uses are removed.' },
      { q: 'What does the desktop app add?', a: 'It opens .3mf files straight from Finder or Explorer and from the browser extension, opens your slicer after converting, keeps several printers you switch between with ⌘1, ⌘2, and keeps a history of conversions with their reports.' },
      { q: 'Which slicers can open the result?', a: 'OrcaSlicer works for every supported printer. Where the maker has its own slicer, you can convert for that instead: Bambu Studio, Flash Studio, Creality Print, QIDI Studio, ElegooSlicer or PrusaSlicer. Open the file with File → Open Project; dragging it onto the plate imports only the geometry.' },
      { q: 'What happens to the author’s settings?', a: 'Layer height, walls, infill, supports, seams, ironing and painted colours are kept. Speeds, acceleration, retraction, filament calibration and start and end G-code come from your printer’s profile, and temperatures are kept within your filament’s and printer’s range. Every conversion comes with a report of each change and why.' },
      { q: 'Is it free?', a: 'Yes. Retarget3MF is open source under AGPL-3.0, with no account, no upload and no tracking.' },
      { q: 'My printer isn’t listed. Can it be added?', a: 'Printers come from the slicers’ own profiles, so most printers with OrcaSlicer profiles can be added. Ask for yours with “Report a problem” at the bottom of this page.' },
    ],
  },
  footer: { report: 'Report a problem', notes: 'Release notes', privacy: 'Privacy' },
};

const pl: LandingMessages = {
  nav: { how: 'Jak to działa', printers: 'Drukarki', extension: 'Rozszerzenie', download: 'Pobierz', faq: 'FAQ', open: 'Otwórz konwerter', coffee: 'Postaw kawę', github: 'GitHub', menu: 'Menu', language: 'Język' },
  hero: {
    eyebrow: 'ZA DARMO · DZIAŁA W PRZEGLĄDARCE',
    title: 'Konwertuje projekty do druku 3D pod Twoją drukarkę — prosto w przeglądarce.',
    sub: 'Upuść 3MF przygotowany dla innej drukarki. Retarget3MF przepisze ustawienia druku i kolory pod Twoją, gotowe do otwarcia w slicerze.',
    cta: 'Otwórz konwerter →', desktop: 'Aplikacja na komputer', note: 'Pliki nie opuszczają Twojego komputera, działa też offline.',
  },
  plate: {
    label: 'STÓŁ 1', madeFor: 'POBRANO · DLA', retargeted: 'PRZEROBIONO DLA',
    colours: (n) => plural('pl', n, { one: '{n} kolor', few: '{n} kolory', other: '{n} kolorów' }), slots: (n) => plural('pl', n, { one: '{n} slot', few: '{n} sloty', other: '{n} slotów' }),
    chips: ['Profil drukarki', 'Dysza i prędkości', 'Rozmiar stołu', 'Sloty filamentu', 'Nieużywane filamenty usunięte'],
    opens: (s) => `Otwiera się w ${s} →`, caption: 'Sześciokolorowy stół przygotowany dla jednej drukarki, przekolorowany na cztery sloty innej.',
  },
  sites: { from: 'PROJEKTY Z', count: (p, b) => `DLA ${p} DRUKAREK · ${b} MAREK` },
  how: {
    title: 'Jak to działa',
    steps: (n) => [
      { title: 'Wybierz drukarkę raz', body: `${n} obsługiwanych drukarek. Wybór zostaje zapamiętany dla kolejnych projektów.` },
      { title: 'Upuść projekt 3MF', body: 'Z MakerWorld, Printables, Creality Cloud lub Snapmaker Space. Jeśli ma więcej kolorów niż Twoja drukarka, podobne zostaną połączone, a Ty możesz je poprawić.' },
      { title: 'Otwórz w slicerze', body: 'Zapisz przekonwertowany plik i otwórz go w OrcaSlicer, QIDI Studio, Flash Studio lub slicerze producenta drukarki.' },
    ],
  },
  printers: {
    title: 'Obsługiwane drukarki', sub: (p, b) => `${p} drukarek ${b} marek. Wybierz swoją raz — zostanie zapamiętana.`, search: 'Szukaj drukarki',
    single: 'jeden kolor', colours: (n) => plural('pl', n, { one: '{n} kolor', few: '{n} kolory', other: '{n} kolorów' }), heads: (n) => plural('pl', n, { one: '{n} głowica', few: '{n} głowice', other: '{n} głowic' }), none: 'Brak pasujących drukarek.',
  },
  extension: {
    title: 'Rozszerzenie przeglądarki',
    body: 'Wysyła pliki 3MF z MakerWorld, Printables, Creality Cloud i Snapmaker Space prosto do Retarget3MF, już przekonwertowane dla Twojej drukarki.',
    chromium: 'Chrome, Edge, Brave, Arc', addChrome: 'Dodaj do Chrome', addFirefox: 'Dodaj do Firefoksa', later: 'Później', soon: 'Wkrótce',
  },
  download: {
    title: 'Pobierz aplikację na komputer',
    sub: 'Ten sam konwerter, a do tego: otwiera pliki .3mf prosto z Findera lub Eksploratora, pamięta kilka drukarek i sam otwiera slicer.',
    detected: 'TWÓJ SYSTEM',
    mac: { os: 'macOS', req: 'Apple silicon i Intel', button: 'Pobierz na Maca' },
    windows: { os: 'Windows', req: 'Windows 10 i 11, 64-bit', button: 'Pobierz na Windows' },
    linux: { os: 'Linux', req: 'AppImage i .deb, 64-bit', button: 'Pobierz na Linuksa' },
    soon: 'Wkrótce',
  },
  faq: {
    title: 'FAQ',
    items: [
      { q: 'Czy moje pliki są gdzieś wysyłane?', a: 'Nie. Konwersja odbywa się w całości w przeglądarce, więc pliki nie opuszczają Twojego komputera. Po pierwszej wizycie działa też offline.' },
      { q: 'Jakie pliki działają?', a: 'Projekty 3MF zapisane z ustawieniami druku: z MakerWorld (Bambu Studio), Printables (PrusaSlicer 2.x), Creality Cloud (Creality Print), Snapmaker Space (Snapmaker Orca) oraz pliki z OrcaSlicer i Anycubic Slicer Next. Zwykły STL lub 3MF z samym modelem nie ma ustawień do konwersji. Projekty PrusaSlicer 3.0 nie są jeszcze obsługiwane.' },
      { q: 'Projekt ma więcej kolorów niż moja drukarka. Co wtedy?', a: 'Podobne kolory trafiają do wspólnych slotów, a przed konwersją możesz zmienić, które kolory dzielą slot. Filamenty, których nie używa żaden obiekt, są usuwane.' },
      { q: 'Co daje aplikacja na komputer?', a: 'Otwiera pliki .3mf prosto z Findera lub Eksploratora i z rozszerzenia przeglądarki, sama otwiera slicer po konwersji, pamięta kilka drukarek przełączanych ⌘1, ⌘2 i prowadzi historię konwersji z raportami.' },
      { q: 'Które slicery otworzą wynik?', a: 'OrcaSlicer działa dla każdej obsługiwanej drukarki. Jeśli producent ma własny slicer, możesz konwertować dla niego: Bambu Studio, Flash Studio, Creality Print, QIDI Studio, ElegooSlicer lub PrusaSlicer. Otwieraj plik przez Plik → Otwórz projekt; przeciągnięcie na stół wczyta tylko geometrię.' },
      { q: 'Co dzieje się z ustawieniami autora?', a: 'Wysokość warstwy, ściany, wypełnienie, podpory, szwy, prasowanie i malowane kolory zostają. Prędkości, przyspieszenia, retrakcja, kalibracja filamentu oraz G-code startowy i końcowy pochodzą z profilu Twojej drukarki, a temperatury mieszczą się w zakresie filamentu i drukarki. Każda konwersja ma raport z każdą zmianą i powodem.' },
      { q: 'Czy to jest darmowe?', a: 'Tak. Retarget3MF to otwarte oprogramowanie na licencji AGPL-3.0, bez konta, wysyłania plików i śledzenia.' },
      { q: 'Mojej drukarki nie ma na liście. Czy można ją dodać?', a: 'Drukarki pochodzą z profili slicerów, więc da się dodać większość drukarek z profilami OrcaSlicer. Poproś o swoją przez „Zgłoś problem” na dole strony.' },
    ],
  },
  footer: { report: 'Zgłoś problem', notes: 'Informacje o wydaniu', privacy: 'Prywatność' },
};

export const LANDING_MESSAGES: Record<Locale, LandingMessages> = { en, pl };
