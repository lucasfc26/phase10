import type { Locale } from './i18n/types';

const LOCALE_KEY = 'phase10-locale';
const SOUND_KEY = 'phase10-sound';

export function getStoredLocale(): Locale {
  const v = localStorage.getItem(LOCALE_KEY);
  if (v === 'pt' || v === 'en' || v === 'fr' || v === 'es' || v === 'zh') return v;
  return 'pt';
}

export function setStoredLocale(locale: Locale) {
  localStorage.setItem(LOCALE_KEY, locale);
}

export function getStoredSoundEnabled(): boolean {
  const v = localStorage.getItem(SOUND_KEY);
  if (v === 'false') return false;
  return true;
}

export function setStoredSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_KEY, String(enabled));
}

export const LOCALE_LABELS: Record<Locale, string> = {
  pt: 'PT',
  en: 'EN',
  fr: 'FR',
  es: 'ES',
  zh: 'CH',
};

const COOKIES_KEY = 'phase10-cookies-accepted';

export function getCookiesAccepted(): boolean {
  return localStorage.getItem(COOKIES_KEY) === 'true';
}

export function setCookiesAccepted() {
  localStorage.setItem(COOKIES_KEY, 'true');
}
