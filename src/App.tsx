import { useState } from 'react';
import { GameRoom, STANDARD_PHASES } from './types';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { RulesModal } from './components/RulesModal';
import { ThemeToggle } from './components/ThemeToggle';
import { BookOpen, Layers, Bot, Users, ChevronRight } from 'lucide-react';
import { RoomSession } from './services/onlineApi';
import { emitRoomLeave } from './services/onlineSocket';
import type { Theme } from './lib/theme';

type AppProps = {
  initialTheme: Theme;
};

function App({ initialTheme }: AppProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
  const [playerProfile, setPlayerProfile] = useState<{ name: string; avatar: string; color: string } | null>(null);
  const [onlineSession, setOnlineSession] = useState<RoomSession | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);

  const handleStartGame = (
    room: GameRoom,
    profile: { name: string; avatar: string; color: string },
    session?: RoomSession | null,
  ) => {
    setPlayerProfile(profile);
    setActiveRoom(room);
    setOnlineSession(session ?? null);
  };

  const handleExitGame = () => {
    emitRoomLeave();
    setActiveRoom(null);
    setPlayerProfile(null);
    setOnlineSession(null);
  };

  return (
    <div className="min-h-screen bg-app text-primary flex flex-col font-sans">
      <ThemeToggle theme={theme} onThemeChange={setTheme} className="theme-toggle-fixed" />
      <div className="absolute top-0 inset-x-0 h-72 bg-header-fade pointer-events-none -z-10" />

      {activeRoom && playerProfile ? (
        <main className="flex-1 py-4">
          <GameBoard
            initialRoom={activeRoom}
            playerProfile={playerProfile}
            onlineSession={onlineSession}
            onExit={handleExitGame}
          />
        </main>
      ) : (
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex-1">
            <div className="w-full max-w-6xl mx-auto px-4 pt-10 pb-4 text-center space-y-3">
              <div className="inline-flex items-center gap-2 bg-surface border border-default px-4 py-1.5 rounded-full text-xs font-medium text-muted">
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>Online, local e contra bots</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary">
                Phase 10
              </h1>
              <p className="text-sm text-muted max-w-md mx-auto">
                Monte trincas e sequências nas 10 fases clássicas do jogo de cartas.
              </p>
            </div>

            <section className="py-2">
              <Lobby onStartGame={handleStartGame} />
            </section>

            <section className="w-full max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="panel p-5 space-y-3">
                <div className="w-9 h-9 rounded-lg bg-surface-raised border border-default flex items-center justify-center text-accent">
                  <Bot className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-sm text-secondary">Contra bots</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Pratique sozinho com oponentes automáticos que montam fases e usam cartas Skip estrategicamente.
                </p>
              </div>

              <div className="panel p-5 space-y-3">
                <div className="w-9 h-9 rounded-lg bg-surface-raised border border-default flex items-center justify-center text-accent">
                  <Users className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-sm text-secondary">Passar e jogar</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Até 10 jogadores no mesmo dispositivo, com tela de transição que esconde as cartas entre turnos.
                </p>
              </div>

              <div className="panel p-5 space-y-3">
                <div className="w-9 h-9 rounded-lg bg-surface-raised border border-default flex items-center justify-center text-accent">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-sm text-secondary">Regras integradas</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Consulte o manual com as 10 fases, pontuação e cartas especiais a qualquer momento.
                </p>
              </div>
            </section>

            <section className="w-full max-w-5xl mx-auto px-4 pb-14">
              <div className="panel p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-default pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-accent" />
                    <h3 className="font-semibold text-sm text-secondary">As 10 fases</h3>
                  </div>
                  <button
                    onClick={() => setIsRulesOpen(true)}
                    className="text-xs text-accent hover:text-primary font-medium flex items-center gap-1"
                  >
                    Ver detalhes
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {STANDARD_PHASES.map((ph) => (
                    <div
                      key={ph.id}
                      className="bg-surface/80 p-2.5 rounded-lg border border-default text-center space-y-1"
                    >
                      <div className="w-6 h-6 rounded-full bg-surface-raised border border-default flex items-center justify-center font-semibold text-[10px] text-accent mx-auto">
                        {ph.id}
                      </div>
                      <div className="font-medium text-[11px] text-secondary truncate">{ph.name}</div>
                      <p className="text-[10px] text-muted line-clamp-2 leading-tight">{ph.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <footer className="w-full py-5 border-t border-default text-center text-xs text-muted">
            <p>Phase 10 — React, TypeScript e Tailwind</p>
          </footer>
        </div>
      )}

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </div>
  );
}

export default App;
