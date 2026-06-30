import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Locale, Translations } from './types';
import { pt } from './locales/pt';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { zh } from './locales/zh';

const catalogs: Record<Locale, Translations> = { pt, en, fr, es, zh };

export function getTranslations(locale: Locale): Translations {
  return catalogs[locale] ?? pt;
}

type I18nContextValue = {
  locale: Locale;
  t: Translations;
};

const I18nContext = createContext<I18nContextValue>({
  locale: 'pt',
  t: pt,
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, t: getTranslations(locale) }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export type { Locale, Translations, LegalPageType } from './types';
