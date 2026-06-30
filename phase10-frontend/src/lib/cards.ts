import type { Card, CardColor, TowerCardCategory } from '../types';

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
