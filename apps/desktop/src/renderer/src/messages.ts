import { plural, type Locale } from '@retarget3mf/ui';

export interface DesktopMessages {
  appName: string;
  nav: { history: string; settings: string; convert: string };
  stage: { source: string; printer: string; slicer: string; needsInput: string; saved: string };
  source: { orOpen: string; remove: string };
  manageSlicers: string;
  slicerState: { installed: string; missing: string; opened: (slicer: string) => string };
  plates: (n: number) => string;
  slots: (n: number, toolheads: boolean) => string;
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
};

export const DESKTOP_MESSAGES: Record<Locale, DesktopMessages> = { en, pl };
