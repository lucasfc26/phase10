import { generateId } from '../../gameEngine';
import { compareHands, evaluateBestHand, handStrengthScore } from './handRank';
import type { PokerCard, PokerPlayer, PokerRoom, PokerShowdownEntry, PokerSuit } from './types';

const SUITS: PokerSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1];

export function createPokerDeck(): PokerCard[] {
  const deck: PokerCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `poker-${suit}-${rank}-${generateId()}`, suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck<T>(deck: T[]): T[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function addLog(room: PokerRoom, message: string): PokerRoom {
  return { ...room, log: [message, ...room.log].slice(0, 50) };
}

function activePlayers(room: PokerRoom): number[] {
  return room.players
    .map((_, i) => i)
    .filter((i) => !room.players[i].folded && !room.players[i].allIn);
}

function playersInHand(room: PokerRoom): number[] {
  return room.players.map((_, i) => i).filter((i) => !room.players[i].folded);
}

function resetRoundBets(players: PokerPlayer[]): PokerPlayer[] {
  return players.map((p) => ({ ...p, currentBet: 0 }));
}

function nextActiveIndex(room: PokerRoom, from: number): number | null {
  const total = room.players.length;
  for (let step = 1; step <= total; step++) {
    const idx = (from + step) % total;
    const p = room.players[idx];
    if (!p.folded && !p.allIn && p.chips >= 0) return idx;
  }
  return null;
}

function allMatched(room: PokerRoom): boolean {
  const active = activePlayers(room);
  if (active.length <= 1) return true;
  return active.every((i) => room.players[i].currentBet === room.currentBet);
}

function bettingComplete(room: PokerRoom): boolean {
  const active = activePlayers(room);
  if (active.length <= 1) return true;
  if (!allMatched(room)) return false;
  if (room.lastAggressorIndex === null) {
    return active.every((i) => room.players[i].currentBet === room.currentBet);
  }
  const afterAggressor = active.filter((i) => i !== room.lastAggressorIndex);
  return afterAggressor.every((i) => room.players[i].currentBet === room.currentBet);
}

function collectPot(players: PokerPlayer[]): { players: PokerPlayer[]; pot: number } {
  let pot = 0;
  const updated = players.map((p) => {
    pot += p.currentBet;
    return { ...p, currentBet: 0 };
  });
  return { players: updated, pot };
}

function dealCommunity(room: PokerRoom, count: number): PokerRoom {
  const deck = [...room.deck];
  const drawn = deck.splice(-count);
  return {
    ...room,
    deck,
    communityCards: [...room.communityCards, ...drawn],
  };
}

function advanceStreet(room: PokerRoom): PokerRoom {
  let next = { ...room, currentBet: 0, minRaise: room.bigBlind, lastAggressorIndex: null };
  next.players = resetRoundBets(next.players);

  if (next.street === 'preflop') {
    next = dealCommunity(next, 3);
    next.street = 'flop';
    next = addLog(next, 'Flop revelado.');
  } else if (next.street === 'flop') {
    next = dealCommunity(next, 1);
    next.street = 'turn';
    next = addLog(next, 'Turn revelado.');
  } else if (next.street === 'turn') {
    next = dealCommunity(next, 1);
    next.street = 'river';
    next = addLog(next, 'River revelado.');
  } else if (next.street === 'river') {
    return resolveShowdown(next);
  }

  const first = nextActiveIndex(next, next.dealerIndex);
  next.currentPlayerIndex = first ?? next.currentPlayerIndex;
  return next;
}

function resolveShowdown(room: PokerRoom): PokerRoom {
  const inHand = playersInHand(room);
  const showdown: PokerShowdownEntry[] = inHand.map((i) => {
    const cards = [...room.players[i].holeCards, ...room.communityCards];
    const evalHand = evaluateBestHand(cards);
    return {
      playerIndex: i,
      handName: evalHand.name,
      handRank: evalHand.rank,
      cards: evalHand.bestFive,
    };
  });

  let best = showdown[0];
  const winners = [best];
  for (let i = 1; i < showdown.length; i++) {
    const cmp = compareHands(
      evaluateBestHand([...room.players[showdown[i].playerIndex].holeCards, ...room.communityCards]),
      evaluateBestHand([...room.players[best.playerIndex].holeCards, ...room.communityCards]),
    );
    if (cmp > 0) {
      best = showdown[i];
      winners.length = 0;
      winners.push(best);
    } else if (cmp === 0) {
      winners.push(showdown[i]);
    }
  }

  const share = Math.floor(room.pot / winners.length);
  const players = room.players.map((p, i) => {
    if (winners.some((w) => w.playerIndex === i)) {
      return { ...p, chips: p.chips + share };
    }
    return p;
  });

  const winnerNames = winners.map((w) => room.players[w.playerIndex].name).join(', ');
  const summary = `${winnerNames} vence(m) com ${best.handName} — ${share} fichas cada.`;

  const eliminated = players.filter((p) => p.chips <= 0 && !p.folded).length;
  const alive = players.filter((p) => p.chips > 0);
  const gameOver = alive.length === 1;

  return addLog(
    {
      ...room,
      players,
      pot: 0,
      street: 'showdown',
      showdown,
      winnerIds: winners.map((w) => room.players[w.playerIndex].id),
      roundSummary: summary,
      status: gameOver ? 'game_over' : room.status,
    },
    summary,
  );
}

export function createInitialPokerRoom(
  players: PokerPlayer[],
  code: string,
  hostId: string,
  settings: PokerRoom['settings'],
): PokerRoom {
  const room: PokerRoom = {
    id: `poker-${generateId()}`,
    code,
    hostId,
    players,
    status: 'playing',
    maxPlayers: players.length,
    deck: [],
    communityCards: [],
    pot: 0,
    street: 'preflop',
    dealerIndex: 0,
    currentPlayerIndex: 0,
    currentBet: 0,
    minRaise: 20,
    smallBlind: 10,
    bigBlind: 20,
    lastAggressorIndex: null,
    log: [],
    winnerIds: [],
    roundSummary: null,
    showdown: [],
    settings,
  };
  return startNewPokerHand(room);
}

export function startNewPokerHand(room: PokerRoom): PokerRoom {
  if (room.status === 'game_over') return room;

  const eligible = room.players.filter((p) => p.chips > 0);
  if (eligible.length < 2) {
    return { ...room, status: 'game_over', roundSummary: 'Jogo encerrado — apenas um jogador restante.' };
  }

  let deck = shuffleDeck(createPokerDeck());
  const dealerIndex = (room.dealerIndex + 1) % room.players.length;

  let players = room.players.map((p) => ({
    ...p,
    holeCards: [] as PokerCard[],
    currentBet: 0,
    folded: p.chips <= 0,
    allIn: false,
  }));

  for (let i = 0; i < room.players.length; i++) {
    if (players[i].folded) continue;
    players[i] = {
      ...players[i],
      holeCards: [deck.pop()!, deck.pop()!],
    };
  }

  const sbIndex = nextActiveIndex({ ...room, players }, dealerIndex)!;
  const bbIndex = nextActiveIndex({ ...room, players }, sbIndex)!;

  players = postBlind(players, sbIndex, room.smallBlind);
  players = postBlind(players, bbIndex, room.bigBlind);

  const pot = players.reduce((sum, p) => sum + p.currentBet, 0);
  const firstToAct = nextActiveIndex({ ...room, players }, bbIndex)!;

  return addLog(
    {
      ...room,
      players,
      deck,
      communityCards: [],
      pot,
      street: 'preflop',
      dealerIndex,
      currentPlayerIndex: firstToAct,
      currentBet: room.bigBlind,
      minRaise: room.bigBlind,
      lastAggressorIndex: bbIndex,
      winnerIds: [],
      roundSummary: null,
      showdown: [],
    },
    `Nova mão — dealer: ${room.players[dealerIndex]?.name ?? '?'}.`,
  );
}

function postBlind(players: PokerPlayer[], index: number, amount: number): PokerPlayer[] {
  return players.map((p, i) => {
    if (i !== index || p.folded) return p;
    const pay = Math.min(amount, p.chips);
    const chips = p.chips - pay;
    return {
      ...p,
      chips,
      currentBet: pay,
      allIn: chips === 0,
    };
  });
}

function applyBet(room: PokerRoom, playerIndex: number, amount: number, isRaise: boolean): PokerRoom {
  const player = room.players[playerIndex];
  const pay = Math.min(amount, player.chips);
  const players = room.players.map((p, i) => {
    if (i !== playerIndex) return p;
    const chips = p.chips - pay;
    const currentBet = p.currentBet + pay;
    return { ...p, chips, currentBet, allIn: chips === 0 };
  });

  const newCurrentBet = Math.max(room.currentBet, players[playerIndex].currentBet);
  const raiseSize = players[playerIndex].currentBet - room.currentBet;
  const minRaise = isRaise ? Math.max(room.minRaise, raiseSize) : room.minRaise;

  let next = {
    ...room,
    players,
    currentBet: newCurrentBet,
    minRaise,
    lastAggressorIndex: isRaise ? playerIndex : room.lastAggressorIndex,
    pot: room.pot + pay,
  };

  if (playersInHand(next).length === 1) {
    const { players: collected, pot } = collectPot(next.players);
    const winnerIdx = playersInHand({ ...next, players: collected })[0];
    const winner = collected[winnerIdx];
    collected[winnerIdx] = { ...winner, chips: winner.chips + next.pot + pot };
    return addLog(
      { ...next, players: collected, pot: 0, roundSummary: `${winner.name} venceu — todos desistiram.` },
      `${winner.name} venceu a mão.`,
    );
  }

  const everyoneAllIn = activePlayers(next).length === 0;
  const roundDone = everyoneAllIn || bettingComplete(next);

  if (roundDone) {
    const { players: collected, pot } = collectPot(next.players);
    next = { ...next, players: collected, pot: next.pot + pot };
    // Avança apenas uma rua por vez; all-in continua via autoAdvanceStreet na UI
    if (next.street !== 'showdown') {
      return advanceStreet(next);
    }
  }

  const nextPlayer = nextActiveIndex(next, playerIndex);
  next.currentPlayerIndex = nextPlayer ?? playerIndex;
  return next;
}

export function pokerFold(room: PokerRoom, playerIndex: number): PokerRoom {
  if (room.currentPlayerIndex !== playerIndex || room.roundSummary) return room;
  const players = room.players.map((p, i) =>
    i === playerIndex ? { ...p, folded: true } : p,
  );
  return applyBet({ ...room, players }, playerIndex, 0, false);
}

export function pokerCheck(room: PokerRoom, playerIndex: number): PokerRoom {
  if (room.currentPlayerIndex !== playerIndex || room.roundSummary) return room;
  if (room.players[playerIndex].currentBet < room.currentBet) return room;
  return applyBet(room, playerIndex, 0, false);
}

export function pokerCall(room: PokerRoom, playerIndex: number): PokerRoom {
  if (room.currentPlayerIndex !== playerIndex || room.roundSummary) return room;
  const toCall = room.currentBet - room.players[playerIndex].currentBet;
  if (toCall <= 0) return pokerCheck(room, playerIndex);
  return applyBet(room, playerIndex, toCall, false);
}

export function pokerRaise(room: PokerRoom, playerIndex: number, totalBet: number): PokerRoom {
  if (room.currentPlayerIndex !== playerIndex || room.roundSummary) return room;
  const player = room.players[playerIndex];
  const target = Math.max(totalBet, room.currentBet + room.minRaise);
  const add = target - player.currentBet;
  if (add <= 0) return room;
  return applyBet(room, playerIndex, add, true);
}

export function pokerAllIn(room: PokerRoom, playerIndex: number): PokerRoom {
  if (room.currentPlayerIndex !== playerIndex || room.roundSummary) return room;
  return applyBet(room, playerIndex, room.players[playerIndex].chips, true);
}

export function dismissPokerRoundSummary(room: PokerRoom): PokerRoom {
  if (!room.roundSummary) return room;
  if (room.status === 'game_over') return room;
  return startNewPokerHand({ ...room, roundSummary: null });
}

export function mapLobbyToPokerPlayers(
  lobbyPlayers: { id: string; name: string; avatar: string; color?: string; isBot: boolean }[],
): PokerPlayer[] {
  return lobbyPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    color: p.color,
    isBot: p.isBot,
    holeCards: [],
    chips: 1000,
    currentBet: 0,
    folded: false,
    allIn: false,
  }));
}

