import { useState } from 'react';
import { GameRoom, STANDARD_PHASES } from './types';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { RulesModal } from './components/RulesModal';
import { BookOpen, Sparkles, Layers, Shield, Play } from 'lucide-react';
import { RoomSession } from './services/onlineApi';
import { disconnectOnlineSocket } from './services/onlineSocket';

function App() {
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
    disconnectOnlineSocket();
    setActiveRoom(null);
    setPlayerProfile(null);
    setOnlineSession(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-purple-600/30 selection:text-purple-300">
      
      {/* Background ambient gradient glow */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-purple-950/20 via-indigo-950/5 to-transparent pointer-events-none -z-10" />

      {activeRoom && playerProfile ? (
        // Game Play Area
        <main className="flex-1 py-4">
          <GameBoard 
            initialRoom={activeRoom} 
            playerProfile={playerProfile} 
            onlineSession={onlineSession}
            onExit={handleExitGame} 
          />
        </main>
      ) : (
        // Welcome and Lobby Selection Area
        <div className="flex-1 flex flex-col justify-between">
          
          {/* Main Content wrapper */}
          <div className="flex-1">
            {/* Landing Hero Section */}
            <div className="w-full max-w-6xl mx-auto px-4 pt-10 pb-4 text-center space-y-4">
              {/* Decorative Banner */}
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-950/50 to-indigo-950/50 border border-purple-800/40 px-4 py-1.5 rounded-full text-xs font-semibold text-purple-300">
                <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
                <span>Simulador Real-Time & Passar-e-Jogar Local</span>
              </div>
            </div>

            {/* Lobby Setup Area */}
            <section className="py-2">
              <Lobby onStartGame={handleStartGame} />
            </section>

            {/* Game Features Section */}
            <section className="w-full max-w-5xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-3 shadow-md hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Shield className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider">Inteligência Artificial</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Os bots são programados para analisar suas mãos de forma inteligente, montar estratégias de sequência, sets de valores ou cores e até mesmo usar cartas Skip contra líderes!
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-3 shadow-md hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Play className="w-5 h-5 fill-indigo-400/20" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider">Segurança Local (Pass & Play)</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Jogue localmente com até 10 amigos com um fluxo de transição inteligente que esconde as cartas da mão, evitando espreitadas e vazamentos de táticas.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-3 shadow-md hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider">Manual & Regras Completas</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Acesse a qualquer momento o manual interativo em português para entender como funcionam as pontuações de cartas, ordem das 10 fases e regras de descarte e compra.
                </p>
              </div>

            </section>

            {/* List of 10 phases Preview on landing page */}
            <section className="w-full max-w-5xl mx-auto px-4 pb-16">
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-purple-400" />
                    <h3 className="font-black text-sm uppercase tracking-wider text-slate-200">As 10 Fases Originais</h3>
                  </div>
                  <button
                    onClick={() => setIsRulesOpen(true)}
                    className="text-xs text-purple-400 hover:text-purple-300 font-bold hover:underline"
                  >
                    Ver detalhes das fases ➔
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {STANDARD_PHASES.map((ph) => (
                    <div key={ph.id} className="bg-slate-950/60 p-3 rounded-xl border border-slate-900 text-center space-y-1 hover:border-slate-800 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center font-black text-[10px] text-purple-400 mx-auto">
                        {ph.id}
                      </div>
                      <div className="font-extrabold text-[11px] text-slate-300 uppercase tracking-tight truncate">
                        {ph.name}
                      </div>
                      <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                        {ph.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </div>

          {/* Footer Metadata */}
          <footer className="w-full py-6 bg-slate-950 border-t border-slate-900 text-center text-xs text-slate-500 space-y-1">
            <p>Phase 10 Multiplayer © 2026. Desenvolvido em React + TypeScript + Tailwind CSS.</p>
            <p className="text-[11px]">Feito com 💜 para os amantes de jogos de tabuleiro e cartas estratégicas.</p>
          </footer>

        </div>
      )}

      {/* Rules Modal Overlay */}
      <RulesModal 
        isOpen={isRulesOpen} 
        onClose={() => setIsRulesOpen(false)} 
      />

    </div>
  );
}

export default App;
