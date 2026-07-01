import React, { useState } from 'react';
import {
  Wand2,
  Ban,
  Lightbulb,
  X,
  BookOpen,
  Award,
  Layers,
  AlertCircle,
  HelpCircle,
  Swords,
  Spade,
  Building2,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import type { RulesSection } from '../lib/i18n/types';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GameId = 'phase10' | 'truco' | 'poker' | 'tower';
type Phase10Tab = 'how' | 'phases' | 'scoring' | 'specials';

const tabClass = (active: boolean) =>
  `py-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
    active
      ? 'border-accent text-accent bg-accent-soft/20'
      : 'border-transparent text-muted hover:text-secondary'
  }`;

const gameTabClass = (active: boolean) =>
  `py-2 px-3 font-semibold text-xs rounded-lg whitespace-nowrap flex items-center gap-1.5 transition-colors ${
    active
      ? 'bg-accent text-on-accent'
      : 'bg-surface-muted text-muted hover:text-secondary border border-default'
  }`;

function RulesSections({ sections }: { sections: RulesSection[] }) {
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.title} className="space-y-2">
          <h3 className="text-base font-semibold text-accent">{section.title}</h3>
          {section.paragraphs.map((p, i) => (
            <p key={i} className="text-sm text-secondary leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const [activeGame, setActiveGame] = useState<GameId>('tower');
  const [phase10Tab, setPhase10Tab] = useState<Phase10Tab>('how');
  const p10 = t.rules.phase10;

  if (!isOpen) return null;

  const games: { id: GameId; label: string; icon: React.ReactNode }[] = [
    { id: 'tower', label: t.rules.tabTower, icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'phase10', label: t.rules.tabPhase10, icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'truco', label: t.rules.tabTruco, icon: <Swords className="w-3.5 h-3.5" /> },
    { id: 'poker', label: t.rules.tabPoker, icon: <Spade className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl h-[85vh] bg-surface border border-default rounded-xl flex flex-col shadow-2xl text-primary overflow-hidden">
        <div className="p-5 border-b border-default flex justify-between items-center bg-app">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-primary">{t.rules.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-raised rounded-lg text-muted hover:text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-default bg-app flex gap-2 overflow-x-auto">
          {games.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => setActiveGame(game.id)}
              className={gameTabClass(activeGame === game.id)}
            >
              {game.icon}
              <span>{game.label}</span>
            </button>
          ))}
        </div>

        {activeGame === 'phase10' && (
          <div className="flex border-b border-default bg-app px-2 overflow-x-auto">
            <button onClick={() => setPhase10Tab('how')} className={tabClass(phase10Tab === 'how')}>
              <HelpCircle className="w-4 h-4" />
              <span>{p10.tabHow}</span>
            </button>
            <button onClick={() => setPhase10Tab('phases')} className={tabClass(phase10Tab === 'phases')}>
              <Layers className="w-4 h-4" />
              <span>{p10.tabPhases}</span>
            </button>
            <button onClick={() => setPhase10Tab('scoring')} className={tabClass(phase10Tab === 'scoring')}>
              <Award className="w-4 h-4" />
              <span>{p10.tabScoring}</span>
            </button>
            <button onClick={() => setPhase10Tab('specials')} className={tabClass(phase10Tab === 'specials')}>
              <AlertCircle className="w-4 h-4" />
              <span>{p10.tabSpecials}</span>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeGame === 'phase10' && phase10Tab === 'how' && (
            <div className="space-y-4 text-sm text-secondary leading-relaxed">
              <h3 className="text-base font-semibold text-accent">{p10.objectiveTitle}</h3>
              <p>{p10.objectiveBody}</p>

              <h3 className="text-base font-semibold text-accent pt-2">{p10.turnTitle}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {p10.turnSteps.map(([title, body]) => (
                  <div key={title} className="bg-app border border-default p-4 rounded-lg">
                    <div className="text-accent font-semibold text-sm mb-1">{title}</div>
                    <p className="text-xs text-muted">{body}</p>
                  </div>
                ))}
              </div>

              <h3 className="text-base font-semibold text-accent pt-2">{p10.advanceTitle}</h3>
              <p>{p10.advanceBody}</p>
            </div>
          )}

          {activeGame === 'phase10' && phase10Tab === 'phases' && (
            <div className="space-y-4">
              <div className="bg-app border border-default p-4 rounded-lg flex gap-3 text-xs text-muted">
                <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div>{p10.phasesHint}</div>
              </div>
              <div className="divide-y divide-default">
                {t.phases.map((phase, index) => (
                  <div key={phase.name} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-surface-raised border border-default flex items-center justify-center font-semibold text-sm text-accent">
                        {index + 1}
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

          {activeGame === 'phase10' && phase10Tab === 'scoring' && (
            <div className="space-y-4 text-sm text-secondary">
              <p>{p10.scoringIntro}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {p10.scoringCards.map(([pts, label]) => (
                  <div key={label} className="bg-app border border-default p-3 rounded-lg text-center">
                    <div className="text-xl font-bold text-secondary">{pts} pts</div>
                    <div className="text-xs text-muted mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeGame === 'phase10' && phase10Tab === 'specials' && (
            <div className="space-y-4">
              <div className="flex gap-4 bg-app border border-default p-4 rounded-lg">
                <div className="w-14 h-20 shrink-0 rounded-lg border border-emerald-800 bg-success-muted flex items-center justify-center text-success">
                  <Wand2 className="w-6 h-6" />
                </div>
                <div className="text-xs text-muted space-y-2">
                  <h4 className="text-sm font-semibold text-success">{p10.wildTitle}</h4>
                  <p>{p10.wildBody}</p>
                  <p className="flex items-start gap-1.5 text-accent/90">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {p10.wildTip}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 bg-app border border-default p-4 rounded-lg">
                <div className="w-14 h-20 shrink-0 rounded-lg border border-rose-800 bg-danger-muted flex items-center justify-center text-danger">
                  <Ban className="w-6 h-6" />
                </div>
                <div className="text-xs text-muted space-y-2">
                  <h4 className="text-sm font-semibold text-danger">{p10.skipTitle}</h4>
                  <p>{p10.skipBody}</p>
                </div>
              </div>
            </div>
          )}

          {activeGame === 'truco' && <RulesSections sections={t.rules.truco} />}

          {activeGame === 'poker' && <RulesSections sections={t.rules.poker} />}

          {activeGame === 'tower' && (
            <div className="space-y-5">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-4 rounded-lg flex gap-3 text-xs text-amber-800 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{t.rules.towerComingSoon}</p>
              </div>
              <RulesSections sections={t.rules.tower} />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-default bg-app flex justify-end">
          <button onClick={onClose} className="px-5 py-2 btn-primary text-sm font-medium">
            {t.rules.close}
          </button>
        </div>
      </div>
    </div>
  );
};
