import { Card, CardColor, PhaseType, Player, LaidDownPhase, STANDARD_PHASES } from './types';

// Helper to generate a unique ID
export const generateId = () => Math.random().toString(36).substring(2, 11);

// Generate a standard Phase 10 deck (108 cards)
export function generateDeck(): Card[] {
  const deck: Card[] = [];
  const colors: CardColor[] = ['red', 'yellow', 'green', 'blue'];

  // 1. Number cards: Numbers 1-12, two of each color
  colors.forEach(color => {
    for (let value = 1; value <= 12; value++) {
      // Add first card
      deck.push({
        id: `card-${color}-${value}-1-${generateId()}`,
        type: 'number',
        value,
        color
      });
      // Add second card
      deck.push({
        id: `card-${color}-${value}-2-${generateId()}`,
        type: 'number',
        value,
        color
      });
    }
  });

  // 2. Wild cards (8 total)
  for (let i = 1; i <= 8; i++) {
    deck.push({
      id: `card-wild-${i}-${generateId()}`,
      type: 'wild',
      value: 0,
      color: 'wild'
    });
  }

  // 3. Skip cards (4 total)
  for (let i = 1; i <= 4; i++) {
    deck.push({
      id: `card-skip-${i}-${generateId()}`,
      type: 'skip',
      value: 0,
      color: 'skip'
    });
  }

  return deck;
}

// Shuffle cards using Fisher-Yates algorithm
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Calculate the points remaining in a hand
export function calculateHandScore(cards: Card[]): number {
  return cards.reduce((total, card) => {
    if (card.type === 'wild') return total + 25;
    if (card.type === 'skip') return total + 15;
    if (card.value >= 10) return total + 10;
    return total + 5; // values 1-9
  }, 0);
}

// Check if a group of cards is a valid SET (all same value, or wild)
export function isValidSet(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  if (cards.some(c => c.type === 'skip')) return false;
  
  const nonWilds = cards.filter(c => c.type !== 'wild');
  if (nonWilds.length === 0) {
    // A set cannot be ONLY wilds, there must be at least one natural card
    // Note: Some informal rules allow all wilds, but typically 1 natural card is required.
    // Let's require at least 1 natural card to avoid degenerate plays, or let it pass if length is valid
    return cards.length >= 2;
  }
  
  const firstValue = nonWilds[0].value;
  return nonWilds.every(c => c.value === firstValue);
}

// Check if a group of cards is a valid RUN (consecutive numbers, colors don't matter)
export function isValidRun(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  if (cards.some(c => c.type === 'skip')) return false;

  const nonWilds = cards.filter(c => c.type !== 'wild');
  if (nonWilds.length === 0) return cards.length >= 2; // All wilds is theoretically consecutive but needs length

  const values = nonWilds.map(c => c.value);
  
  // No duplicate values are allowed in a run
  const uniqueValues = new Set(values);
  if (uniqueValues.size !== values.length) return false;

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  // The difference between the highest and lowest non-wild card cannot exceed the available card spots
  if (maxVal - minVal >= cards.length) return false;

  // The sequence must fit within 1 and 12
  // We check if we can place a sequence of cards.length such that it covers all values in the run
  const lowestPossibleStart = Math.max(1, maxVal - cards.length + 1);
  const highestPossibleStart = Math.min(12 - cards.length + 1, minVal);

  return lowestPossibleStart <= highestPossibleStart;
}

// Check if a group of cards is a valid COLOR SET (all same color, wild can match any)
export function isValidColorSet(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  if (cards.some(c => c.type === 'skip')) return false;

  const nonWilds = cards.filter(c => c.type !== 'wild');
  if (nonWilds.length === 0) return true; // All wilds count as any color

  const firstColor = nonWilds[0].color;
  return nonWilds.every(c => c.color === firstColor);
}

