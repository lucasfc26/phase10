import React, { useEffect, useState } from 'react';
import { Eye, X } from 'lucide-react';
import type { Card } from '../types';
import { cardPipClass, isTowerPowerCard, resolveTowerCardImageSrc } from '../lib/cards';

export type TowerRevealState = {
  title: string;
  cards: Card[];
};

interface TowerRevealModalProps {
  reveal: TowerRevealState;
  onClose: () => void;
  durationSeconds?: number;
}

function RevealCardPreview({ card }: { card: Card }) {
  const imageSrc = resolveTowerCardImageSrc(card);
  const isPower = isTowerPowerCard(card);
  const pipClass = cardPipClass(card.color);

  if (isPower && imageSrc) {
    return (
      <div className={`playing-card playing-card--prompt-discard playing-card--tower playing-card--tower-${card.powerCategory ?? 'attack'}`}>
        <div className="h-full flex flex-col justify-between">
          <div className="playing-card__power-art">
            <img src={imageSrc} alt="" draggable={false} />
          </div>
          <div className="playing-card__power-name">{card.powerName}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`playing-card playing-card--prompt-discard text-left ${card.type === 'wild' ? 'playing-card--wild' : card.type === 'skip' ? 'playing-card--skip' : ''}`}>
      <div className="h-full flex flex-col justify-between">
        <div className={`playing-card__pip ${pipClass}`}>
          {card.type === 'wild' ? '★' : card.type === 'skip' ? '⛔' : card.value}
        </div>
        <div className="playing-card__center flex items-center justify-center">
          <span className={`playing-card__value ${pipClass}`}>
            {card.type === 'wild' ? '★' : card.type === 'skip' ? '⛔' : card.value}
          </span>
        </div>
      </div>
    </div>
  );
}

export const TowerRevealModal: React.FC<TowerRevealModalProps> = ({
  reveal,
  onClose,
  durationSeconds = 10,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);

  useEffect(() => {
    setSecondsLeft(durationSeconds);
    const timeout = window.setTimeout(() => onClose(), durationSeconds * 1000);
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [reveal.title, durationSeconds, onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-overlay backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface border border-accent/40 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 bg-accent-soft border border-accent/30 text-accent rounded-full flex items-center justify-center shrink-0">
              <Eye className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-primary leading-tight">{reveal.title}</h3>
              <p className="text-xs text-muted mt-1">
                Visível por {secondsLeft}s — memorize enquanto puder!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-secondary hover:bg-surface-muted transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {reveal.cards.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-64 overflow-y-auto p-1">
            {reveal.cards.map((card) => (
              <RevealCardPreview key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-6">Nenhuma carta para exibir.</p>
        )}
      </div>
    </div>
  );
};
