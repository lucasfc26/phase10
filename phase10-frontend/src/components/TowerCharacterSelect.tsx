import React from 'react';
import { Shield, Sparkles } from 'lucide-react';
import { Player } from '../types';
import { PlayerAvatar } from './PlayerAvatar';
import {
  TOWER_CHARACTER_CLASSES,
  type TowerCharacterClass,
} from '../games/towerMaster/characters';

interface TowerCharacterSelectProps {
  player: Player;
  onSelect: (classId: TowerCharacterClass) => void;
  subtitle?: string;
}

export const TowerCharacterSelect: React.FC<TowerCharacterSelectProps> = ({
  player,
  onSelect,
  subtitle,
}) => {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-overlay backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-surface border border-default rounded-2xl p-6 shadow-2xl space-y-5 my-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-soft/40 border border-accent/25 rounded-full text-accent text-[10px] font-extrabold uppercase tracking-wide">
            <Shield className="w-3.5 h-3.5" />
            Escolha de personagem
          </div>
          <div className="flex flex-col items-center gap-2">
            <PlayerAvatar avatar={player.avatar} color={player.color} size={56} isBot={player.isBot} />
            <h2 className="text-xl font-black text-primary" style={{ color: player.color }}>
              {player.name}
            </h2>
          </div>
          <p className="text-xs text-muted max-w-md mx-auto">
            {subtitle ?? 'Escolha uma classe antes de subir a torre. Cada personagem tem uma habilidade passiva e um poder exclusivo.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOWER_CHARACTER_CLASSES.map((character) => (
            <button
              key={character.id}
              type="button"
              onClick={() => onSelect(character.id)}
              className="tower-class-card group text-left"
            >
              <div className="tower-class-card__art">
                <img src={character.imageSrc} alt="" draggable={false} />
              </div>
              <div className="tower-class-card__body">
                <h3 className="tower-class-card__name">{character.name}</h3>
                <p className="tower-class-card__line">
                  <Sparkles className="w-3 h-3 shrink-0 text-accent" />
                  <span>{character.passive}</span>
                </p>
                <p className="tower-class-card__line tower-class-card__line--exclusive">
                  <span>{character.exclusive}</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface TowerCharacterBadgeProps {
  classId?: TowerCharacterClass;
  compact?: boolean;
}

export function TowerCharacterBadge({ classId, compact = false }: TowerCharacterBadgeProps) {
  const info = TOWER_CHARACTER_CLASSES.find((c) => c.id === classId);
  if (!info) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-default bg-surface-muted text-secondary font-bold ${
        compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
      }`}
      title={info.passive}
    >
      <img src={info.imageSrc} alt="" className={compact ? 'w-3 h-3 object-contain' : 'w-3.5 h-3.5 object-contain'} />
      {info.name}
    </span>
  );
}