// Check if selected groups of cards satisfy the rules of a Phase
export function validatePhase(phaseType: PhaseType, groups: Card[][]): { isValid: boolean; error?: string } {
  if (!groups || groups.length === 0) {
    return { isValid: false, error: 'Nenhuma carta selecionada.' };
  }

  // Helper to check standard parameters
  switch (phaseType) {
    case 'sets_2_3': {
      if (groups.length !== 2) return { isValid: false, error: 'Esta fase requer exatamente 2 grupos.' };
      if (groups[0].length < 3) return { isValid: false, error: 'O primeiro grupo deve ter pelo menos 3 cartas.' };
      if (groups[1].length < 3) return { isValid: false, error: 'O segundo grupo deve ter pelo menos 3 cartas.' };
      if (!isValidSet(groups[0])) return { isValid: false, error: 'O primeiro grupo não é uma trinca válida.' };
      if (!isValidSet(groups[1])) return { isValid: false, error: 'O segundo grupo não é uma trinca válida.' };
      return { isValid: true };
    }

    case 'set_3_run_4': {
      if (groups.length !== 2) return { isValid: false, error: 'Esta fase requer exatamente 2 grupos (1 trinca e 1 sequência).' };
      const g0_isSet = isValidSet(groups[0]) && groups[0].length >= 3;
      const g0_isRun = isValidRun(groups[0]) && groups[0].length >= 4;
      const g1_isSet = isValidSet(groups[1]) && groups[1].length >= 3;
      const g1_isRun = isValidRun(groups[1]) && groups[1].length >= 4;

      if ((g0_isSet && g1_isRun) || (g0_isRun && g1_isSet)) {
        return { isValid: true };
      }
      return { isValid: false, error: 'Requer 1 trinca (mín. 3 cartas) e 1 sequência de 4 cartas.' };
    }

    case 'set_4_run_4': {
      if (groups.length !== 2) return { isValid: false, error: 'Esta fase requer exatamente 2 grupos (1 quadra e 1 sequência).' };
      const g0_isSet = isValidSet(groups[0]) && groups[0].length >= 4;
      const g0_isRun = isValidRun(groups[0]) && groups[0].length >= 4;
      const g1_isSet = isValidSet(groups[1]) && groups[1].length >= 4;
      const g1_isRun = isValidRun(groups[1]) && groups[1].length >= 4;

      if ((g0_isSet && g1_isRun) || (g0_isRun && g1_isSet)) {
        return { isValid: true };
      }
      return { isValid: false, error: 'Requer 1 quadra (mín. 4 cartas) e 1 sequência de 4 cartas.' };
    }

    case 'run_7': {
      if (groups.length !== 1) return { isValid: false, error: 'Esta fase requer apenas 1 grupo.' };
      if (groups[0].length < 7) return { isValid: false, error: 'A sequência deve ter pelo menos 7 cartas.' };
      if (!isValidRun(groups[0])) return { isValid: false, error: 'O grupo não é uma sequência consecutiva válida.' };
      return { isValid: true };
    }

    case 'run_8': {
      if (groups.length !== 1) return { isValid: false, error: 'Esta fase requer apenas 1 grupo.' };
      if (groups[0].length < 8) return { isValid: false, error: 'A sequência deve ter pelo menos 8 cartas.' };
      if (!isValidRun(groups[0])) return { isValid: false, error: 'O grupo não é uma sequência consecutiva válida.' };
      return { isValid: true };
    }

    case 'run_9': {
      if (groups.length !== 1) return { isValid: false, error: 'Esta fase requer apenas 1 grupo.' };
      if (groups[0].length < 9) return { isValid: false, error: 'A sequência deve ter pelo menos 9 cartas.' };
      if (!isValidRun(groups[0])) return { isValid: false, error: 'O grupo não é uma sequência consecutiva válida.' };
      return { isValid: true };
    }

    case 'sets_2_4': {
      if (groups.length !== 2) return { isValid: false, error: 'Esta fase requer exatamente 2 grupos.' };
      if (groups[0].length < 4) return { isValid: false, error: 'O primeiro grupo deve ter pelo menos 4 cartas.' };
      if (groups[1].length < 4) return { isValid: false, error: 'O segundo grupo deve ter pelo menos 4 cartas.' };
      if (!isValidSet(groups[0])) return { isValid: false, error: 'O primeiro grupo não é uma quadra válida.' };
      if (!isValidSet(groups[1])) return { isValid: false, error: 'O segundo grupo não é uma quadra válida.' };
      return { isValid: true };
    }

    case 'color_7': {
      if (groups.length !== 1) return { isValid: false, error: 'Esta fase requer apenas 1 grupo.' };
      if (groups[0].length < 7) return { isValid: false, error: 'Requer pelo menos 7 cartas.' };
      if (!isValidColorSet(groups[0])) return { isValid: false, error: 'Todas as cartas devem ser da mesma cor.' };
      return { isValid: true };
    }

    case 'set_5_set_2': {
      if (groups.length !== 2) return { isValid: false, error: 'Esta fase requer exatamente 2 grupos.' };
      const g0_isS5 = isValidSet(groups[0]) && groups[0].length >= 5;
      const g0_isS2 = isValidSet(groups[0]) && groups[0].length >= 2;
      const g1_isS5 = isValidSet(groups[1]) && groups[1].length >= 5;
      const g1_isS2 = isValidSet(groups[1]) && groups[1].length >= 2;

      if ((g0_isS5 && g1_isS2) || (g0_isS2 && g1_isS5)) {
        return { isValid: true };
      }
      return { isValid: false, error: 'Requer 1 grupo de 5 cartas e 1 dupla (mesmo valor).' };
    }

    case 'set_5_set_3': {
      if (groups.length !== 2) return { isValid: false, error: 'Esta fase requer exatamente 2 grupos.' };
      const g0_isS5 = isValidSet(groups[0]) && groups[0].length >= 5;
      const g0_isS3 = isValidSet(groups[0]) && groups[0].length >= 3;
      const g1_isS5 = isValidSet(groups[1]) && groups[1].length >= 5;
      const g1_isS3 = isValidSet(groups[1]) && groups[1].length >= 3;

      if ((g0_isS5 && g1_isS3) || (g0_isS3 && g1_isS5)) {
        return { isValid: true };
      }
      return { isValid: false, error: 'Requer 1 grupo de 5 cartas e 1 trinca.' };
    }

    default:
      return { isValid: false, error: 'Tipo de fase desconhecido.' };
  }
}

