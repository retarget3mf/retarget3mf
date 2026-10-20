import { createContext, useContext, type ReactNode } from 'react';

export const LOCALES = ['en', 'pl'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', pl: 'Polski' };

const LocaleContext = createContext<Locale>('en');

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

/** Messages for the current locale; each app or component defines its own typed dictionary. */
export function useT<M>(dictionary: Record<Locale, M>): M {
  return dictionary[useLocale()];
}

/** First supported language from the browser's list, else English. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const l of languages) {
    const base = l.toLowerCase().split('-')[0] as Locale;
    if (LOCALES.includes(base)) return base;
  }
  return 'en';
}

type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** `{n}` in the chosen form is replaced by the number. */
export function plural(locale: Locale, n: number, forms: PluralForms): string {
  const form = forms[new Intl.PluralRules(locale).select(n)] ?? forms.other;
  return form.replace('{n}', String(n));
}
