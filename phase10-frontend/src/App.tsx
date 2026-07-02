import { useCallback, useEffect, useRef, useState } from 'react';
import { GameRoom } from './types';
import { Lobby } from './components/Lobby';
import { RulesModal } from './components/RulesModal';
import { HomeScreen } from './components/HomeScreen';
import { SettingsModal } from './components/SettingsModal';
import { LegalPageModal, type LegalPageType } from './components/LegalPageModal';
import { CookieConsent } from './components/CookieConsent';
import { MusicPlayerButton } from './components/MusicPlayerButton';
import { RoomSession } from './services/onlineApi';
import { emitRoomLeave } from './services/onlineSocket';
import { applyTheme, type Theme } from './lib/theme';
import { applyCardFaceStyle, getStoredCardFaceStyle, type CardFaceStyle } from './lib/cardFace';
import { I18nProvider, type Locale } from './lib/i18n';
import {
  getStoredLocale,
  getStoredMusicTrack,
  getStoredMusicVolume,
  getStoredMusicPlaying,
  getStoredSoundEnabled,
  setStoredMusicTrack,
  setStoredMusicVolume,
  setStoredMusicPlaying,
  setStoredLocale,
  setStoredSoundEnabled,
  type MusicTrack,
} from './lib/settings';
import {
  createDefaultProfile,
  getStoredPlayerProfile,
  setStoredPlayerProfile,
  warmPlayerProfileCache,
  type SavedPlayerProfile,
} from './lib/playerProfile';
import { renderCharacter } from './lib/characterAvatar';
import { resolveEffectiveMusicTrack, MUSIC_SRC } from './lib/music';
import { ActiveGameState, GameRouter } from './games/GameRouter';
import type { GamePlayerProfile } from './games/types';

type AppProps = {
  initialTheme: Theme;
};

type AppView = 'home' | 'lobby';

