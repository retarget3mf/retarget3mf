/** Locales and plural forms without React, so server components and plain scripts can use them. */
export const LOCALES = ['en', 'pl'] as const;
export type Locale = (typeof LOCALES)[number];
/** Languages offered to users. The others have dictionaries but wait for a review of their translations. */
export const ENABLED_LOCALES: readonly Locale[] = ['en'];

type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** `{n}` in the chosen form is replaced by the number. */
export function plural(locale: Locale, n: number, forms: PluralForms): string {
  const form = forms[new Intl.PluralRules(locale).select(n)] ?? forms.other;
  return form.replace('{n}', String(n));
}
