import { X, Volume2, VolumeX, Moon, Sun, Globe, Layers, Music2 } from 'lucide-react';
import { useI18n, type Locale } from '../lib/i18n';
import { LOCALE_LABELS } from '../lib/settings';
import type { MusicTrack } from '../lib/settings';
import type { Theme } from '../lib/theme';
import type { CardFaceStyle } from '../lib/cardFace';

const LOCALES: Locale[] = ['pt', 'en', 'fr', 'es', 'zh'];

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  soundEnabled: boolean;
  onSoundChange: (enabled: boolean) => void;
  musicTrack: MusicTrack;
  onMusicTrackChange: (track: MusicTrack) => void;
  musicVolume: number;
  onMusicVolumeChange: (volume: number) => void;
  musicPlaying: boolean;
  onMusicPlayingChange: (playing: boolean) => void;
  musicEnabled: boolean;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  cardFaceStyle: CardFaceStyle;
  onCardFaceStyleChange: (style: CardFaceStyle) => void;
};

export function SettingsModal({
  isOpen,
  onClose,
  locale,
  onLocaleChange,
  soundEnabled,
  onSoundChange,
  musicTrack,
  onMusicTrackChange,
  musicVolume,
  onMusicVolumeChange,
  musicPlaying,
  onMusicPlayingChange,
  musicEnabled,
  theme,
  onThemeChange,
  cardFaceStyle,
  onCardFaceStyleChange,
}: SettingsModalProps) {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-surface border border-default rounded-xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-default flex justify-between items-center">
          <h2 className="text-lg font-semibold text-primary">{t.settings.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-surface-raised rounded-lg text-muted hover:text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted mb-3">
              <Globe className="w-4 h-4" />
              {t.settings.language}
            </label>
            <div className="flex flex-wrap gap-2">
              {LOCALES.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => onLocaleChange(loc)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    locale === loc
                      ? 'bg-accent-soft border-accent text-accent'
                      : 'bg-surface-muted border-default text-muted hover:text-secondary'
                  }`}
                >
                  {LOCALE_LABELS[loc]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-secondary">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-accent" />
              ) : (
                <VolumeX className="w-4 h-4 text-muted" />
              )}
              {t.settings.sound}
            </div>
            <button
              type="button"
              onClick={() => onSoundChange(!soundEnabled)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                soundEnabled
                  ? 'bg-accent-soft border-accent text-accent'
                  : 'bg-surface-muted border-default text-muted'
              }`}
            >
              {soundEnabled ? t.settings.soundOn : t.settings.soundOff}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-secondary">
              <Music2 className="w-4 h-4 text-accent" />
              {t.settings.music}
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                {t.settings.musicTrack}
              </span>
              <select
                value={musicTrack}
                onChange={(e) => onMusicTrackChange(e.target.value as MusicTrack)}
                className="bg-surface border border-default rounded-lg px-3 py-1.5 text-xs font-bold text-secondary"
              >
                <option value="none">{t.settings.musicNone}</option>
                <option value="combined">{t.settings.musicCombined}</option>
                <option value="chefe-final">Chefe Final</option>
                <option value="veludo-no-cafe">Veludo No Cafe</option>
              </select>
            </div>
            {musicEnabled && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  {musicPlaying ? t.settings.musicPause : t.settings.musicPlay}
                </span>
                <button
                  type="button"
                  onClick={() => onMusicPlayingChange(!musicPlaying)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    musicPlaying
                      ? 'bg-accent-soft border-accent text-accent'
                      : 'bg-surface-muted border-default text-muted'
                  }`}
                >
                  {musicPlaying ? t.settings.musicPause : t.settings.musicPlay}
                </button>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                {t.settings.musicVolume}
              </span>
              <div className="flex items-center gap-3 min-w-[180px]">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(musicVolume * 100)}
                  onChange={(e) => onMusicVolumeChange(Number(e.target.value) / 100)}
                  className="w-full accent-(--accent)"
                />
                <span className="w-10 text-right text-xs font-semibold text-secondary">
                  {Math.round(musicVolume * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-secondary">
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-accent" />
              ) : (
                <Sun className="w-4 h-4 text-accent" />
              )}
              {t.settings.darkMode}
            </div>
            <button
              type="button"
              onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                theme === 'dark'
                  ? 'bg-accent-soft border-accent text-accent'
                  : 'bg-surface-muted border-default text-muted'
              }`}
            >
              {theme === 'dark' ? t.settings.darkOn : t.settings.darkOff}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-secondary">
              <Layers className="w-4 h-4 text-accent" />
              {t.settings.cardFaceStyle}
            </div>
            <button
              type="button"
              onClick={() => onCardFaceStyleChange(cardFaceStyle === 'art' ? 'mono' : 'art')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                cardFaceStyle === 'art'
                  ? 'bg-accent-soft border-accent text-accent'
                  : 'bg-surface-muted border-default text-muted'
              }`}
            >
              {cardFaceStyle === 'art' ? t.settings.cardFaceArt : t.settings.cardFaceMono}
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-default flex justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2 btn-primary text-sm font-medium">
            {t.settings.close}
          </button>
        </div>
      </div>
    </div>
  );
}
