import React from 'react';
import type { Card } from '../types';
import { CARD_JOKER_SRC, CARD_SKIP_SRC } from '../lib/cardFace';
import {
  cardPipClass,
  getPlayingCardShellClass,
  isTowerPowerCard,
  resolveTowerCardImageSrc,
  towerPowerCategoryLabel,
} from '../lib/cards';

type SpecialCardType = 'wild' | 'skip';

export function SpecialCardIcon({
  type,
  size,
}: {
  type: SpecialCardType;
  size: 'sm' | 'lg' | 'discard';
}) {
  const src = type === 'wild' ? CARD_JOKER_SRC : CARD_SKIP_SRC;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={`playing-card__special-icon playing-card__special-icon--${size}`}
    />
  );
}

function renderPipContent(card: Card) {
  if (card.type === 'wild') return <SpecialCardIcon type="wild" size="sm" />;
  if (card.type === 'skip') return <SpecialCardIcon type="skip" size="sm" />;
  return card.value;
}

function renderCenterContent(card: Card, size: 'lg' | 'discard') {
  const pipClass = cardPipClass(card.color);
  if (card.type === 'wild') return <SpecialCardIcon type="wild" size={size} />;
  if (card.type === 'skip') return <SpecialCardIcon type="skip" size={size} />;
  return (
    <span className={`playing-card__value ${pipClass}`}>
      {card.value}
    </span>
  );
}

type StandardPlayingCardFaceProps = {
  card: Card;
  centerSize?: 'lg' | 'discard';
  bottomExtra?: React.ReactNode;
};

export function StandardPlayingCardFace({
  card,
  centerSize = 'lg',
  bottomExtra,
}: StandardPlayingCardFaceProps) {
  const pipClass = cardPipClass(card.color);

  return (
    <div className="h-full flex flex-col justify-between playing-card__face-inner">
      <div className={`playing-card__pip ${pipClass}`}>
        {renderPipContent(card)}
      </div>

      <div className="playing-card__center text-center flex items-center justify-center">
        {renderCenterContent(card, centerSize)}
      </div>

      <div className="w-full flex justify-between items-end">
        {bottomExtra}
        <span className={`playing-card__pip rotate-180 flex justify-end ${pipClass} ${bottomExtra ? '' : 'w-full'}`}>
          {renderPipContent(card)}
        </span>
      </div>
    </div>
  );
}

type PlayingCardShellProps = {
  card: Card;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'div';
};

export function getPlayingCardClassName(card: Card, extra = ''): string {
  return `playing-card text-left ${getPlayingCardShellClass(card)} ${extra}`.trim();
}

export function TowerPowerCardFace({ card }: { card: Card }) {
  const imageSrc = resolveTowerCardImageSrc(card);

  return (
    <div className="h-full flex flex-col justify-between playing-card__face-inner">
      <div className="playing-card__power-header">
        <span>{towerPowerCategoryLabel(card)}</span>
        <span>{card.powerCost ?? 0}E</span>
      </div>
      <div className="playing-card__power-art">
        {imageSrc && <img src={imageSrc} alt="" draggable={false} />}
      </div>
      <div className="playing-card__power-name">{card.powerName}</div>
    </div>
  );
}

export function PlayingCardShell({
  card,
  className = '',
  children,
  style,
  onClick,
  disabled,
  type = 'div',
}: PlayingCardShellProps) {
  const shellClass = getPlayingCardClassName(card, className);
  const isPower = isTowerPowerCard(card);

  const content = children ?? (
    isPower ? (
      <TowerPowerCardFace card={card} />
    ) : (
      <StandardPlayingCardFace card={card} />
    )
  );

  if (type === 'button') {
    return (
      <button
        type="button"
        className={shellClass}
        style={style}
        onClick={onClick}
        disabled={disabled}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={shellClass} style={style}>
      {content}
    </div>
  );
}