// Detect which sub-group is what type for table layouts
// (E.g. if player laid down Phase 2, which list of cards is the Set of 3 and which is the Run of 4)
export function identifyGroupTypes(phaseType: PhaseType, groups: Card[][]): string[] {
  if (groups.length === 1) {
    if (phaseType === 'color_7') return ['Cor (Mín. 7)'];
    if (phaseType.startsWith('run_')) return [`Sequência (Mín. ${phaseType.slice(-1)})`];
    return ['Grupo'];
  }
  
  if (groups.length === 2) {
    if (phaseType === 'sets_2_3') return ['Trinca 1', 'Trinca 2'];
    if (phaseType === 'sets_2_4') return ['Quadra 1', 'Quadra 2'];
    
    if (phaseType === 'set_3_run_4') {
      const g0_isSet = isValidSet(groups[0]) && groups[0].length >= 3;
      if (g0_isSet) return ['Trinca', 'Sequência'];
      return ['Sequência', 'Trinca'];
    }
    
    if (phaseType === 'set_4_run_4') {
      const g0_isSet = isValidSet(groups[0]) && groups[0].length >= 4;
      if (g0_isSet) return ['Quadra', 'Sequência'];
      return ['Sequência', 'Quadra'];
    }
    
    if (phaseType === 'set_5_set_2') {
      const g0_is5 = isValidSet(groups[0]) && groups[0].length >= 5;
      if (g0_is5) return ['Grupo de 5', 'Dupla'];
      return ['Dupla', 'Grupo de 5'];
    }
    
    if (phaseType === 'set_5_set_3') {
      const g0_is5 = isValidSet(groups[0]) && groups[0].length >= 5;
      if (g0_is5) return ['Grupo de 5', 'Trinca'];
      return ['Trinca', 'Grupo de 5'];
    }
  }
  
  return groups.map((_, i) => `Grupo ${i + 1}`);
}

