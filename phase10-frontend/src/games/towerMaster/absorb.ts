import type { Card, TowerCardCategory } from '../../types';

export const ABSORBABLE_POWER_CATEGORIES: TowerCardCategory[] = [
  'attack',
  'defense',
  'manipulation',
  'chaos',
];

export type AbsorbCategoryFilter = TowerCardCategory | 'all';

export function isAbsorbablePowerCard(card: Card): boolean {
  return (
    card.type === 'power' &&
    !!card.powerCategory &&
    ABSORBABLE_POWER_CATEGORIES.includes(card.powerCategory)
  );
}

export function absorbEnergyGain(currentEnergy: number, cardsAbsorbed: number): number {
  return Math.min(cardsAbsorbed, Math.max(0, 6 - currentEnergy));
}
