import React from 'react';
import { Eye, Lock, Layers } from 'lucide-react';
import { Player } from '../types';
import { PlayerAvatar } from './PlayerAvatar';

interface PassAndPlayTransitionProps {
  player: Player;
  onConfirm: () => void;
}

export const PassAndPlayTransition: React.FC<PassAndPlayTransitionProps> = ({ player, onConfirm }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4">
      <div className="w-full max-w-md panel p-8 text-center space-y-6 shadow-xl">
        <div className="space-y-4">
          <div className="mx-auto">
            <PlayerAvatar avatar={player.avatar} color={player.color} size={72} isBot={player.isBot} />
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase font-medium tracking-wide text-muted">Próximo turno</p>
            <h2 className="text-2xl font-bold text-primary" style={{ color: player.color }}>
              {player.name}
            </h2>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface border border-default rounded-full text-muted text-xs">
            <Layers className="w-3.5 h-3.5 text-accent" />
            <span>
              Fase atual: <strong className="text-secondary">{player.phase}</strong>
            </span>
          </div>

          <div className="bg-surface border border-default p-4 rounded-lg text-xs text-muted leading-relaxed text-left">
            <div className="flex items-center gap-1.5 text-secondary font-medium mb-1">
              <Lock className="w-3.5 h-3.5" />
              Turno secreto
            </div>
            Passe o dispositivo para <strong className="text-secondary">{player.name}</strong>. Os outros jogadores devem desviar o olhar.
          </div>
        </div>

        <button
          onClick={onConfirm}
          className="w-full py-3.5 btn-primary flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <Eye className="w-4 h-4" />
          Estou pronto — mostrar cartas
        </button>
      </div>
    </div>
  );
};