// Verify if a single card can be added (hit) to an existing laid-down group of cards on the table
export function isValidHit(card: Card, targetGroup: Card[], groupCategory: string): boolean {
  if (card.type === 'skip') return false; // Skip cards cannot be used on the table
  
  // Wild cards can always hit any active group!
  if (card.type === 'wild') return true;

  // Check based on identified category
  const lowerCategory = groupCategory.toLowerCase();
  
  if (lowerCategory.includes('trinca') || lowerCategory.includes('quadra') || lowerCategory.includes('dupla') || lowerCategory.includes('grupo')) {
    // It's a SET. Adding the card must keep it a valid set.
    return isValidSet([...targetGroup, card]);
  }
  
  if (lowerCategory.includes('sequência') || lowerCategory.includes('run')) {
    // It's a RUN. Adding the card must keep it a valid run.
    return isValidRun([...targetGroup, card]);
  }
  
  if (lowerCategory.includes('cor') || lowerCategory.includes('color')) {
    // It's a COLOR SET. Adding the card must keep it a valid color set.
    return isValidColorSet([...targetGroup, card]);
  }

  // Fallback: test what was valid previously
  if (isValidSet(targetGroup)) {
    return isValidSet([...targetGroup, card]);
  }
  if (isValidRun(targetGroup)) {
    return isValidRun([...targetGroup, card]);
  }
  if (isValidColorSet(targetGroup)) {
    return isValidColorSet([...targetGroup, card]);
  }

  return false;
}

// --- SMART BOT AI DECISION ENGINE ---

