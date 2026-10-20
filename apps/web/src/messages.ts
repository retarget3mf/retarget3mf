import type { Locale } from '@retarget3mf/ui';

export interface WebMessages {
  tagline: string;
  privacy: string;
  stepPrinter: string;
  stepFile: string;
  slicer: string;
  language: string;
  reading: string;
  converting: string;
  convert: string;
  converted: (title: string, printer: string) => string;
  download: (fileName: string) => string;
  hint: (slicer: string) => string;
  warnings: string;
  viewReport: string;
  another: string;
  failed: string;
}

const en: WebMessages = {
  tagline: 'Convert 3D-printing projects for your printer, right in your browser.',
  privacy: 'Runs entirely in your browser: files never leave your computer, and it works offline.',
  stepPrinter: '1. Choose your printer',
  stepFile: '2. Open a project',
  slicer: 'Slicer',
  language: 'Language',
  reading: 'Reading project…',
  converting: 'Converting…',
  convert: 'Convert',
  converted: (title, printer) => `Converted “${title}” for ${printer}`,
  download: (fileName) => `Download ${fileName}`,
  hint: (slicer) => `Open it in ${slicer} with File → Open Project. Dragging it onto the plate imports only the geometry, without the print settings.`,
  warnings: 'Check before printing',
  viewReport: 'View report',
  another: 'Convert another file',
  failed: 'Something went wrong while converting this file. Please report it together with the model link.',
};

const pl: WebMessages = {
  tagline: 'Konwertuje projekty do druku 3D pod Twoją drukarkę — prosto w przeglądarce.',
  privacy: 'Wszystko działa w przeglądarce: pliki nie opuszczają Twojego komputera, działa też offline.',
  stepPrinter: '1. Wybierz drukarkę',
  stepFile: '2. Otwórz projekt',
  slicer: 'Slicer',
  language: 'Język',
  reading: 'Wczytywanie projektu…',
  converting: 'Konwertowanie…',
  convert: 'Konwertuj',
  converted: (title, printer) => `Przekonwertowano „${title}” dla ${printer}`,
  download: (fileName) => `Pobierz ${fileName}`,
  hint: (slicer) => `Otwórz go w ${slicer} przez Plik → Otwórz projekt. Przeciągnięcie na stół wczyta tylko geometrię, bez ustawień druku.`,
  warnings: 'Sprawdź przed drukiem',
  viewReport: 'Pokaż raport',
  another: 'Konwertuj inny plik',
  failed: 'Coś poszło nie tak podczas konwersji. Zgłoś ten plik razem z linkiem do modelu.',
};

export const WEB_MESSAGES: Record<Locale, WebMessages> = { en, pl };
