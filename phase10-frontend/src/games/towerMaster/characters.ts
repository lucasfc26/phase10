export const TOWER_CHARACTER_CLASSES = [
  {
    id: 'mago',
    name: 'Mago',
    imageSrc: '/Cards/personagens/mago.png',
    passive: 'Compra +1 carta ao usar um Poder.',
    exclusive: 'Copie o último poder jogado (1× por rodada).',
  },
  {
    id: 'guerreiro',
    name: 'Guerreiro',
    imageSrc: '/Cards/personagens/guerreiro.png',
    passive: '15% de chance por turno de destruir uma carta aleatória de um adversário; ele compra outra do monte.',
    exclusive: 'Destrói uma carta baixada aleatória, devolve o desafio à mão do alvo e ele ganha +1 carta no próximo turno (1× por rodada).',
  },
  {
    id: 'ladino',
    name: 'Ladino',
    imageSrc: '/Cards/personagens/ladino.png',
    passive: '20% de chance de ver a carta no topo do monte no início do turno.',
    exclusive: 'Rouba 2 cartas aleatórias da mão de alguém; o alvo compra 2 do monte (1× por rodada).',
  },
  {
    id: 'guardiao',
    name: 'Guardião',
    imageSrc: '/Cards/personagens/guardiao.png',
    passive: 'Começa a rodada com Escudo; só perde ao ser alvo de um ataque.',
    exclusive: 'Fique imune a ataques até seu próximo turno (1× por rodada).',
  },
  {
    id: 'alquimista',
    name: 'Alquimista',
    imageSrc: '/Cards/personagens/alquimista.png',
    passive: '15% de chance de jogar 2 turnos seguidos no início do turno.',
    exclusive: 'Transforme uma carta da mão em Coringa até o fim da rodada (1× por rodada).',
  },
] as const;

export type TowerCharacterClass = (typeof TOWER_CHARACTER_CLASSES)[number]['id'];

export function getTowerCharacterInfo(classId: string) {
  return TOWER_CHARACTER_CLASSES.find((c) => c.id === classId) ?? null;
}

export function pickRandomTowerCharacterClass(): TowerCharacterClass {
  const index = Math.floor(Math.random() * TOWER_CHARACTER_CLASSES.length);
  return TOWER_CHARACTER_CLASSES[index].id;
}