// Bot analyzes its hand and tries to compile its current phase
export function botTryToFormPhase(player: Player): Card[][] | null {
  const currentPhaseId = player.phase;
  const phaseDef = STANDARD_PHASES.find(p => p.id === currentPhaseId);
  if (!phaseDef) return null;

  const hand = [...player.cards];
  const type = phaseDef.type;

  // Let's filter out skips
  const usableCards = hand.filter(c => c.type !== 'skip');
  const wildCards = usableCards.filter(c => c.type === 'wild');
  const numberCards = usableCards.filter(c => c.type === 'number');

  // Helper: group number cards by value
  const valueGroups: Record<number, Card[]> = {};
  numberCards.forEach(c => {
    if (!valueGroups[c.value]) valueGroups[c.value] = [];
    valueGroups[c.value].push(c);
  });

  // Helper: group number cards by color
  const colorGroups: Record<string, Card[]> = {};
  numberCards.forEach(c => {
    if (!colorGroups[c.color]) colorGroups[c.color] = [];
    colorGroups[c.color].push(c);
  });

  // --- SOLVER ALGORITHMS ---

  // 1. Solve COLOR_7
  if (type === 'color_7') {
    // Find color with maximum count
    let bestColor = '';
    let maxCount = 0;
    Object.keys(colorGroups).forEach(color => {
      const cnt = colorGroups[color].length;
      if (cnt > maxCount) {
        maxCount = cnt;
        bestColor = color;
      }
    });

    if (maxCount + wildCards.length >= 7) {
      // We can form it!
      const matchingCards = colorGroups[bestColor] || [];
      const resultGroup = [...matchingCards];
      
      // Fill with wilds to reach 7 if needed
      let wildsNeeded = 7 - resultGroup.length;
      for (let i = 0; i < wildsNeeded && i < wildCards.length; i++) {
        resultGroup.push(wildCards[i]);
      }
      return [resultGroup.slice(0, 7)];
    }
    return null;
  }

  // 2. Solve RUNS (7, 8, 9)
  if (type === 'run_7' || type === 'run_8' || type === 'run_9') {
    const neededLength = type === 'run_7' ? 7 : type === 'run_8' ? 8 : 9;
    
    // We search for any window of size neededLength in 1-12
    for (let start = 1; start <= 13 - neededLength; start++) {
      const end = start + neededLength - 1;
      const tempWilds = [...wildCards];
      const selected: Card[] = [];
      
      for (let val = start; val <= end; val++) {
        const matches = valueGroups[val] || [];
        if (matches.length > 0) {
          selected.push(matches[0]); // take one card of this value
        } else if (tempWilds.length > 0) {
          selected.push(tempWilds.pop()!); // consume a wild
        } else {
          break; // break, cannot fill this spot
        }
      }

      if (selected.length === neededLength) {
        return [selected];
      }
    }
    return null;
  }

  // 3. Solve SETS & COMBINATIONS (2 sets, or set + run)
  
  // Helper to extract sets
  const getAvailableSets = (cardsToSearch: Card[], wildsAvailable: Card[], sizeNeeded: number): { setCards: Card[]; remainingWilds: Card[] }[] => {
    const numCards = cardsToSearch.filter(c => c.type === 'number');
    const groupsByVal: Record<number, Card[]> = {};
    numCards.forEach(c => {
      if (!groupsByVal[c.value]) groupsByVal[c.value] = [];
      groupsByVal[c.value].push(c);
    });

    const solutions: { setCards: Card[]; remainingWilds: Card[] }[] = [];

    Object.keys(groupsByVal).forEach(valStr => {
      const val = parseInt(valStr);
      const matches = groupsByVal[val];
      const matchesCount = matches.length;

      if (matchesCount >= sizeNeeded) {
        solutions.push({ setCards: matches.slice(0, sizeNeeded), remainingWilds: [...wildsAvailable] });
      } else if (matchesCount + wildsAvailable.length >= sizeNeeded) {
        const needed = sizeNeeded - matchesCount;
        solutions.push({
          setCards: [...matches, ...wildsAvailable.slice(0, needed)],
          remainingWilds: wildsAvailable.slice(needed)
        });
      }
    });

    return solutions;
  };

  if (type === 'sets_2_3') {
    const s1_candidates = getAvailableSets(usableCards, wildCards, 3);
    for (const s1 of s1_candidates) {
      // Filter out cards used in s1
      const remainingCards = usableCards.filter(c => !s1.setCards.some(used => used.id === c.id));
      const s2_candidates = getAvailableSets(remainingCards, s1.remainingWilds, 3);
      if (s2_candidates.length > 0) {
        return [s1.setCards, s2_candidates[0].setCards];
      }
    }
    return null;
  }

  if (type === 'sets_2_4') {
    const s1_candidates = getAvailableSets(usableCards, wildCards, 4);
    for (const s1 of s1_candidates) {
      const remainingCards = usableCards.filter(c => !s1.setCards.some(used => used.id === c.id));
      const s2_candidates = getAvailableSets(remainingCards, s1.remainingWilds, 4);
      if (s2_candidates.length > 0) {
        return [s1.setCards, s2_candidates[0].setCards];
      }
    }
    return null;
  }

  if (type === 'set_5_set_2') {
    const s1_candidates = getAvailableSets(usableCards, wildCards, 5);
    for (const s1 of s1_candidates) {
      const remainingCards = usableCards.filter(c => !s1.setCards.some(used => used.id === c.id));
      const s2_candidates = getAvailableSets(remainingCards, s1.remainingWilds, 2);
      if (s2_candidates.length > 0) {
        return [s1.setCards, s2_candidates[0].setCards];
      }
    }
    return null;
  }

  if (type === 'set_5_set_3') {
    const s1_candidates = getAvailableSets(usableCards, wildCards, 5);
    for (const s1 of s1_candidates) {
      const remainingCards = usableCards.filter(c => !s1.setCards.some(used => used.id === c.id));
      const s2_candidates = getAvailableSets(remainingCards, s1.remainingWilds, 3);
      if (s2_candidates.length > 0) {
        return [s1.setCards, s2_candidates[0].setCards];
      }
    }
    return null;
  }

  if (type === 'set_3_run_4' || type === 'set_4_run_4') {
    const setSize = type === 'set_3_run_4' ? 3 : 4;
    const runSize = 4;

    // Try finding set first, then sequence in remaining cards
    const setCandidates = getAvailableSets(usableCards, wildCards, setSize);
    for (const setCand of setCandidates) {
      const remaining = usableCards.filter(c => !setCand.setCards.some(used => used.id === c.id));
      const remainingWilds = setCand.remainingWilds;
      
      // Group remaining numbers
      const remNumGroups: Record<number, Card[]> = {};
      remaining.filter(c => c.type === 'number').forEach(c => {
        if (!remNumGroups[c.value]) remNumGroups[c.value] = [];
        remNumGroups[c.value].push(c);
      });

      // Look for a run of 4
      for (let start = 1; start <= 13 - runSize; start++) {
        const tempWilds = [...remainingWilds];
        const runSelected: Card[] = [];
        for (let val = start; val < start + runSize; val++) {
          const matches = remNumGroups[val] || [];
          if (matches.length > 0) {
            runSelected.push(matches[0]);
          } else if (tempWilds.length > 0) {
            runSelected.push(tempWilds.pop()!);
          } else {
            break;
          }
        }
        if (runSelected.length === runSize) {
          return [setCand.setCards, runSelected];
        }
      }
    }
    return null;
  }

  return null;
}

