import type { Locale } from './i18n/types';

const LOCALE_KEY = 'phase10-locale';
const SOUND_KEY = 'phase10-sound';
const MUSIC_TRACK_KEY = 'phase10-music-track';
const MUSIC_VOLUME_KEY = 'phase10-music-volume';
const MUSIC_PLAYING_KEY = 'phase10-music-playing';

export type MusicTrack = 'none' | 'chefe-final' | 'veludo-no-cafe' | 'combined';

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

export function getStoredMusicTrack(): MusicTrack {
  const v = localStorage.getItem(MUSIC_TRACK_KEY);
  if (v === 'chefe-final' || v === 'veludo-no-cafe' || v === 'combined' || v === 'none') return v;
  return 'none';
}

export function setStoredMusicTrack(track: MusicTrack) {
  localStorage.setItem(MUSIC_TRACK_KEY, track);
}

export function getStoredMusicVolume(): number {
  const v = Number(localStorage.getItem(MUSIC_VOLUME_KEY));
  if (Number.isFinite(v)) {
    return Math.max(0, Math.min(1, v));
  }
  return 0.35;
}

export function setStoredMusicVolume(volume: number) {
  localStorage.setItem(MUSIC_VOLUME_KEY, String(Math.max(0, Math.min(1, volume))));
}

export function getStoredMusicPlaying(): boolean {
  const v = localStorage.getItem(MUSIC_PLAYING_KEY);
  if (v === 'false') return false;
  return true;
}

export function setStoredMusicPlaying(playing: boolean) {
  localStorage.setItem(MUSIC_PLAYING_KEY, String(playing));
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
