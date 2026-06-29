import React from 'react';
import { Eye, Sparkles } from 'lucide-react';
import { Player } from '../types';

interface PassAndPlayTransitionProps {
  player: Player;
  onConfirm: () => void;
}

export const PassAndPlayTransition: React.FC<PassAndPlayTransitionProps> = ({ player, onConfirm }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        
        {/* Decorative ambient background */}
        <div 
          className="absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-25"
          style={{ backgroundColor: player.color }}
        />
        <div 
          className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-25"
          style={{ backgroundColor: player.color }}
        />

        <div className="relative space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-inner border border-slate-700 bg-slate-950 animate-bounce">
            {player.avatar}
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase font-extrabold tracking-widest text-slate-500">Próximo Turno</p>
            <h2 className="text-2xl font-black text-white" style={{ color: player.color }}>
              {player.name}
            </h2>
          </div>

          <div className="inline-flex items-center space-x-1 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-slate-400 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Fase Atual: <strong className="text-white">Fase {player.phase}</strong></span>
          </div>

          <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-xs text-slate-400 leading-relaxed text-left">
            <strong className="text-slate-200 block mb-1">🔒 Turno Secreto</strong>
            Para manter o jogo justo, por favor passe o dispositivo/celular para <strong className="text-white">{player.name}</strong>. Outros jogadores devem desviar o olhar!
          </div>
        </div>

        <button
          onClick={onConfirm}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold tracking-wider shadow-lg shadow-indigo-950/50 hover:shadow-indigo-950/70 transition-all flex items-center justify-center space-x-2 text-sm hover:scale-[1.02] active:scale-[0.98]"
        >
          <Eye className="w-4 h-4 text-white" />
          <span>ESTOU PRONTO, MOSTRAR CARTAS!</span>
        </button>
      </div>
    </div>
  );
};