// Bot decides whether to draw from Discard or Draw Pile
export function botShouldDrawFromDiscard(player: Player, discardCard: Card): boolean {
  if (discardCard.type === 'wild') return true; // Always draw a wild
  if (discardCard.type === 'skip') return false; // Never draw a skip (usually not allowed, but safety first)

  // Simulation: Does the card match any value or color they are working on?
  const currentPhaseId = player.phase;
  const phaseDef = STANDARD_PHASES.find(p => p.id === currentPhaseId);
  if (!phaseDef) return false;

  // 1. Color set phase: does discard match the color we have the most of?
  if (phaseDef.type === 'color_7') {
    const colorCounts: Record<string, number> = {};
    player.cards.filter(c => c.type === 'number').forEach(c => {
      colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
    });
    let bestColor = '';
    let maxCount = 0;
    Object.entries(colorCounts).forEach(([color, count]) => {
      if (count > maxCount) {
        maxCount = count;
        bestColor = color;
      }
    });
    return discardCard.color === bestColor;
  }

  // 2. Set phase: does discard match a number we already have multiple of?
  if (phaseDef.type.includes('set') || phaseDef.type.includes('sets')) {
    const valCounts: Record<number, number> = {};
    player.cards.filter(c => c.type === 'number').forEach(c => {
      valCounts[c.value] = (valCounts[c.value] || 0) + 1;
    });
    const discardValCount = valCounts[discardCard.value] || 0;
    return discardValCount >= 1; // if we already have at least one card of this value, draw it to make a set
  }

  // 3. Run phase: is it consecutive to cards in our hand?
  if (phaseDef.type.includes('run')) {
    const uniqueVals = new Set(player.cards.filter(c => c.type === 'number').map(c => c.value));
    return uniqueVals.has(discardCard.value - 1) || uniqueVals.has(discardCard.value + 1);
  }

  return Math.random() < 0.3; // 30% random chance fallback
}

// Bot chooses which card to discard
export function botChooseDiscard(player: Player): Card {
  // Never discard a Wild unless there is literally nothing else
  // Keep Skips to play if we can skip someone, or discard them if needed
  // Prefer discarding isolated numbers that do not match other values or colors in hand

  const hand = [...player.cards];
  const skips = hand.filter(c => c.type === 'skip');
  const nonSkips = hand.filter(c => c.type !== 'skip' && c.type !== 'wild');
  const wilds = hand.filter(c => c.type === 'wild');

  // If we have skips, and we want to discard:
  // Usually, a skip can be played on an opponent. In some rule systems, a skip card is "discarded"
  // and the next player is skipped. Let's make it so discarding a skip is the mechanism to skip the next player.
  if (skips.length > 0 && Math.random() < 0.4) {
    return skips[0];
  }

  if (nonSkips.length === 0) {
    if (skips.length > 0) return skips[0];
    return wilds[0] || hand[0]; // Desperation: discard wild or any
  }

  // Count occurrences of values to keep cards that have pairs/trios
  const valueCounts: Record<number, number> = {};
  nonSkips.forEach(c => {
    valueCounts[c.value] = (valueCounts[c.value] || 0) + 1;
  });

  // Sort by count ascending, so cards that are singletons (count = 1) are discarded first
  const sortedNonSkips = [...nonSkips].sort((a, b) => {
    const countA = valueCounts[a.value];
    const countB = valueCounts[b.value];
    if (countA !== countB) return countA - countB; // lower count first
    return b.value - a.value; // prefer discarding higher values first (lower points in hand if someone else goes out)
  });

  return sortedNonSkips[0];
}

