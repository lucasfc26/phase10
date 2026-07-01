import { useCallback, useEffect, useState } from 'react';
import { GameRoom } from './types';
import { Lobby } from './components/Lobby';
import { RulesModal } from './components/RulesModal';
import { HomeScreen } from './components/HomeScreen';
import { SettingsModal } from './components/SettingsModal';
import { LegalPageModal, type LegalPageType } from './components/LegalPageModal';
import { CookieConsent } from './components/CookieConsent';
import { RoomSession } from './services/onlineApi';
import { emitRoomLeave } from './services/onlineSocket';
import { applyTheme, type Theme } from './lib/theme';
import { applyCardFaceStyle, getStoredCardFaceStyle, type CardFaceStyle } from './lib/cardFace';
import { I18nProvider, type Locale } from './lib/i18n';
import {
  getStoredLocale,
  getStoredSoundEnabled,
  setStoredLocale,
  setStoredSoundEnabled,
} from './lib/settings';
import {
  createDefaultProfile,
  getStoredPlayerProfile,
  setStoredPlayerProfile,
  warmPlayerProfileCache,
  type SavedPlayerProfile,
} from './lib/playerProfile';
import { renderCharacter } from './lib/characterAvatar';
import { ActiveGameState, GameRouter } from './games/GameRouter';
import type { GamePlayerProfile } from './games/types';

type AppProps = {
  initialTheme: Theme;
};

type AppView = 'home' | 'lobby';

function App({ initialTheme }: AppProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [cardFaceStyle, setCardFaceStyle] = useState<CardFaceStyle>(() => getStoredCardFaceStyle() ?? 'mono');
  const [locale, setLocale] = useState<Locale>(() => getStoredLocale());
  const [soundEnabled, setSoundEnabled] = useState(() => getStoredSoundEnabled());
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
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          locale={locale}
          onLocaleChange={handleLocaleChange}
          soundEnabled={soundEnabled}
          onSoundChange={handleSoundChange}
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