export function botPokerAction(room: PokerRoom, playerIndex: number): 'fold' | 'check' | 'call' | 'raise' | 'all_in' {
  const player = room.players[playerIndex];
  const allCards = [...player.holeCards, ...room.communityCards];
  const strength = allCards.length >= 2 ? handStrengthScore(allCards) : 0;
  const toCall = room.currentBet - player.currentBet;

  if (strength < 2_000_000 && toCall > player.chips * 0.3) return 'fold';
  if (toCall === 0) {
    if (strength > 4_000_000 && Math.random() > 0.5) return 'raise';
    return 'check';
  }
  if (strength > 5_000_000 && Math.random() > 0.55) return 'raise';
  if (toCall <= player.chips * 0.25 || strength > 3_000_000) return 'call';
  return Math.random() > 0.6 ? 'fold' : 'call';
}

export function getHumanPlayerIndex(room: PokerRoom, humanName: string): number {
  const idx = room.players.findIndex((p) => !p.isBot && p.name === humanName);
  return idx >= 0 ? idx : 0;
}

/** Todos all-in: revelar próxima rua com pausa na UI (flop → turn → river → showdown). */
export function canAutoAdvanceStreet(room: PokerRoom): boolean {
  if (room.roundSummary || room.street === 'showdown') return false;
  if (playersInHand(room).length <= 1) return false;
  return activePlayers(room).length === 0;
}

export function autoAdvanceStreet(room: PokerRoom): PokerRoom {
  if (!canAutoAdvanceStreet(room)) return room;
  return advanceStreet(room);
}

export function visibleCommunityCount(street: PokerRoom['street']): number {
  if (street === 'preflop') return 0;
  if (street === 'flop') return 3;
  if (street === 'turn') return 4;
  return 5;
}

export function formatPokerCard(card: PokerCard): string {
  const labels: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const rank = labels[card.rank] ?? String(card.rank);
  const symbols: Record<PokerSuit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  return `${rank}${symbols[card.suit]}`;
}
