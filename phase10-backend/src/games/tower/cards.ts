import { Card } from '../../common/game.types';
import { generateId } from '../../game/game-engine';

export type TowerCardCategory = 'attack' | 'defense' | 'manipulation' | 'chaos' | 'epic' | 'legendary';
export type TowerCardRarity = 'uncommon' | 'rare' | 'epic' | 'legendary';

export type TowerPowerDefinition = {
  id: string;
  name: string;
  category: TowerCardCategory;
  rarity: TowerCardRarity;
  cost: number;
  copies: number;
};

export const TOWER_POWER_CARDS: TowerPowerDefinition[] = [
  { id: 'roubo', name: 'Roubo', category: 'attack', rarity: 'uncommon', cost: 1, copies: 2 },
  { id: 'quebra_sequencia', name: 'Quebra Sequência', category: 'attack', rarity: 'rare', cost: 3, copies: 1 },
  { id: 'destruicao', name: 'Destruição', category: 'attack', rarity: 'rare', cost: 2, copies: 1 },
  { id: 'inversao', name: 'Inversão', category: 'attack', rarity: 'rare', cost: 4, copies: 1 },
  { id: 'congelar', name: 'Congelar', category: 'attack', rarity: 'uncommon', cost: 2, copies: 2 },
  { id: 'maldicao', name: 'Maldição', category: 'attack', rarity: 'uncommon', cost: 1, copies: 2 },
  { id: 'bloqueio', name: 'Bloqueio', category: 'attack', rarity: 'uncommon', cost: 2, copies: 2 },
  { id: 'espiao', name: 'Espião', category: 'attack', rarity: 'uncommon', cost: 1, copies: 2 },
  { id: 'cacador', name: 'Caçador', category: 'attack', rarity: 'rare', cost: 3, copies: 1 },
  { id: 'escudo', name: 'Escudo', category: 'defense', rarity: 'uncommon', cost: 1, copies: 2 },
  { id: 'reflexao', name: 'Reflexão', category: 'defense', rarity: 'rare', cost: 2, copies: 1 },
  { id: 'armadura', name: 'Armadura', category: 'defense', rarity: 'rare', cost: 3, copies: 1 },
  { id: 'contra_magica', name: 'Contra Mágica', category: 'defense', rarity: 'rare', cost: 2, copies: 1 },
  { id: 'sorte', name: 'Sorte', category: 'defense', rarity: 'uncommon', cost: 1, copies: 2 },
  { id: 'segunda_chance', name: 'Segunda Chance', category: 'manipulation', rarity: 'uncommon', cost: 1, copies: 2 },
  { id: 'reciclagem', name: 'Reciclagem', category: 'manipulation', rarity: 'uncommon', cost: 2, copies: 2 },
  { id: 'visao', name: 'Visão', category: 'manipulation', rarity: 'uncommon', cost: 2, copies: 2 },
  { id: 'troca', name: 'Troca', category: 'manipulation', rarity: 'uncommon', cost: 2, copies: 2 },
  { id: 'reforco', name: 'Reforço', category: 'manipulation', rarity: 'rare', cost: 3, copies: 1 },
  { id: 'cura', name: 'Cura', category: 'manipulation', rarity: 'uncommon', cost: 2, copies: 2 },
  { id: 'terremoto', name: 'Terremoto', category: 'chaos', rarity: 'epic', cost: 5, copies: 1 },
  { id: 'tempestade', name: 'Tempestade', category: 'chaos', rarity: 'epic', cost: 5, copies: 1 },
  { id: 'eclipse', name: 'Eclipse', category: 'chaos', rarity: 'epic', cost: 4, copies: 1 },
  { id: 'colapso', name: 'Colapso', category: 'chaos', rarity: 'epic', cost: 4, copies: 1 },
  { id: 'tempo_congelado', name: 'Tempo Congelado', category: 'chaos', rarity: 'epic', cost: 5, copies: 1 },
  { id: 'roubo_supremo', name: 'Roubo Supremo', category: 'epic', rarity: 'epic', cost: 5, copies: 1 },
  { id: 'reset', name: 'Reset', category: 'epic', rarity: 'epic', cost: 5, copies: 1 },
  { id: 'julgamento', name: 'Julgamento', category: 'epic', rarity: 'epic', cost: 4, copies: 1 },
  { id: 'destino', name: 'Destino', category: 'epic', rarity: 'epic', cost: 5, copies: 1 },
];

export function createTowerPowerCard(definition: TowerPowerDefinition, copyIndex: number, uniqueId: string): Card {
  return {
    id: `tower-${definition.id}-${copyIndex}-${uniqueId}`,
    type: 'power' as Card['type'],
    value: 0,
    color: definition.category as Card['color'],
    powerId: definition.id,
    powerName: definition.name,
    powerCategory: definition.category,
    powerCost: definition.cost,
    rarity: definition.rarity,
  };
}

export function generateTowerMasterDeck(baseDeck: Card[]): Card[] {
  const deck = [...baseDeck];
  TOWER_POWER_CARDS.forEach((definition) => {
    for (let copyIndex = 1; copyIndex <= definition.copies; copyIndex++) {
      deck.push(createTowerPowerCard(definition, copyIndex, generateId()));
    }
  });
  return deck;
}

const TOWER_CLASSES = ['mago', 'guerreiro', 'ladino', 'guardiao', 'alquimista'] as const;

export function pickRandomTowerCharacterClass(): string {
  return TOWER_CLASSES[Math.floor(Math.random() * TOWER_CLASSES.length)];
}

const TOWER_LEGENDARY_IDS = [
  'mestre_da_ordem',
  'ladrao',
  'general',
  'mago',
  'guardiao',
] as const;

export function pickRandomLegendaryId(): string {
  return TOWER_LEGENDARY_IDS[Math.floor(Math.random() * TOWER_LEGENDARY_IDS.length)];
}

export function findTowerPowerDefinition(powerId: string): TowerPowerDefinition | undefined {
  return TOWER_POWER_CARDS.find((p) => p.id === powerId);
}

export function createTowerPowerCardById(powerId: string): Card {
  const def = findTowerPowerDefinition(powerId);
  if (!def) {
    return {
      id: `tower-copy-${powerId}`,
      type: 'power',
      value: 0,
      color: 'attack',
      powerId,
      powerName: powerId,
      powerCategory: 'attack',
      powerCost: 0,
    };
  }
  return createTowerPowerCard(def, 0, generateId());
}
