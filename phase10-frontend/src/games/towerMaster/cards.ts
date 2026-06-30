import type { Card, TowerCardCategory, TowerCardRarity } from '../../types';

export type TowerPowerDefinition = {
  id: string;
  name: string;
  category: TowerCardCategory;
  rarity: TowerCardRarity;
  cost: number;
  imageSrc: string;
  copies: number;
};

const cardImage = (folder: string, file: string) => `/Cards/${folder}/${file}.png`;

export const TOWER_POWER_CARDS: TowerPowerDefinition[] = [
  { id: 'roubo', name: 'Roubo', category: 'attack', rarity: 'uncommon', cost: 1, imageSrc: cardImage('ataque', 'roubo'), copies: 2 },
  { id: 'quebra_sequencia', name: 'Quebra Sequência', category: 'attack', rarity: 'rare', cost: 3, imageSrc: cardImage('ataque', 'quebra_sequencia'), copies: 1 },
  { id: 'destruicao', name: 'Destruição', category: 'attack', rarity: 'rare', cost: 2, imageSrc: cardImage('ataque', 'destruicao'), copies: 1 },
  { id: 'inversao', name: 'Inversão', category: 'attack', rarity: 'rare', cost: 4, imageSrc: cardImage('ataque', 'inversao'), copies: 1 },
  { id: 'congelar', name: 'Congelar', category: 'attack', rarity: 'uncommon', cost: 2, imageSrc: cardImage('ataque', 'congelar'), copies: 2 },
  { id: 'maldicao', name: 'Maldição', category: 'attack', rarity: 'uncommon', cost: 1, imageSrc: cardImage('ataque', 'maldicao'), copies: 2 },
  { id: 'bloqueio', name: 'Bloqueio', category: 'attack', rarity: 'uncommon', cost: 2, imageSrc: cardImage('ataque', 'bloqueio'), copies: 2 },
  { id: 'espiao', name: 'Espião', category: 'attack', rarity: 'uncommon', cost: 1, imageSrc: cardImage('ataque', 'espiao'), copies: 2 },
  { id: 'cacador', name: 'Caçador', category: 'attack', rarity: 'rare', cost: 3, imageSrc: cardImage('ataque', 'cacador'), copies: 1 },

  { id: 'escudo', name: 'Escudo', category: 'defense', rarity: 'uncommon', cost: 1, imageSrc: cardImage('defesa', 'escudo'), copies: 2 },
  { id: 'reflexao', name: 'Reflexão', category: 'defense', rarity: 'rare', cost: 2, imageSrc: cardImage('defesa', 'reflexao'), copies: 1 },
  { id: 'armadura', name: 'Armadura', category: 'defense', rarity: 'rare', cost: 3, imageSrc: cardImage('defesa', 'armadura'), copies: 1 },
  { id: 'contra_magica', name: 'Contra Mágica', category: 'defense', rarity: 'rare', cost: 2, imageSrc: cardImage('defesa', 'contra_magica'), copies: 1 },
  { id: 'sorte', name: 'Sorte', category: 'defense', rarity: 'uncommon', cost: 1, imageSrc: cardImage('defesa', 'sorte'), copies: 2 },

  { id: 'segunda_chance', name: 'Segunda Chance', category: 'manipulation', rarity: 'uncommon', cost: 1, imageSrc: cardImage('manipulacao', 'segunda_chance'), copies: 2 },
  { id: 'reciclagem', name: 'Reciclagem', category: 'manipulation', rarity: 'uncommon', cost: 2, imageSrc: cardImage('manipulacao', 'reciclagem'), copies: 2 },
  { id: 'visao', name: 'Visão', category: 'manipulation', rarity: 'uncommon', cost: 2, imageSrc: cardImage('manipulacao', 'visao'), copies: 2 },
  { id: 'troca', name: 'Troca', category: 'manipulation', rarity: 'uncommon', cost: 2, imageSrc: cardImage('manipulacao', 'troca'), copies: 2 },
  { id: 'reforco', name: 'Reforço', category: 'manipulation', rarity: 'rare', cost: 3, imageSrc: cardImage('manipulacao', 'reforco'), copies: 1 },
  { id: 'cura', name: 'Cura', category: 'manipulation', rarity: 'uncommon', cost: 2, imageSrc: cardImage('manipulacao', 'cura'), copies: 2 },

  { id: 'terremoto', name: 'Terremoto', category: 'chaos', rarity: 'epic', cost: 5, imageSrc: cardImage('caos', 'terremoto'), copies: 1 },
  { id: 'tempestade', name: 'Tempestade', category: 'chaos', rarity: 'epic', cost: 5, imageSrc: cardImage('caos', 'tempestade'), copies: 1 },
  { id: 'eclipse', name: 'Eclipse', category: 'chaos', rarity: 'epic', cost: 4, imageSrc: cardImage('caos', 'eclipse'), copies: 1 },
  { id: 'colapso', name: 'Colapso', category: 'chaos', rarity: 'epic', cost: 4, imageSrc: cardImage('caos', 'colapso'), copies: 1 },
  { id: 'tempo_congelado', name: 'Tempo Congelado', category: 'chaos', rarity: 'epic', cost: 5, imageSrc: cardImage('caos', 'tempo_congelado'), copies: 1 },

  { id: 'roubo_supremo', name: 'Roubo Supremo', category: 'epic', rarity: 'epic', cost: 5, imageSrc: cardImage('epicas', 'roubo_supremo'), copies: 1 },
  { id: 'reset', name: 'Reset', category: 'epic', rarity: 'epic', cost: 5, imageSrc: cardImage('epicas', 'reset'), copies: 1 },
  { id: 'julgamento', name: 'Julgamento', category: 'epic', rarity: 'epic', cost: 4, imageSrc: cardImage('epicas', 'julgamento'), copies: 1 },
  { id: 'destino', name: 'Destino', category: 'epic', rarity: 'epic', cost: 5, imageSrc: cardImage('epicas', 'destino'), copies: 1 },
];

export function createTowerPowerCard(definition: TowerPowerDefinition, copyIndex: number, uniqueId: string): Card {
  return {
    id: `tower-${definition.id}-${copyIndex}-${uniqueId}`,
    type: 'power',
    value: 0,
    color: definition.category,
    powerId: definition.id,
    powerName: definition.name,
    powerCategory: definition.category,
    powerCost: definition.cost,
    rarity: definition.rarity,
    imageSrc: definition.imageSrc,
  };
}
