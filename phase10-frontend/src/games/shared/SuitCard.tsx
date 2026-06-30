import React from 'react';

export type SuitSymbol = '♠' | '♥' | '♦' | '♣';

const SUIT_COLOR: Record<SuitSymbol, string> = {
  '♠': 'suit-card__suit--black',
  '♣': 'suit-card__suit--black',
  '♥': 'suit-card__suit--red',
  '♦': 'suit-card__suit--red',
};

export function rankLabel(rank: number): string {
  if (rank === 1 || rank === 14) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

interface SuitCardProps {
  rank: number;
  suit: SuitSymbol;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
  className?: string;
}

export const SuitCard: React.FC<SuitCardProps> = ({
  rank,
  suit,
  selected,
  disabled,
  small,
  faceDown,
  onClick,
  className = '',
}) => {
  const sizeClass = small ? 'playing-card--suit-sm' : 'playing-card--suit-md';
  const interactive = onClick && !disabled && !faceDown;
  const colorClass = SUIT_COLOR[suit];
  const label = rankLabel(rank);

  return (
    <button
      type="button"
      disabled={disabled || faceDown}
      onClick={onClick}
      className={`playing-card playing-card--suit ${sizeClass} ${
        selected ? 'playing-card--selected ring-2 ring-success' : ''
      } ${interactive ? 'cursor-pointer hover:-translate-y-1' : ''} ${
        faceDown ? 'playing-card--back' : ''
      } ${className}`}
    >
      {faceDown ? (
        <div className="suit-card__face-down">?</div>
      ) : (
        <>
          <div className={`suit-card__corner suit-card__corner--tl ${colorClass}`}>
            <span className="suit-card__rank">{label}</span>
            <span className="suit-card__pip">{suit}</span>
          </div>

          <div className={`suit-card__center ${colorClass}`} aria-hidden>
            {suit}
          </div>

          <div className={`suit-card__corner suit-card__corner--br ${colorClass}`}>
            <span className="suit-card__rank">{label}</span>
            <span className="suit-card__pip">{suit}</span>
          </div>
        </>
      )}
    </button>
  );
};
