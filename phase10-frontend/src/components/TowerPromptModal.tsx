import React from 'react';
import { Ban, Target, Palette, Layers, X } from 'lucide-react';
import { Card, Player } from '../types';
import { PlayerAvatar } from './PlayerAvatar';
import { getPlayingCardShellClass } from '../lib/cards';
import { StandardPlayingCardFace, TowerPowerCardFace } from './PlayingCardFace';

export type TowerPromptState =
  | { kind: 'player'; title: string; subtitle?: string; players: Player[]; floorLabel: (n: number) => string }
  | { kind: 'color'; title: string; subtitle?: string }
  | { kind: 'discard'; title: string; subtitle?: string; cards: Card[] };

interface TowerPromptModalProps {
  prompt: TowerPromptState;
  onSelectPlayer: (player: Player) => void;
  onSelectColor: (color: Card['color']) => void;
  onSelectDiscard: (card: Card) => void;
  onCancel: () => void;
}

const COLOR_OPTIONS: Array<{ id: Card['color']; label: string; dotClass: string }> = [
  { id: 'red', label: 'Vermelho', dotClass: 'bg-red-600' },
  { id: 'yellow', label: 'Amarelo', dotClass: 'bg-yellow-500' },
  { id: 'green', label: 'Verde', dotClass: 'bg-green-600' },
  { id: 'blue', label: 'Azul', dotClass: 'bg-blue-600' },
];

function DiscardCardButton({ card, onClick }: { card: Card; onClick: () => void }) {
  const isPower = card.type === 'power';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`playing-card playing-card--prompt-discard text-left ${getPlayingCardShellClass(card)}`}
    >
      {isPower ? (
        <TowerPowerCardFace card={card} />
      ) : (
        <StandardPlayingCardFace card={card} centerSize="discard" />
      )}
    </button>
  );
}

export const TowerPromptModal: React.FC<TowerPromptModalProps> = ({
  prompt,
  onSelectPlayer,
  onSelectColor,
  onSelectDiscard,
  onCancel,
}) => {
  const icon =
    prompt.kind === 'player' ? (
      <Target className="w-6 h-6" />
    ) : prompt.kind === 'color' ? (
      <Palette className="w-6 h-6" />
    ) : (
      <Layers className="w-6 h-6" />
    );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-surface border border-default rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 bg-accent-soft border border-accent/30 text-accent rounded-full flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-primary leading-tight">{prompt.title}</h3>
              {prompt.subtitle && (
                <p className="text-xs text-muted mt-1">{prompt.subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-muted hover:text-secondary hover:bg-surface-muted transition-colors shrink-0"
            aria-label="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {prompt.kind === 'player' && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {prompt.players.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => onSelectPlayer(player)}
                className="w-full p-3 rounded-xl bg-surface-muted hover:bg-surface-raised text-secondary hover:text-primary flex items-center justify-between border border-default/80 transition-colors cursor-pointer text-xs font-bold"
              >
                <div className="flex items-center space-x-2">
                  <PlayerAvatar avatar={player.avatar} color={player.color} size={28} isBot={player.isBot} />
                  <span style={{ color: player.color }}>{player.name}</span>
                  {player.isBot && <span className="text-[10px] text-muted font-normal">(IA)</span>}
                </div>
                <div className="text-muted font-mono text-[10px]">
                  {prompt.floorLabel(player.phase)} • {player.score} pts
                </div>
              </button>
            ))}
          </div>
        )}

        {prompt.kind === 'color' && (
          <div className="grid grid-cols-2 gap-2">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color.id}
                type="button"
                onClick={() => onSelectColor(color.id)}
                className="p-3 rounded-xl bg-surface-muted hover:bg-surface-raised border border-default/80 transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold text-secondary hover:text-primary"
              >
                <span className={`w-4 h-4 rounded-full ${color.dotClass} shrink-0`} />
                {color.label}
              </button>
            ))}
          </div>
        )}

        {prompt.kind === 'discard' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto p-1">
            {prompt.cards.map((card) => (
              <DiscardCardButton key={card.id} card={card} onClick={() => onSelectDiscard(card)} />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2.5 bg-surface-raised hover:bg-surface-muted text-secondary rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Ban className="w-3.5 h-3.5" />
          Cancelar
        </button>
      </div>
    </div>
  );
};
