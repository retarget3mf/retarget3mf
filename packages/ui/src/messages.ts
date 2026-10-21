import type { SettingOutcome } from '@retarget3mf/core';
import { plural, type Locale } from './i18n.tsx';

type SlotKind = 'semm' | 'toolheads' | 'single';

export interface UiMessages {
  theme: { label: string; system: string; light: string; dark: string };
  printer: { label: string; colours: (n: number) => string; toolheads: (n: number) => string; single: string };
  drop: { title: string; body: string; browse: string };
  conversion: {
    madeFor: (printer: string, slicer: string, plates: number) => string;
    chooseAnother: string;
    filamentsTo: (printer: string, kind: SlotKind) => string;
    tooMany: (used: number, slots: number, kind: SlotKind) => string;
    /** The two sentences of `tooMany`, for layouts that show them apart. */
    tooManyTitle: (used: number, slots: number, kind: SlotKind) => string;
    combined: string;
    filamentLabel: (n: number, type: string) => string;
    slotFor: (n: number) => string;
    slot: (n: number, kind: SlotKind) => string;
    plate: (n: number) => string;
    shared: string;
  };
  report: {
    title: string; exportMd: string; exportJson: string; back: string; filter: string; all: (n: number) => string;
    search: string; setting: string; outcome: string; from: string; to: string; why: string;
    target: (source: string, target: string, slicer: string, profiles: string) => string;
    outcomes: Record<SettingOutcome, string>;
  };
}

const en: UiMessages = {
  theme: { label: 'Colour mode', system: 'System', light: 'Light', dark: 'Dark' },
  printer: { label: 'Printer', colours: (n) => `${n}-colour`, toolheads: (n) => `${n} toolheads`, single: 'single colour' },
  drop: {
    title: 'Drop a .3mf project here',
    body: 'Projects from MakerWorld, Printables, Creality Cloud and Snapmaker Space (Bambu Studio, PrusaSlicer 2.x, Creality Print, OrcaSlicer). Download the 3MF with print settings, not just the model.',
    browse: 'Open file…',
  },
  conversion: {
    madeFor: (printer, slicer, plates) => `Made for ${printer} in ${slicer} · ${plural('en', plates, { one: '{n} plate', other: '{n} plates' })}`,
    chooseAnother: 'Choose another file',
    filamentsTo: (printer, kind) => `Filaments → ${printer} ${{ semm: 'slots', toolheads: 'toolheads', single: 'extruder' }[kind]}`,
    tooManyTitle: (used, slots, kind) => `This project uses ${used} colours but the printer has ${plural('en', slots, kind === 'toolheads' ? { one: '{n} toolhead', other: '{n} toolheads' } : { one: '{n} slot', other: '{n} slots' })}.`,
    combined: 'Similar colours were combined; adjust below.',
    tooMany(used, slots, kind) { return `${this.tooManyTitle(used, slots, kind)} ${this.combined}`; },
    filamentLabel: (n, type) => `Filament ${n} · ${type}`,
    slotFor: (n) => `Slot for filament ${n}`,
    slot: (n, kind) => (kind === 'toolheads' ? `Toolhead ${n}` : `Slot ${n}`),
    plate: (n) => `Plate ${n}`,
    shared: 'Colours sharing a slot will print in the same filament.',
  },
  report: {
    title: 'Conversion report', exportMd: 'Export Markdown', exportJson: 'Export JSON', back: 'Back', filter: 'Filter settings',
    all: (n) => `All (${n})`, search: 'Search setting…', setting: 'Setting', outcome: 'Outcome', from: 'From', to: 'To', why: 'Why',
    target: (source, target, slicer, profiles) => `${source} → ${target} (${slicer}, profiles ${profiles})`,
    outcomes: { kept: 'kept', clamped: 'clamped', translated: 'translated', replaced: 'replaced', dropped: 'dropped' },
  },
};

const pl: UiMessages = {
  theme: { label: 'Motyw', system: 'Systemowy', light: 'Jasny', dark: 'Ciemny' },
  printer: {
    label: 'Drukarka', single: 'jeden kolor',
    colours: (n) => plural('pl', n, { one: '{n} kolor', few: '{n} kolory', other: '{n} kolorów' }),
    toolheads: (n) => plural('pl', n, { one: '{n} głowica', few: '{n} głowice', other: '{n} głowic' }),
  },
  drop: {
    title: 'Upuść tutaj projekt .3mf',
    body: 'Projekty z MakerWorld, Printables, Creality Cloud i Snapmaker Space (Bambu Studio, PrusaSlicer 2.x, Creality Print, OrcaSlicer). Pobieraj 3MF z ustawieniami druku, nie sam model.',
    browse: 'Otwórz plik…',
  },
  conversion: {
    madeFor: (printer, slicer, plates) => `Przygotowany dla ${printer} w ${slicer} · ${plural('pl', plates, { one: '{n} stół', few: '{n} stoły', other: '{n} stołów' })}`,
    chooseAnother: 'Wybierz inny plik',
    filamentsTo: (printer, kind) => `Filamenty → ${printer}, ${{ semm: 'sloty', toolheads: 'głowice', single: 'ekstruder' }[kind]}`,
    tooManyTitle: (used, slots, kind) => `Projekt używa ${plural('pl', used, { one: '{n} koloru', other: '{n} kolorów' })}, a drukarka ma ${plural('pl', slots, kind === 'toolheads' ? { one: '{n} głowicę', few: '{n} głowice', other: '{n} głowic' } : { one: '{n} slot', few: '{n} sloty', other: '{n} slotów' })}.`,
    combined: 'Podobne kolory połączono; popraw poniżej.',
    tooMany(used, slots, kind) { return `${this.tooManyTitle(used, slots, kind)} ${this.combined}`; },
    filamentLabel: (n, type) => `Filament ${n} · ${type}`,
    slotFor: (n) => `Slot dla filamentu ${n}`,
    slot: (n, kind) => (kind === 'toolheads' ? `Głowica ${n}` : `Slot ${n}`),
    plate: (n) => `Stół ${n}`,
    shared: 'Kolory we wspólnym slocie zostaną wydrukowane tym samym filamentem.',
  },
  report: {
    title: 'Raport konwersji', exportMd: 'Eksportuj Markdown', exportJson: 'Eksportuj JSON', back: 'Wstecz', filter: 'Filtruj ustawienia',
    all: (n) => `Wszystkie (${n})`, search: 'Szukaj ustawienia…', setting: 'Ustawienie', outcome: 'Wynik', from: 'Było', to: 'Jest', why: 'Dlaczego',
    target: (source, target, slicer, profiles) => `${source} → ${target} (${slicer}, profile ${profiles})`,
    outcomes: { kept: 'zachowane', clamped: 'ograniczone', translated: 'przetłumaczone', replaced: 'zastąpione', dropped: 'usunięte' },
  },
};

export const UI_MESSAGES: Record<Locale, UiMessages> = { en, pl };
