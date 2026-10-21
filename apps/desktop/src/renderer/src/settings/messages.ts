import { plural, type Locale } from '@retarget3mf/ui';
import type { DropTarget, HistoryRetention, OpenMode } from '../../../shared/api.ts';

export type Page = 'printers' | 'slicers' | 'converting' | 'browser' | 'appearance' | 'about';

export interface SettingsMessages {
  pages: Record<Page, string>;
  printers: {
    mine: string; add: string; defaultBadge: string; slicer: string; nozzle: (mm: string) => string; more: (name: string) => string;
    makeDefault: string; remove: string; hint: string; dropFor: string; dropTargets: Record<DropTarget, { title: string; sub: string }>;
  };
  slicers: { found: string; rescan: string; addManually: string; installed: string; missing: string; change: string; locate: string; hint: string; blurbs: Record<string, string> };
  converting: {
    files: string; nextTo: string; inFolder: string; choose: string; fileName: string; fileNameHelp: string;
    fromOs: string; openModes: Record<OpenMode, string>; during: string; openAfter: string; removeUnused: string; autoCombine: string;
  };
  browser: { intro: string; chromiumRow: string; files: string; modes: Record<OpenMode, string>; which: string; chromium: (examples: string) => string; found: (list: string) => string; noneFound: string; states: Record<'ready' | 'failed' | 'missing' | 'unsupported', string>; safari: string };
  appearance: { theme: string; accent: string; preview: string; previewButton: (slicer: string) => string; previewLink: string; previewRow: string; accents: Record<string, string> };
  about: {
    version: (v: string) => string; current: string; available: (v: string) => string; devBuild: string; failed: string; check: string; checking: string;
    autoUpdate: string; history: string; keep: string; retention: Record<HistoryRetention, string>; count: (n: number) => string;
    clear: string; clearConfirm: string; cancel: string; report: string; notes: string; licenses: string;
  };
}

const en: SettingsMessages = {
  pages: { printers: 'Printers', slicers: 'Slicers', converting: 'Converting', browser: 'Browser', appearance: 'Appearance', about: 'About' },
  printers: {
    mine: 'My printers', add: 'Add printer…', defaultBadge: 'DEFAULT', slicer: 'SLICER', nozzle: (mm) => `${mm} mm nozzle`, more: (n) => `More for ${n}`,
    makeDefault: 'Make default', remove: 'Remove',
    hint: 'Switch printers from the Convert screen with ⌘1, ⌘2. Each printer remembers its own slicer.',
    dropFor: 'When a file is dropped, convert for',
    dropTargets: {
      last: { title: 'The last printer I used', sub: 'Recommended when you switch printers often.' },
      default: { title: 'Always the default printer', sub: '' },
      ask: { title: 'Ask every time', sub: 'Shows the printer list after each drop.' },
    },
  },
  slicers: {
    found: 'Found on this computer', rescan: 'Search again', addManually: 'Add manually…', installed: '● Installed', missing: 'Not found', change: 'Change…', locate: 'Locate…',
    hint: "Slicers that aren't installed can still be picked; the converted file is saved and opened later.",
    blurbs: { flashstudio: "Flashforge's own slicer", bambustudio: "Bambu Lab's own slicer", crealityprint: "Creality's own slicer", qidistudio: "Qidi's own slicer", elegooslicer: "Elegoo's own slicer", prusaslicer: "Prusa's own slicer", orca: 'Open-source, all brands' },
  },
  converting: {
    files: 'Converted files', nextTo: 'Next to the original file', inFolder: 'In', choose: 'Choose…', fileName: 'File name',
    fileNameHelp: '{name}, {printer} and {slicer} are filled in; .3mf is added.',
    fromOs: 'When a .3mf is opened from Finder / Explorer',
    openModes: { auto: 'Convert right away (ask only when colours need merging)', review: 'Show the review screen first' },
    during: 'During conversion', openAfter: 'Open in the slicer after converting', removeUnused: 'Remove filaments not used by any object',
    autoCombine: 'Combine similar colours automatically when slots run out',
  },
  browser: {
    intro: 'The browser extension sends 3MF downloads from MakerWorld, Printables, Creality Cloud and Snapmaker Space straight to Retarget3MF.',
    chromiumRow: 'Chrome and Chromium browsers', files: 'Files from the extension',
    modes: { auto: 'Convert for the current printer and open in the slicer', review: 'Bring Retarget3MF to the front and show the review screen' },
    which: 'Which browsers?', chromium: (x) => `One extension build works in every browser based on Chromium: ${x} and others.`,
    found: (l) => `Set up on this computer: ${l}.`, noneFound: 'None found on this computer.',
    states: { ready: '● Ready for the extension', failed: 'Could not connect', missing: 'Not installed', unsupported: 'Not supported yet' },
    safari: 'Safari extensions must ship inside a signed macOS app; planned separately.',
  },
  appearance: {
    theme: 'Theme', accent: 'Accent colour', preview: 'Preview', previewButton: (s) => `Convert & open in ${s}`, previewLink: 'Printables ↗', previewRow: 'Selected row',
    accents: { lime: 'Lime', mint: 'Mint', magenta: 'Magenta', violet: 'Violet', yellow: 'Yellow', amber: 'Amber', mono: 'Mono' },
  },
  about: {
    version: (v) => `Version ${v}`, current: 'up to date', available: (v) => `version ${v} is available`, devBuild: 'updates are checked in installed builds',
    failed: 'could not check for updates', check: 'Check for updates', checking: 'Checking…',
    autoUpdate: 'Download updates automatically', history: 'History', keep: 'Keep conversion history',
    retention: { forever: 'Forever', 365: 'For a year', 90: 'For 90 days', 30: 'For 30 days' },
    count: (n) => plural('en', n, { one: '{n} conversion', other: '{n} conversions' }),
    clear: 'Clear history…', clearConfirm: 'Clear history', cancel: 'Cancel', report: 'Report a problem', notes: 'Release notes', licenses: 'Licenses',
  },
};

