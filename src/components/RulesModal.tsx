import React, { useState } from 'react';
import { Wand2, Ban, Lightbulb, X, BookOpen, Award, Layers, AlertCircle, HelpCircle } from 'lucide-react';
import { STANDARD_PHASES } from '../types';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabClass = (active: boolean) =>
  `py-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
    active
      ? 'border-accent text-accent bg-accent-soft/20'
      : 'border-transparent text-muted hover:text-secondary'
  }`;

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'how' | 'phases' | 'scoring' | 'specials'>('how');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl h-[85vh] bg-surface border border-default rounded-xl flex flex-col shadow-2xl text-primary overflow-hidden">
        <div className="p-5 border-b border-default flex justify-between items-center bg-app">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-primary">Regras do Phase 10</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-raised rounded-lg text-muted hover:text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-default bg-app px-2 overflow-x-auto">
          <button onClick={() => setActiveTab('how')} className={tabClass(activeTab === 'how')}>
            <HelpCircle className="w-4 h-4" />
            <span>Como jogar</span>
          </button>
          <button onClick={() => setActiveTab('phases')} className={tabClass(activeTab === 'phases')}>
            <Layers className="w-4 h-4" />
            <span>As 10 fases</span>
          </button>
          <button onClick={() => setActiveTab('scoring')} className={tabClass(activeTab === 'scoring')}>
            <Award className="w-4 h-4" />
            <span>Pontuação</span>
          </button>
          <button onClick={() => setActiveTab('specials')} className={tabClass(activeTab === 'specials')}>
            <AlertCircle className="w-4 h-4" />
            <span>Cartas especiais</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'how' && (
            <div className="space-y-4 text-sm text-secondary leading-relaxed">
              <h3 className="text-base font-semibold text-accent">Objetivo</h3>
              <p>
                Complete as <strong className="text-primary">10 fases</strong> em ordem. Vence quem terminar a fase 10 com a{' '}
                <strong className="text-success">menor pontuação</strong> acumulada.
              </p>

              <h3 className="text-base font-semibold text-accent pt-2">Fluxo do turno</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  ['1. Comprar', 'Compre do monte ou do descarte visível.'],
                  ['2. Jogar', 'Baixe sua fase e/ou bata cartas em fases na mesa.'],
                  ['3. Descartar', 'Descarte uma carta para encerrar o turno.'],
                ].map(([title, body]) => (
                  <div key={title} className="bg-app border border-default p-4 rounded-lg">
                    <div className="text-accent font-semibold text-sm mb-1">{title}</div>
                    <p className="text-xs text-muted">{body}</p>
                  </div>
                ))}
              </div>

              <h3 className="text-base font-semibold text-accent pt-2">Avanço de fase</h3>
              <p>
                Só avança quem baixar a fase na rodada — exceto quando todos baixam, caso em que todos avançam.
              </p>
            </div>
          )}

          {activeTab === 'phases' && (
            <div className="space-y-4">
              <div className="bg-app border border-default p-4 rounded-lg flex gap-3 text-xs text-muted">
                <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div>
                  <strong className="text-secondary">Grupo:</strong> mesmo valor.{' '}
                  <strong className="text-secondary">Sequência:</strong> valores consecutivos.{' '}
                  <strong className="text-secondary">Cor:</strong> mesma cor.
                </div>
              </div>
              <div className="divide-y divide-default">
                {STANDARD_PHASES.map((phase) => (
                  <div key={phase.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-surface-raised border border-default flex items-center justify-center font-semibold text-sm text-accent">
                        {phase.id}
                      </span>
                      <div>
                        <h4 className="font-medium text-primary text-sm">{phase.name}</h4>
                        <p className="text-xs text-muted">{phase.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'scoring' && (
            <div className="space-y-4 text-sm text-secondary">
              <p>A rodada termina quando alguém descarta a última carta ou quando todos baixam suas fases.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['5', 'Cartas 1–9'],
                  ['10', 'Cartas 10–12'],
                  ['15', 'Skip'],
                  ['25', 'Curinga'],
                ].map(([pts, label]) => (
                  <div key={label} className="bg-app border border-default p-3 rounded-lg text-center">
                    <div className="text-xl font-bold text-secondary">{pts} pts</div>
                    <div className="text-xs text-muted mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'specials' && (
            <div className="space-y-4">
              <div className="flex gap-4 bg-app border border-default p-4 rounded-lg">
                <div className="w-14 h-20 shrink-0 rounded-lg border border-emerald-800 bg-success-muted flex items-center justify-center text-success">
                  <Wand2 className="w-6 h-6" />
                </div>
                <div className="text-xs text-muted space-y-2">
                  <h4 className="text-sm font-semibold text-success">Curinga</h4>
                  <p>Substitui qualquer número ou cor. Cada grupo precisa de ao menos uma carta natural.</p>
                  <p className="flex items-start gap-1.5 text-accent/90">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Pelo menos uma carta natural em cada grupo baixado.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 bg-app border border-default p-4 rounded-lg">
                <div className="w-14 h-20 shrink-0 rounded-lg border border-rose-800 bg-danger-muted flex items-center justify-center text-danger">
                  <Ban className="w-6 h-6" />
                </div>
                <div className="text-xs text-muted space-y-2">
                  <h4 className="text-sm font-semibold text-danger">Skip</h4>
                  <p>Ao descartar, escolha um oponente para pular o próximo turno. Não entra em grupos na mesa.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-default bg-app flex justify-end">
          <button onClick={onClose} className="px-5 py-2 btn-primary text-sm font-medium">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