// Bot tries to hit on laid-down phases on the table
// Returns an array of hit operations if any are possible
export interface BotHitOperation {
  cardId: string;
  targetPlayerId: string;
  groupIndex: number;
}

export function botFindHits(
  player: Player,
  tablePhases: LaidDownPhase[]
): BotHitOperation[] {
  // Bots can only hit if they have ALREADY laid down their phase
  if (!player.hasLaidDownThisRound) return [];

  const hits: BotHitOperation[] = [];
  const hand = [...player.cards];
  
  // Exclude skips, keep wilds (use them selectively)
  const usableCards = hand.filter(c => c.type !== 'skip');

  for (const card of usableCards) {
    // Look through all laid down phases on table
    for (const tablePhase of tablePhases) {
      for (let groupIdx = 0; groupIdx < tablePhase.groups.length; groupIdx++) {
        const group = tablePhase.groups[groupIdx];
        
        // Identify group category (run, set, or color)
        const phaseDef = STANDARD_PHASES.find(p => p.id === tablePhase.phaseId);
        if (!phaseDef) continue;

        const categories = identifyGroupTypes(phaseDef.type, tablePhase.groups);
        const category = categories[groupIdx] || 'Grupo';

        if (isValidHit(card, group, category)) {
          // We found a valid hit!
          hits.push({
            cardId: card.id,
            targetPlayerId: tablePhase.playerId,
            groupIndex: groupIdx
          });
          // To prevent double playing the same card, let's remove it from this search round
          const idx = hand.findIndex(c => c.id === card.id);
          if (idx > -1) hand.splice(idx, 1);
          break; // move to next card
        }
      }
    }
  }

  return hits;
}

// Pre-defined funny messages that bots can send to the chat
export const BOT_CHAT_PHRASES = [
  "Eita, pegaram minha carta do lixo! 😠",
  "Alguém tem um Curinga aí pra me dar? 🃏",
  "Ufa, essa fase tá difícil demais!",
  "Quem me deu esse Skip vai ver só! 😡",
  "Estou quase batendo, preparem-se! 😈",
  "Boa jogada!",
  "Quase completei minha sequência agora.",
  "Estou travado nessa fase faz 2 rodadas... 😭",
  "Não descarta essa cor, por favor!",
  "Que sorte a sua hein!",
  "Vou ter que comprar do monte mesmo.",
  "Finalmente baixei a fase! Chora não! 😎",
  "Essa rodada acaba rápido, fiquem de olho."
];

export function getRandomBotPhrase(): string {
  const index = Math.floor(Math.random() * BOT_CHAT_PHRASES.length);
  return BOT_CHAT_PHRASES[index];
}

/** True when every player has laid down their phase this round. */
export function areAllPhasesLaidDown(players: Player[], laidDownPhases: LaidDownPhase[]): boolean {
  if (players.length === 0) return false;
  const laidDownIds = new Set(laidDownPhases.map(p => p.playerId));
  return players.every(p => laidDownIds.has(p.id) || p.hasLaidDownThisRound);
}

/** Returns how the round should end, or null if play continues. */
export function evaluateRoundEnd(
  players: Player[],
  laidDownPhases: LaidDownPhase[],
  context?: { drawPile?: { length: number }; discardPile?: { length: number } }
): { allAdvance: boolean; winner: Player | null } | null {
  const roundActive =
    laidDownPhases.length > 0 ||
    players.some(p => p.hasLaidDownThisRound || p.cards.length > 0) ||
    (context?.drawPile?.length ?? 0) > 0 ||
    (context?.discardPile?.length ?? 0) > 0;

  if (!roundActive) return null;

  const allLaidDown = areAllPhasesLaidDown(players, laidDownPhases);
  const wentOutPlayer = players.find(p => p.cards.length === 0) ?? null;

  if (allLaidDown) {
    return { allAdvance: true, winner: null };
  }
  if (wentOutPlayer) {
    return { allAdvance: false, winner: wentOutPlayer };
  }
  return null;
}