const pl: SettingsMessages = {
  pages: { printers: 'Drukarki', slicers: 'Slicery', converting: 'Konwersja', browser: 'Przeglądarka', appearance: 'Wygląd', about: 'O programie' },
  printers: {
    mine: 'Moje drukarki', add: 'Dodaj drukarkę…', defaultBadge: 'DOMYŚLNA', slicer: 'SLICER', nozzle: (mm) => `dysza ${mm} mm`, more: (n) => `Więcej dla ${n}`,
    makeDefault: 'Ustaw jako domyślną', remove: 'Usuń',
    hint: 'Przełączaj drukarki na ekranie konwersji: ⌘1, ⌘2. Każda drukarka pamięta swój slicer.',
    dropFor: 'Upuszczony plik konwertuj dla',
    dropTargets: {
      last: { title: 'Ostatnio używanej drukarki', sub: 'Polecane, gdy często zmieniasz drukarki.' },
      default: { title: 'Zawsze domyślnej drukarki', sub: '' },
      ask: { title: 'Pytaj za każdym razem', sub: 'Po każdym pliku pokazuje listę drukarek.' },
    },
  },
  slicers: {
    found: 'Znalezione na tym komputerze', rescan: 'Szukaj ponownie', addManually: 'Dodaj ręcznie…', installed: '● Zainstalowany', missing: 'Nie znaleziono', change: 'Zmień…', locate: 'Wskaż…',
    hint: 'Można wybrać niezainstalowany slicer: plik zostanie zapisany i otwarty później.',
    blurbs: { flashstudio: 'Slicer Flashforge', bambustudio: 'Slicer Bambu Lab', crealityprint: 'Slicer Creality', qidistudio: 'Slicer Qidi', elegooslicer: 'Slicer Elegoo', prusaslicer: 'Slicer Prusa', orca: 'Otwarty, wszystkie marki' },
  },
  converting: {
    files: 'Przekonwertowane pliki', nextTo: 'Obok oryginalnego pliku', inFolder: 'W', choose: 'Wybierz…', fileName: 'Nazwa pliku',
    fileNameHelp: '{name}, {printer} i {slicer} są wstawiane; dodawane jest .3mf.',
    fromOs: 'Gdy .3mf jest otwierany z Findera / Eksploratora',
    openModes: { auto: 'Konwertuj od razu (pytaj tylko, gdy trzeba połączyć kolory)', review: 'Najpierw pokaż ekran przeglądu' },
    during: 'Podczas konwersji', openAfter: 'Otwórz w slicerze po konwersji', removeUnused: 'Usuwaj filamenty nieużywane przez żaden obiekt',
    autoCombine: 'Automatycznie łącz podobne kolory, gdy brakuje slotów',
  },
  browser: {
    intro: 'Rozszerzenie przeglądarki wysyła pliki 3MF z MakerWorld, Printables, Creality Cloud i Snapmaker Space prosto do Retarget3MF.',
    chromiumRow: 'Chrome i przeglądarki oparte na Chromium', files: 'Pliki z rozszerzenia',
    modes: { auto: 'Konwertuj dla bieżącej drukarki i otwórz w slicerze', review: 'Pokaż Retarget3MF z ekranem przeglądu' },
    which: 'Które przeglądarki?', chromium: (x) => `Jedna wersja rozszerzenia działa w każdej przeglądarce opartej na Chromium: ${x} i innych.`,
    found: (l) => `Skonfigurowane na tym komputerze: ${l}.`, noneFound: 'Nie znaleziono na tym komputerze.',
    states: { ready: '● Gotowa na rozszerzenie', failed: 'Nie udało się połączyć', missing: 'Niezainstalowana', unsupported: 'Jeszcze nieobsługiwana' },
    safari: 'Rozszerzenia Safari muszą być częścią podpisanej aplikacji macOS; planowane osobno.',
  },
  appearance: {
    theme: 'Motyw', accent: 'Kolor akcentu', preview: 'Podgląd', previewButton: (s) => `Konwertuj i otwórz w ${s}`, previewLink: 'Printables ↗', previewRow: 'Wybrany wiersz',
    accents: { lime: 'Limonka', mint: 'Mięta', magenta: 'Magenta', violet: 'Fiolet', yellow: 'Żółty', amber: 'Bursztyn', mono: 'Mono' },
  },
  about: {
    version: (v) => `Wersja ${v}`, current: 'aktualna', available: (v) => `dostępna wersja ${v}`, devBuild: 'aktualizacje są sprawdzane w zainstalowanej wersji',
    failed: 'nie udało się sprawdzić aktualizacji', check: 'Sprawdź aktualizacje', checking: 'Sprawdzam…',
    autoUpdate: 'Pobieraj aktualizacje automatycznie', history: 'Historia', keep: 'Przechowuj historię konwersji',
    retention: { forever: 'Zawsze', 365: 'Rok', 90: '90 dni', 30: '30 dni' },
    count: (n) => plural('pl', n, { one: '{n} konwersja', few: '{n} konwersje', other: '{n} konwersji' }),
    clear: 'Wyczyść historię…', clearConfirm: 'Wyczyść historię', cancel: 'Anuluj', report: 'Zgłoś problem', notes: 'Informacje o wydaniu', licenses: 'Licencje',
  },
};

export const SETTINGS_MESSAGES: Record<Locale, SettingsMessages> = { en, pl };
