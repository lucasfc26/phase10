import type { Card, CardColor, TowerCardCategory } from '../types';
import { TOWER_POWER_CARDS } from '../games/towerMaster/cards';

/** Classes CSS para cor do naipe/número — variam com data-theme no :root */
export function cardPipClass(color: CardColor): string {
  return `playing-card__pip--${color}`;
}

export const TOWER_CARD_CATEGORY_LABELS: Record<TowerCardCategory, string> = {
  attack: 'Ataque',
  defense: 'Defesa',
  manipulation: 'Manipulação',
  chaos: 'Caos',
  epic: 'Épica',
  legendary: 'Lendária',
};

export function isTowerPowerCard(card: Card): boolean {
  return card.type === 'power' && !!card.powerCategory;
}

export function towerPowerCategoryLabel(card: Card): string {
  return card.powerCategory ? TOWER_CARD_CATEGORY_LABELS[card.powerCategory] : 'Poder';
}

const TOWER_POWER_IMAGE_BY_ID = new Map(
  TOWER_POWER_CARDS.map((definition) => [definition.id, definition.imageSrc]),
);

/** Garante imageSrc em cartas de poder (ex.: estado vindo do servidor online). */
export function resolveTowerCardImageSrc(card: Card): string | undefined {
  if (card.imageSrc) return card.imageSrc;
  if (card.powerId) return TOWER_POWER_IMAGE_BY_ID.get(card.powerId);
  return undefined;
}

export function getPlayingCardShellClass(card: Card): string {
  if (isTowerPowerCard(card)) {
    return `playing-card--tower playing-card--tower-${card.powerCategory ?? 'attack'}`;
  }
  if (card.type === 'wild') return 'playing-card--wild';
  if (card.type === 'skip') return 'playing-card--skip';
  return 'playing-card--number';
}
