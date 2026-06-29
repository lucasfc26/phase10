import React, { useState } from 'react';
import { X, BookOpen, Award, Layers, AlertCircle, HelpCircle } from 'lucide-react';
import { STANDARD_PHASES } from '../types';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'how' | 'phases' | 'scoring' | 'specials'>('how');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-purple-900/40 to-indigo-900/40">
          <div className="flex items-center space-x-3">
            <BookOpen className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold tracking-wide bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">
              Regras do Phase 10
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('how')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 whitespace-nowrap flex items-center space-x-2 transition-all ${
              activeTab === 'how'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Como Jogar</span>
          </button>
          <button
            onClick={() => setActiveTab('phases')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 whitespace-nowrap flex items-center space-x-2 transition-all ${
              activeTab === 'phases'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>As 10 Fases</span>
          </button>
          <button
            onClick={() => setActiveTab('scoring')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 whitespace-nowrap flex items-center space-x-2 transition-all ${
              activeTab === 'scoring'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Pontuação</span>
          </button>
          <button
            onClick={() => setActiveTab('specials')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 whitespace-nowrap flex items-center space-x-2 transition-all ${
              activeTab === 'specials'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Cartas Especiais</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'how' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-purple-300">Objetivo do Jogo</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                O Phase 10 é um jogo de cartas do estilo 'Rummy', jogado em várias rodadas. O objetivo é ser o primeiro jogador a completar as <strong className="text-white">10 Fases específicas</strong>. Se múltiplos jogadores completarem a Fase 10 na mesma rodada, o jogador com a <strong className="text-emerald-400">menor pontuação acumulada</strong> é coroado vencedor!
              </p>

              <h3 className="text-lg font-bold text-purple-300 mt-6">Fluxo do Turno</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 p-4 border border-slate-700/60 rounded-xl">
                  <div className="text-purple-400 font-bold text-lg mb-2">1. COMPRAR</div>
                  <p className="text-xs text-slate-400">
                    Obrigatório iniciar seu turno comprando uma carta. Você pode comprar a carta oculta do <strong className="text-slate-200">Monte de Compra</strong> ou a carta visível do <strong className="text-slate-200">Monte de Descarte</strong>.
                  </p>
                </div>
                <div className="bg-slate-800/50 p-4 border border-slate-700/60 rounded-xl">
                  <div className="text-purple-400 font-bold text-lg mb-2">2. JOGAR</div>
                  <p className="text-xs text-slate-400">
                    Se você tiver as cartas necessárias para a sua Fase atual em mãos, pode <strong className="text-amber-400">Baixar a Fase</strong> na mesa. Uma vez baixada, você pode <strong className="text-amber-400">Bater (Hit)</strong> cartas da sua mão em qualquer Fase na mesa.
                  </p>
                </div>
                <div className="bg-slate-800/50 p-4 border border-slate-700/60 rounded-xl">
                  <div className="text-purple-400 font-bold text-lg mb-2">3. DESCARTAR</div>
                  <p className="text-xs text-slate-400">
                    Para finalizar seu turno, você deve <strong className="text-rose-400">descartar uma carta</strong> de sua mão no Monte de Descarte. Se descartar um "Skip", você escolhe qual oponente pulará a próxima vez.
                  </p>
                </div>
              </div>

              <h3 className="text-lg font-bold text-purple-300 mt-6">Avançando de Fase</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Você só pode trabalhar em uma Fase de cada vez. Por exemplo, se você está na Fase 1, você tenta completá-la. Na rodada que você baixar a Fase 1 com sucesso, você passará a buscar a Fase 2 na próxima rodada. Os jogadores que não baixarem suas respectivas Fases na rodada atual continuam tentando a mesma fase na rodada seguinte.
              </p>
              <p className="text-sm text-slate-300 leading-relaxed mt-3">
                Uma rodada também pode encerrar quando <strong className="text-emerald-400">todos os participantes baixarem suas fases</strong> — nesse caso, <strong className="text-white">todos avançam</strong> para a próxima fase.
              </p>
            </div>
          )}

          {activeTab === 'phases' && (
            <div className="space-y-4">
              <div className="bg-indigo-950/40 border border-indigo-900/60 p-4 rounded-xl flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-200">
                  <strong className="text-white">Definições Importantes:</strong><br/>
                  • <strong className="text-amber-300">Trinca / Quadra / Grupo:</strong> Cartas de mesmo valor numérico (ex: três 8s, quatro 10s). Cores não importam.<br/>
                  • <strong className="text-amber-300">Sequência:</strong> Cartas com valores consecutivos (ex: 2, 3, 4, 5, 6). Cores não importam.<br/>
                  • <strong className="text-amber-300">Cor:</strong> Cartas que possuem o mesmo naipe colorido (ex: 7 cartas vermelhas de qualquer valor).
                </div>
              </div>

              <div className="divide-y divide-slate-800">
                {STANDARD_PHASES.map((phase) => (
                  <div key={phase.id} className="py-3 flex items-center justify-between space-x-4">
                    <div className="flex items-center space-x-3">
                      <span className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-sm">
                        {phase.id}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm">{phase.name}</h4>
                        <p className="text-xs text-slate-400">{phase.description}</p>
                      </div>
                    </div>
                    <span className="text-xs bg-slate-800 text-slate-300 py-1 px-2.5 rounded-full font-mono border border-slate-700">
                      {phase.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'scoring' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-purple-300">Fim de uma Rodada</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Uma rodada termina de duas formas:
              </p>
              <ul className="text-sm text-slate-300 leading-relaxed list-disc list-inside space-y-1 mt-2">
                <li>Quando <strong className="text-emerald-400">todos os jogadores baixam suas fases</strong> — todos avançam para a próxima fase.</li>
                <li>Quando um jogador descarta a <strong className="text-rose-400">última carta</strong> da mão (conhecido como "Bater" ou "Sair") — apenas quem baixou a fase avança.</li>
              </ul>

              <h3 className="text-lg font-bold text-purple-300 mt-6">Calculando os Pontos</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                As cartas que sobrarem na mão de todos os outros jogadores são contadas como pontos de penalidade. Seu objetivo é ter a menor pontuação possível ao final do jogo!
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                  <div className="text-2xl font-black text-slate-200">5 pts</div>
                  <div className="text-xs text-slate-400 mt-1">Cartas de 1 a 9</div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                  <div className="text-2xl font-black text-amber-400">10 pts</div>
                  <div className="text-xs text-slate-400 mt-1">Cartas de 10 a 12</div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                  <div className="text-2xl font-black text-rose-400">15 pts</div>
                  <div className="text-xs text-slate-400 mt-1">Carta Skip (Pular)</div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                  <div className="text-2xl font-black text-emerald-400">25 pts</div>
                  <div className="text-xs text-slate-400 mt-1">Carta Wild (Curinga)</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'specials' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0 bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
                <div className="w-16 h-24 shrink-0 rounded-xl border-2 border-dashed border-emerald-500/80 bg-slate-900 flex items-center justify-center font-bold text-emerald-400 text-2xl shadow-lg shadow-emerald-950/20">
                  W
                </div>
                <div className="space-y-2">
                  <h4 className="text-lg font-bold text-emerald-400">Curingas (Wild Cards)</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Os Curingas podem ser usados para representar qualquer número ou cor em uma Fase. 
                    Por exemplo, em uma sequência de 4 cartas (como 3, 4, 5, 6), um Curinga pode ser usado como 3, 4, 5 ou 6. 
                    Em uma fase de cor (Fase 8), ele pode representar qualquer cor.
                  </p>
                  <p className="text-xs text-amber-300">
                    💡 <em>Nota: Pelo menos uma carta "natural" deve ser usada em cada grupo/fase baixada.</em>
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0 bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
                <div className="w-16 h-24 shrink-0 rounded-xl border-2 border-dashed border-rose-500/80 bg-slate-900 flex items-center justify-center font-bold text-rose-400 text-2xl shadow-lg shadow-rose-950/20">
                  S
                </div>
                <div className="space-y-2">
                  <h4 className="text-lg font-bold text-rose-400">Cartas Skip (Pular Turno)</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Uma carta Skip é usada para fazer com que outro jogador perca o seu turno.
                    Ao <strong className="text-white">descartar</strong> um Skip no seu turno, você imediatamente escolhe um jogador da mesa. Esse jogador será pulado na próxima vez dele.
                  </p>
                  <p className="text-xs text-slate-400">
                    • Um jogador pulado recupera o estado normal após ser pulado.<br/>
                    • Não podem ser usadas em grupos baixados na mesa.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-purple-900/30 text-white"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