function App({ initialTheme }: AppProps) {
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [cardFaceStyle, setCardFaceStyle] = useState<CardFaceStyle>(() => getStoredCardFaceStyle() ?? 'mono');
  const [locale, setLocale] = useState<Locale>(() => getStoredLocale());
  const [soundEnabled, setSoundEnabled] = useState(() => getStoredSoundEnabled());
  const [musicTrack, setMusicTrack] = useState<MusicTrack>(() => getStoredMusicTrack());
  const [musicVolume, setMusicVolume] = useState(() => getStoredMusicVolume());
  const [musicPlaying, setMusicPlaying] = useState(() => getStoredMusicPlaying());
  const [hasPhasesOnTable, setHasPhasesOnTable] = useState(false);
  const [view, setView] = useState<AppView>('home');
  const [lobbyInitialStep, setLobbyInitialStep] = useState<'profile' | 'room_setup'>('room_setup');
  const [activeGame, setActiveGame] = useState<ActiveGameState | null>(null);
  const [playerProfile, setPlayerProfile] = useState<GamePlayerProfile | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [legalPage, setLegalPage] = useState<LegalPageType | null>(null);
  const [savedProfile, setSavedProfile] = useState<SavedPlayerProfile>(
    () => getStoredPlayerProfile() ?? createDefaultProfile(),
  );

  const handleProfileChange = useCallback((profile: SavedPlayerProfile) => {
    setSavedProfile(profile);
    setStoredPlayerProfile(profile);
    warmPlayerProfileCache(profile);
    void renderCharacter(profile.character, 88, profile.color);
    void renderCharacter(profile.character, 220, profile.color);
  }, []);

  useEffect(() => {
    warmPlayerProfileCache(savedProfile);
    void renderCharacter(savedProfile.character, 88, savedProfile.color);
  }, []);

  const handleThemeChange = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };

  const handleCardFaceStyleChange = (next: CardFaceStyle) => {
    applyCardFaceStyle(next);
    setCardFaceStyle(next);
  };

  const handleLocaleChange = (next: Locale) => {
    setStoredLocale(next);
    setLocale(next);
  };

  const handleSoundChange = (enabled: boolean) => {
    setStoredSoundEnabled(enabled);
    setSoundEnabled(enabled);
  };

  const handleMusicTrackChange = (track: MusicTrack) => {
    setStoredMusicTrack(track);
    setMusicTrack(track);
  };

  const handleMusicVolumeChange = (volume: number) => {
    setStoredMusicVolume(volume);
    setMusicVolume(volume);
  };

  const toggleMusicPlayback = () => {
    const next = !musicPlaying;
    setStoredMusicPlaying(next);
    setMusicPlaying(next);
  };

  const musicEnabled = musicTrack !== 'none';

  useEffect(() => {
    const audio = musicRef.current;
    if (!audio) return;

    audio.volume = musicVolume;
    audio.loop = true;

    const effective = resolveEffectiveMusicTrack(musicTrack, hasPhasesOnTable);
    if (!effective) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    const src = MUSIC_SRC[effective];

    if (audio.getAttribute('src') !== src) {
      audio.src = src;
      audio.load();
    }

    if (musicPlaying) {
      void audio.play().catch(() => {
        // Browser may block autoplay until the first user interaction.
      });
    } else {
      audio.pause();
    }
  }, [musicTrack, musicVolume, hasPhasesOnTable, musicPlaying]);

  useEffect(() => {
    const audio = musicRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (!musicPlaying || musicTrack === 'none') return;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [musicPlaying, musicTrack]);

  const handleStartGame = (
    game: ActiveGameState,
    profile: GamePlayerProfile,
  ) => {
    setPlayerProfile(profile);
    setActiveGame(game);
  };

  const handleExitGame = () => {
    if (activeGame?.session) {
      emitRoomLeave();
    }
    setHasPhasesOnTable(false);
    setActiveGame(null);
    setPlayerProfile(null);
    setView('home');
  };

  return (
    <I18nProvider locale={locale}>
      <div className="min-h-screen bg-app text-primary flex flex-col font-sans">
        <div className="absolute top-0 inset-x-0 h-72 bg-header-fade pointer-events-none -z-10" />

        {activeGame && playerProfile ? (
          <main className="flex-1 py-4">
            <GameRouter
              game={activeGame}
              playerProfile={playerProfile}
              onExit={handleExitGame}
              initialSoundEnabled={soundEnabled}
              onPhasesOnTableChange={setHasPhasesOnTable}
            />
          </main>
        ) : view === 'home' ? (
          <HomeScreen
            profile={savedProfile}
            onStart={() => {
              setLobbyInitialStep('room_setup');
              setView('lobby');
            }}
            onCustomize={() => {
              setLobbyInitialStep('profile');
              setView('lobby');
            }}
            onRules={() => setIsRulesOpen(true)}
            onSettings={() => setIsSettingsOpen(true)}
            onOpenLegal={setLegalPage}
          />
        ) : (
          <section className="flex-1 py-2">
            <Lobby
              key={lobbyInitialStep}
              initialStep={lobbyInitialStep}
              initialProfile={savedProfile}
              onProfileChange={handleProfileChange}
              onStartGame={handleStartGame}
              onBackHome={() => setView('home')}
            />
          </section>
        )}

        <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
        <LegalPageModal page={legalPage} onClose={() => setLegalPage(null)} />
        <CookieConsent onLearnMore={() => setLegalPage('privacy')} />
        <MusicPlayerButton
          playing={musicPlaying}
          disabled={!musicEnabled}
          onToggle={toggleMusicPlayback}
        />
        <audio ref={musicRef} loop preload="auto" />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          locale={locale}
          onLocaleChange={handleLocaleChange}
          soundEnabled={soundEnabled}
          onSoundChange={handleSoundChange}
          musicTrack={musicTrack}
          onMusicTrackChange={handleMusicTrackChange}
          musicVolume={musicVolume}
          onMusicVolumeChange={handleMusicVolumeChange}
          musicPlaying={musicPlaying}
          onMusicPlayingChange={(playing) => {
            setStoredMusicPlaying(playing);
            setMusicPlaying(playing);
          }}
          musicEnabled={musicEnabled}
          theme={theme}
          onThemeChange={handleThemeChange}
          cardFaceStyle={cardFaceStyle}
          onCardFaceStyleChange={handleCardFaceStyleChange}
        />
      </div>
    </I18nProvider>
  );
}

export default App;
