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
    description: 'Uma vez por rodada: baixe seu desafio automaticamente se tiver as cartas na mão (mesmo fora do seu turno).',
  },
  {
    id: 'ladrao',
    name: 'Ladrão',
    imageSrc: '/Cards/lendarias/ladrao.png',
    description: 'Uma vez por rodada: roube 1 carta de cada jogador; depois todos (incluindo você) compram 1 carta aleatória do monte.',
  },
  {
    id: 'general',
    name: 'General',
    imageSrc: '/Cards/lendarias/general.png',
    description: 'Uma vez por rodada: veja as próximas 3 cartas do monte e escolha 2 para a sua mão.',
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
    description: 'Uma vez por rodada: imunidade total a ataques até o início do seu próximo turno.',
  },
] as const;

export type TowerLegendaryId = (typeof TOWER_LEGENDARY_CARDS)[number]['id'];

const POWER_DESCRIPTIONS: Record<string, string> = {
  roubo: 'Roube uma carta aleatória da mão de um jogador. Custo: 1 energia.',
  quebra_sequencia: 'Escolha um oponente. Todas as cartas que ele baixou vão para sua mão; uma delas é trocada por uma carta aleatória do monte. Custo: 3 energia.',
  destruicao: 'O alvo perde uma carta aleatória da mão e recebe outra aleatória do monte. Custo: 2 energia.',
  inversao: 'Desafios baixados voltam às mãos; depois troque sua mão inteira com a de outro jogador. Custo: 4 energia.',
  congelar: 'O alvo não pode comprar cartas até o próximo turno, mas pode baixar desafio ou usar poderes. Custo: 2 energia.',
  maldicao: 'O alvo compra duas cartas imediatamente. Custo: 1 energia.',
  bloqueio: 'O alvo não pode baixar o desafio até o próximo turno. Custo: 2 energia.',
  espiao: 'Veja a mão de qualquer jogador. Custo: 1 energia.',
  cacador: 'Escolha uma cor. Todos descartam uma carta daquela cor e recebem uma carta aleatória do monte. Custo: 3 energia.',
  escudo: 'Nega em tempo real qualquer ataque lançado contra você até ser consumido. Custo: 1 energia.',
  reflexao: 'Devolve o próximo ataque para quem lançou. Custo: 2 energia.',
  armadura: 'Fica imune a ataques até seu próximo turno. Custo: 3 energia.',
  contra_magica: 'Defesa reforçada contra o próximo ataque. Custo: 2 energia.',
  sorte: 'Compre uma carta ao usar. Custo: 1 energia.',
  segunda_chance: 'Compre duas cartas e descarte duas. Custo: 1 energia.',
  reciclagem: 'Descarte uma carta da mão e pegue uma carta aleatória da pilha de descarte. Custo: 2 energia.',
  visao: 'Olhe as cinco primeiras cartas do monte. Custo: 2 energia.',
  troca: 'Troque uma carta da sua mão com a de outro jogador. Custo: 2 energia.',
  reforco: 'Compre três cartas. Custo: 3 energia.',
  cura: 'Escolha uma das últimas 5 cartas descartadas na pilha. Custo: 2 energia.',
  terremoto: 'Cartas baixadas voltam às mãos dos jogadores; depois todas as mãos são embaralhadas entre todos. Custo: 5 energia.',
  tempestade: 'Desafios baixados voltam às mãos; depois todos passam a mão para a esquerda. Custo: 5 energia.',
  eclipse: 'Ninguém pode usar poderes nesta rodada. Custo: 4 energia.',
  colapso: 'Todos compram três cartas. Custo: 4 energia.',
  tempo_congelado: 'Jogue dois turnos consecutivos após descartar. Custo: 5 energia.',
  roubo_supremo: 'Roube metade da mão de um jogador (alvo escolhido); ele compra do monte a mesma quantidade no próximo turno. Custo: 5 energia.',
  reset: 'Jogadores acima do Desafio 1 voltam um andar; quem está no Desafio 1 permanece. Custo: 5 energia.',
  julgamento: 'Quem tiver menos cartas compra 5 cartas. Custo: 4 energia.',
  destino: 'Troca seu desafio atual com o de um jogador aleatório. Custo: 5 energia.',
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
