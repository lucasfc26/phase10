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
  imageSrc: string;
};

const cardImage = (folder: string, file: string) => `/Cards/${folder}/${file}.png`;

export const TOWER_POWER_CARDS: TowerPowerDefinition[] = [
  { id: 'roubo', name: 'Roubo', category: 'attack', rarity: 'uncommon', cost: 1, copies: 2, imageSrc: cardImage('ataque', 'roubo') },
  { id: 'quebra_sequencia', name: 'Quebra Sequência', category: 'attack', rarity: 'rare', cost: 3, copies: 1, imageSrc: cardImage('ataque', 'quebra_sequencia') },
  { id: 'destruicao', name: 'Destruição', category: 'attack', rarity: 'rare', cost: 2, copies: 1, imageSrc: cardImage('ataque', 'destruicao') },
  { id: 'inversao', name: 'Inversão', category: 'attack', rarity: 'rare', cost: 4, copies: 1, imageSrc: cardImage('ataque', 'inversao') },
  { id: 'congelar', name: 'Congelar', category: 'attack', rarity: 'uncommon', cost: 2, copies: 2, imageSrc: cardImage('ataque', 'congelar') },
  { id: 'maldicao', name: 'Maldição', category: 'attack', rarity: 'uncommon', cost: 1, copies: 2, imageSrc: cardImage('ataque', 'maldicao') },
  { id: 'bloqueio', name: 'Bloqueio', category: 'attack', rarity: 'uncommon', cost: 2, copies: 2, imageSrc: cardImage('ataque', 'bloqueio') },
  { id: 'espiao', name: 'Espião', category: 'attack', rarity: 'uncommon', cost: 1, copies: 2, imageSrc: cardImage('ataque', 'espiao') },
  { id: 'cacador', name: 'Caçador', category: 'attack', rarity: 'rare', cost: 3, copies: 1, imageSrc: cardImage('ataque', 'cacador') },
  { id: 'escudo', name: 'Escudo', category: 'defense', rarity: 'uncommon', cost: 1, copies: 2, imageSrc: cardImage('defesa', 'escudo') },
  { id: 'reflexao', name: 'Reflexão', category: 'defense', rarity: 'rare', cost: 2, copies: 1, imageSrc: cardImage('defesa', 'reflexao') },
  { id: 'armadura', name: 'Armadura', category: 'defense', rarity: 'rare', cost: 3, copies: 1, imageSrc: cardImage('defesa', 'armadura') },
  { id: 'contra_magica', name: 'Contra Mágica', category: 'defense', rarity: 'rare', cost: 2, copies: 1, imageSrc: cardImage('defesa', 'contra_magica') },
  { id: 'sorte', name: 'Sorte', category: 'defense', rarity: 'uncommon', cost: 1, copies: 2, imageSrc: cardImage('defesa', 'sorte') },
  { id: 'segunda_chance', name: 'Segunda Chance', category: 'manipulation', rarity: 'uncommon', cost: 1, copies: 2, imageSrc: cardImage('manipulacao', 'segunda_chance') },
  { id: 'reciclagem', name: 'Reciclagem', category: 'manipulation', rarity: 'uncommon', cost: 2, copies: 2, imageSrc: cardImage('manipulacao', 'reciclagem') },
  { id: 'visao', name: 'Visão', category: 'manipulation', rarity: 'uncommon', cost: 2, copies: 2, imageSrc: cardImage('manipulacao', 'visao') },
  { id: 'troca', name: 'Troca', category: 'manipulation', rarity: 'uncommon', cost: 2, copies: 2, imageSrc: cardImage('manipulacao', 'troca') },
  { id: 'reforco', name: 'Reforço', category: 'manipulation', rarity: 'rare', cost: 3, copies: 1, imageSrc: cardImage('manipulacao', 'reforco') },
  { id: 'cura', name: 'Cura', category: 'manipulation', rarity: 'uncommon', cost: 2, copies: 2, imageSrc: cardImage('manipulacao', 'cura') },
  { id: 'terremoto', name: 'Terremoto', category: 'chaos', rarity: 'epic', cost: 5, copies: 1, imageSrc: cardImage('caos', 'terremoto') },
  { id: 'tempestade', name: 'Tempestade', category: 'chaos', rarity: 'epic', cost: 5, copies: 1, imageSrc: cardImage('caos', 'tempestade') },
  { id: 'eclipse', name: 'Eclipse', category: 'chaos', rarity: 'epic', cost: 4, copies: 1, imageSrc: cardImage('caos', 'eclipse') },
  { id: 'colapso', name: 'Colapso', category: 'chaos', rarity: 'epic', cost: 4, copies: 1, imageSrc: cardImage('caos', 'colapso') },
  { id: 'tempo_congelado', name: 'Tempo Congelado', category: 'chaos', rarity: 'epic', cost: 5, copies: 1, imageSrc: cardImage('caos', 'tempo_congelado') },
  { id: 'roubo_supremo', name: 'Roubo Supremo', category: 'epic', rarity: 'epic', cost: 5, copies: 1, imageSrc: cardImage('epicas', 'roubo_supremo') },
  { id: 'reset', name: 'Reset', category: 'epic', rarity: 'epic', cost: 5, copies: 1, imageSrc: cardImage('epicas', 'reset') },
  { id: 'julgamento', name: 'Julgamento', category: 'epic', rarity: 'epic', cost: 4, copies: 1, imageSrc: cardImage('epicas', 'julgamento') },
  { id: 'destino', name: 'Destino', category: 'epic', rarity: 'epic', cost: 5, copies: 1, imageSrc: cardImage('epicas', 'destino') },
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
    imageSrc: definition.imageSrc,
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
