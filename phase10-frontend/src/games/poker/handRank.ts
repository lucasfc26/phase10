import type { PokerCard } from './types';

export type HandCategory =
  | 'high_card'
  | 'pair'
  | 'two_pair'
  | 'three_kind'
  | 'straight'
  | 'flush'
  | 'full_house'
  | 'four_kind'
  | 'straight_flush'
  | 'royal_flush';

export interface EvaluatedHand {
  category: HandCategory;
  rank: number;
  tiebreak: number[];
  name: string;
  bestFive: PokerCard[];
}

const CATEGORY_RANK: Record<HandCategory, number> = {
  high_card: 1,
  pair: 2,
  two_pair: 3,
  three_kind: 4,
  straight: 5,
  flush: 6,
  full_house: 7,
  four_kind: 8,
  straight_flush: 9,
  royal_flush: 10,
};

const CATEGORY_NAME: Record<HandCategory, string> = {
  high_card: 'Carta Alta',
  pair: 'Par',
  two_pair: 'Dois Pares',
  three_kind: 'Trinca',
  straight: 'Sequência',
  flush: 'Flush',
  full_house: 'Full House',
  four_kind: 'Quadra',
  straight_flush: 'Straight Flush',
  royal_flush: 'Royal Flush',
};

function cardRankValue(rank: number): number {
  return rank === 1 ? 14 : rank;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function evaluateFive(cards: PokerCard[]): EvaluatedHand {
  const ranks = cards.map((c) => cardRankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  let isStraight = false;
  let straightHigh = ranks[0];
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) {
      isStraight = true;
      straightHigh = unique[0];
    } else if (
      unique.join(',') === '14,5,4,3,2'
    ) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isFlush && isStraight) {
    const cat: HandCategory =
      straightHigh === 14 && ranks.includes(13) ? 'royal_flush' : 'straight_flush';
    return {
      category: cat,
      rank: CATEGORY_RANK[cat],
      tiebreak: [straightHigh],
      name: CATEGORY_NAME[cat],
      bestFive: cards,
    };
  }

  if (groups[0][1] === 4) {
    return {
      category: 'four_kind',
      rank: CATEGORY_RANK.four_kind,
      tiebreak: [groups[0][0], groups[1][0]],
      name: CATEGORY_NAME.four_kind,
      bestFive: cards,
    };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return {
      category: 'full_house',
      rank: CATEGORY_RANK.full_house,
      tiebreak: [groups[0][0], groups[1][0]],
      name: CATEGORY_NAME.full_house,
      bestFive: cards,
    };
  }

  if (isFlush) {
    return {
      category: 'flush',
      rank: CATEGORY_RANK.flush,
      tiebreak: ranks,
      name: CATEGORY_NAME.flush,
      bestFive: cards,
    };
  }

  if (isStraight) {
    return {
      category: 'straight',
      rank: CATEGORY_RANK.straight,
      tiebreak: [straightHigh],
      name: CATEGORY_NAME.straight,
      bestFive: cards,
    };
  }

  if (groups[0][1] === 3) {
    const kickers = groups.slice(1).map((g) => g[0]).sort((a, b) => b - a);
    return {
      category: 'three_kind',
      rank: CATEGORY_RANK.three_kind,
      tiebreak: [groups[0][0], ...kickers],
      name: CATEGORY_NAME.three_kind,
      bestFive: cards,
    };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    const kicker = groups[2][0];
    return {
      category: 'two_pair',
      rank: CATEGORY_RANK.two_pair,
      tiebreak: [...pairs, kicker],
      name: CATEGORY_NAME.two_pair,
      bestFive: cards,
    };
  }

  if (groups[0][1] === 2) {
    const kickers = groups.slice(1).map((g) => g[0]).sort((a, b) => b - a);
    return {
      category: 'pair',
      rank: CATEGORY_RANK.pair,
      tiebreak: [groups[0][0], ...kickers],
      name: CATEGORY_NAME.pair,
      bestFive: cards,
    };
  }

  return {
    category: 'high_card',
    rank: CATEGORY_RANK.high_card,
    tiebreak: ranks,
    name: CATEGORY_NAME.high_card,
    bestFive: cards,
  };
}

export function evaluateBestHand(cards: PokerCard[]): EvaluatedHand {
  if (cards.length <= 5) return evaluateFive(cards);
  let best: EvaluatedHand | null = null;
  for (const combo of combinations(cards, 5)) {
    const evalHand = evaluateFive(combo);
    if (!best || compareHands(evalHand, best) > 0) best = evalHand;
  }
  return best!;
}

export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function handStrengthScore(cards: PokerCard[]): number {
  const hand = evaluateBestHand(cards);
  return hand.rank * 1_000_000 + (hand.tiebreak[0] ?? 0);
}
