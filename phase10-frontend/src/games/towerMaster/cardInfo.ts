import type { Card } from '../../types';
import { TOWER_POWER_CARDS } from './cards';

const COLOR_NAMES: Record<string, string> = {
  red: 'Vermelho',
  yellow: 'Amarelo',
  green: 'Verde',
  blue: 'Azul',
};

export const TOWER_LEGENDARY_CARDS = [
  {
    id: 'mestre_da_ordem',
    name: 'Mestre da Ordem',
    imageSrc: '/Cards/lendarias/mestre_da_ordem.png',
    description: 'Uma vez por rodada: complete automaticamente uma sequência do desafio atual.',
  },
  {
    id: 'ladrao',
    name: 'Ladrão',
    imageSrc: '/Cards/lendarias/ladrao.png',
    description: 'Uma vez por rodada: roube três cartas de um jogador.',
  },
  {
    id: 'general',
    name: 'General',
    imageSrc: '/Cards/lendarias/general.png',
    description: 'Uma vez por rodada: todos os outros jogadores compram duas cartas.',
  },
  {
    id: 'mago',
    name: 'Mago',
    imageSrc: '/Cards/lendarias/mago.png',
    description: 'Uma vez por rodada: copie qualquer poder jogado nesta rodada.',
  },
  {
    id: 'guardiao',
    name: 'Guardião',
    imageSrc: '/Cards/lendarias/guardiao.png',
    description: 'Uma vez por rodada: fique imune a ataques até seu próximo turno.',
  },
] as const;

export type TowerLegendaryId = (typeof TOWER_LEGENDARY_CARDS)[number]['id'];

const POWER_DESCRIPTIONS: Record<string, string> = {
  roubo: 'Roube uma carta aleatória da mão de um jogador. Custo: 1 energia.',
  quebra_sequencia: 'Escolha um jogador. Ele devolve uma sequência já baixada para a mão. Custo: 3 energia.',
  destruicao: 'Descarte uma carta da mesa de outro jogador. Custo: 2 energia.',
  inversao: 'Troque sua mão inteira com a mão de outro jogador. Custo: 4 energia.',
  congelar: 'Um jogador não pode jogar no próximo turno (Skip). Custo: 2 energia.',
  maldicao: 'O alvo compra duas cartas imediatamente. Custo: 1 energia.',
  bloqueio: 'O alvo não pode baixar o desafio neste turno. Custo: 2 energia.',
  espiao: 'Veja a mão de qualquer jogador. Custo: 1 energia.',
  cacador: 'Escolha uma cor. Todos descartam uma carta daquela cor. Custo: 3 energia.',
  escudo: 'Bloqueia o próximo ataque contra você. Custo: 1 energia.',
  reflexao: 'Devolve o próximo ataque para quem lançou. Custo: 2 energia.',
  armadura: 'Fica imune a ataques até seu próximo turno. Custo: 3 energia.',
  contra_magica: 'Defesa reforçada contra o próximo ataque. Custo: 2 energia.',
  sorte: 'Compre uma carta ao usar. Custo: 1 energia.',
  segunda_chance: 'Compre duas cartas e descarte duas. Custo: 1 energia.',
  reciclagem: 'Pegue uma carta da pilha de descarte. Custo: 2 energia.',
  visao: 'Olhe as cinco primeiras cartas do monte. Custo: 2 energia.',
  troca: 'Troque uma carta da sua mão com a de outro jogador. Custo: 2 energia.',
  reforco: 'Compre três cartas. Custo: 3 energia.',
  cura: 'Recupere uma carta do descarte. Custo: 2 energia.',
  terremoto: 'Todos devolvem o desafio baixado para a mão. Custo: 5 energia.',
  tempestade: 'Todos passam a mão para a esquerda. Custo: 5 energia.',
  eclipse: 'Ninguém pode usar poderes nesta rodada. Custo: 4 energia.',
  colapso: 'Todos compram três cartas. Custo: 4 energia.',
  tempo_congelado: 'Jogue dois turnos consecutivos após descartar. Custo: 5 energia.',
  roubo_supremo: 'Roube metade da mão de um jogador. Custo: 5 energia.',
  reset: 'Todos voltam um desafio. Custo: 5 energia.',
  julgamento: 'Quem tiver mais cartas compra mais três. Custo: 4 energia.',
  destino: 'Troque seu desafio atual com o de outro jogador. Custo: 5 energia.',
};

export function towerChallengeLabel(challenge: number): string {
  return `Desafio ${challenge}`;
}

/** @deprecated Use towerChallengeLabel */
export function towerFloorLabel(challenge: number): string {
  return towerChallengeLabel(challenge);
}

export function getCardDisplayInfo(card: Card): { name: string; description: string } {
  if (card.type === 'power' && card.powerId) {
    const def = TOWER_POWER_CARDS.find((p) => p.id === card.powerId);
    return {
      name: card.powerName ?? def?.name ?? 'Poder',
      description: POWER_DESCRIPTIONS[card.powerId] ?? 'Carta de poder especial.',
    };
  }

  if (card.type === 'wild') {
    return {
      name: 'Coringa',
      description: 'Substitui qualquer carta numérica em trincas, sequências ou combinações do desafio.',
    };
  }

  if (card.type === 'skip') {
    return {
      name: 'Pular',
      description: 'Ao descartar, escolha um oponente para perder o próximo turno.',
    };
  }

  const colorName = COLOR_NAMES[card.color] ?? card.color;
  return {
    name: `${card.value} ${colorName}`,
    description: `Carta numérica ${card.value} na cor ${colorName}. Use em trincas, sequências ou combinações do desafio atual.`,
  };
}

export function getLegendaryDisplayInfo(legendaryId: string): { name: string; description: string; imageSrc: string } {
  const def = TOWER_LEGENDARY_CARDS.find((l) => l.id === legendaryId);
  return {
    name: def?.name ?? 'Lendária',
    description: def?.description ?? 'Carta lendária única.',
    imageSrc: def?.imageSrc ?? '/Cards/lendarias/mestre_da_ordem.png',
  };
}

export function pickRandomLegendaryId(): TowerLegendaryId {
  const index = Math.floor(Math.random() * TOWER_LEGENDARY_CARDS.length);
  return TOWER_LEGENDARY_CARDS[index].id;
}
