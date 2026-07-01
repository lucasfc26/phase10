import { generateId } from '../../game/game-engine';
import type {
  TrucoBidLevel,
  TrucoCard,
  TrucoPlayer,
  TrucoRoom,
  TrucoSuit,
  TrucoTrickPlay,
} from './types';

const SUITS: TrucoSuit[] = ['clubs', 'hearts', 'spades', 'diamonds'];
const RANKS = [4, 5, 6, 7, 11, 12, 13, 1, 2, 3];

export function createTrucoDeck(): TrucoCard[] {
  const deck: TrucoCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `truco-${suit}-${rank}-${generateId()}`, suit, rank });
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

/** Força da carta no Truco (manilhas fixas). */
export function getCardStrength(card: TrucoCard): number {
  if (card.rank === 4 && card.suit === 'clubs') return 100;
  if (card.rank === 7 && card.suit === 'hearts') return 99;
  if (card.rank === 1 && card.suit === 'spades') return 98;
  if (card.rank === 7 && card.suit === 'diamonds') return 97;

  const order: Record<number, number> = {
    3: 89,
    2: 88,
    1: 87,
    13: 86,
    11: 85,
    12: 84,
    7: 83,
    6: 82,
    5: 81,
    4: 80,
  };
  return order[card.rank] ?? 0;
}

export function getTeam(playerIndex: number): 0 | 1 {
  return (playerIndex % 2) as 0 | 1;
}

function nextBid(current: TrucoBidLevel): TrucoBidLevel | null {
  if (current === 1) return 3;
  if (current === 3) return 6;
  if (current === 6) return 9;
  if (current === 9) return 12;
  return null;
}

function previousBid(current: TrucoBidLevel): TrucoBidLevel {
  if (current === 3) return 1;
  if (current === 6) return 3;
  if (current === 9) return 6;
  if (current === 12) return 9;
  return 1;
}

function resolveTrickWinner(plays: TrucoTrickPlay[]): number | null {
  if (plays.length === 0) return null;

  let bestIndex = plays[0].playerIndex;
  let bestStrength = getCardStrength(plays[0].card);
  let tied = false;

  for (let i = 1; i < plays.length; i++) {
    const strength = getCardStrength(plays[i].card);
    if (strength > bestStrength) {
      bestStrength = strength;
      bestIndex = plays[i].playerIndex;
      tied = false;
    } else if (strength === bestStrength) {
      tied = true;
    }
  }

  return tied ? null : bestIndex;
}

function determineRoundWinner(trickWinners: (number | null)[]): number | null {
  const wins = [0, 0, 0, 0];
  for (const w of trickWinners) {
    if (w !== null) wins[w]++;
  }

  let bestPlayer: number | null = null;
  let bestCount = 0;
  for (let i = 0; i < 4; i++) {
    if (wins[i] > bestCount) {
      bestCount = wins[i];
      bestPlayer = i;
    }
  }

  if (bestCount >= 2 && bestPlayer !== null) return bestPlayer;

  const teamWins: [number, number] = [0, 0];
  for (let i = 0; i < 4; i++) {
    teamWins[getTeam(i)] += wins[i];
  }
  if (teamWins[0] > teamWins[1]) return 0;
  if (teamWins[1] > teamWins[0]) return 1;
  return null;
}

function addLog(room: TrucoRoom, message: string): TrucoRoom {
  return { ...room, log: [message, ...room.log].slice(0, 50) };
}

export function createInitialTrucoRoom(
  players: TrucoPlayer[],
  code: string,
  hostId: string,
  settings: TrucoRoom['settings'],
): TrucoRoom {
  const room: TrucoRoom = {
    id: `truco-${generateId()}`,
    code,
    hostId,
    players,
    status: 'playing',
    maxPlayers: 4,
    teamScores: [0, 0],
    roundHandValue: 1,
    pendingBid: null,
    biddingTeam: null,
    awaitingResponseFromTeam: null,
    trickNumber: 0,
    currentTrick: [],
    trickWinners: [],
    currentTurnIndex: 0,
    roundStarterIndex: 0,
    vira: null,
    deck: [],
    log: [],
    winnerTeam: null,
    roundSummary: null,
    settings,
  };
  return startNewTrucoRound(room);
}

export function startNewTrucoRound(room: TrucoRoom): TrucoRoom {
  if (room.status === 'game_over') return room;

  const deck = shuffleDeck(createTrucoDeck());
  const vira = deck.pop() ?? null;

  const players = room.players.map((p, idx) => ({
    ...p,
    team: getTeam(idx),
    cards: [deck.pop()!, deck.pop()!, deck.pop()!],
  }));

  const starter = (room.roundStarterIndex + 1) % 4;

  return {
    ...room,
    players,
    deck,
    vira,
    roundHandValue: 1,
    pendingBid: null,
    biddingTeam: null,
    awaitingResponseFromTeam: null,
    trickNumber: 0,
    currentTrick: [],
    trickWinners: [],
    currentTurnIndex: starter,
    roundStarterIndex: starter,
    roundSummary: null,
    log: [`Nova mão — ${players[starter]?.name} começa.`, ...room.log].slice(
      0,
      50,
    ),
  };
}

export function canPlayCard(room: TrucoRoom, playerIndex: number): boolean {
  return (
    room.status === 'playing' &&
    !room.roundSummary &&
    !room.awaitingResponseFromTeam &&
    room.currentTurnIndex === playerIndex &&
    room.currentTrick.length < 4
  );
}

export function playTrucoCard(
  room: TrucoRoom,
  playerIndex: number,
  cardId: string,
): TrucoRoom {
  if (!canPlayCard(room, playerIndex)) return room;

  const player = room.players[playerIndex];
  const cardIndex = player.cards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return room;

  const card = player.cards[cardIndex];
  const players = room.players.map((p, i) =>
    i === playerIndex
      ? { ...p, cards: p.cards.filter((c) => c.id !== cardId) }
      : p,
  );

  const currentTrick: TrucoTrickPlay[] = [
    ...room.currentTrick,
    { playerIndex, card },
  ];
  let next: TrucoRoom = { ...room, players, currentTrick };

  if (currentTrick.length < 4) {
    return { ...next, currentTurnIndex: (playerIndex + 1) % 4 };
  }

  const winner = resolveTrickWinner(currentTrick);
  const trickWinners = [...room.trickWinners, winner];
  const trickNumber = room.trickNumber + 1;

  next = addLog(
    next,
    winner !== null
      ? `Vaza ${trickNumber}: ${room.players[winner].name} venceu com ${formatCard(card)}.`
      : `Vaza ${trickNumber}: empate.`,
  );

  if (trickNumber >= 3) {
    return finishTrucoRound({
      ...next,
      trickWinners,
      trickNumber,
      currentTrick: [],
    });
  }

  const nextStarter = winner ?? (room.roundStarterIndex + trickNumber) % 4;
  return {
    ...next,
    trickWinners,
    trickNumber,
    currentTrick: [],
    currentTurnIndex: nextStarter,
  };
}

function finishTrucoRound(room: TrucoRoom): TrucoRoom {
  const roundWinner = determineRoundWinner(room.trickWinners);

  if (roundWinner === null) {
    return addLog(
      { ...room, roundSummary: 'Empate na mão — ninguém pontua.' },
      'Mão empatada.',
    );
  }

  const winningTeam = getTeam(roundWinner);

  const teamScores: [number, number] = [...room.teamScores] as [number, number];
  teamScores[winningTeam] += room.roundHandValue;

  const winnerTeam = teamScores[0] >= 12 ? 0 : teamScores[1] >= 12 ? 1 : null;
  const status = winnerTeam !== null ? 'game_over' : 'playing';

  const summary = `Time ${winningTeam + 1} ganhou ${room.roundHandValue} ponto(s)! Placar: ${teamScores[0]} × ${teamScores[1]}`;

  return addLog(
    {
      ...room,
      teamScores,
      winnerTeam,
      status,
      roundSummary: summary,
    },
    summary,
  );
}

export function callTruco(room: TrucoRoom, playerIndex: number): TrucoRoom {
  if (room.awaitingResponseFromTeam !== null || room.roundSummary) return room;
  if (room.currentTurnIndex !== playerIndex) return room;

  const nextValue = nextBid(room.roundHandValue);
  if (!nextValue) return room;

  const team = getTeam(playerIndex);
  const opponentTeam = (1 - team) as 0 | 1;

  return addLog(
    {
      ...room,
      pendingBid: nextValue,
      biddingTeam: team,
      awaitingResponseFromTeam: opponentTeam,
    },
    `${room.players[playerIndex].name} pediu ${bidLabel(nextValue)}!`,
  );
}

export function acceptTrucoBid(room: TrucoRoom): TrucoRoom {
  if (room.pendingBid === null || room.awaitingResponseFromTeam === null)
    return room;

  return addLog(
    {
      ...room,
      roundHandValue: room.pendingBid,
      pendingBid: null,
      biddingTeam: null,
      awaitingResponseFromTeam: null,
    },
    `${bidLabel(room.pendingBid)} aceito! Vale ${room.pendingBid} ponto(s).`,
  );
}

export function refuseTrucoBid(room: TrucoRoom): TrucoRoom {
  if (room.pendingBid === null || room.biddingTeam === null) return room;

  const points = previousBid(room.pendingBid);
  const teamScores: [number, number] = [...room.teamScores] as [number, number];
  teamScores[room.biddingTeam] += points;

  const winnerTeam = teamScores[0] >= 12 ? 0 : teamScores[1] >= 12 ? 1 : null;
  const status = winnerTeam !== null ? 'game_over' : 'playing';
  const summary = `Time ${room.biddingTeam + 1} ganhou ${points} ponto(s) (correram). Placar: ${teamScores[0]} × ${teamScores[1]}`;

  return addLog(
    {
      ...room,
      teamScores,
      winnerTeam,
      status,
      pendingBid: null,
      biddingTeam: null,
      awaitingResponseFromTeam: null,
      roundSummary: summary,
    },
    summary,
  );
}

export function dismissTrucoRoundSummary(room: TrucoRoom): TrucoRoom {
  if (!room.roundSummary) return room;
  if (room.status === 'game_over') return room;
  return startNewTrucoRound({ ...room, roundSummary: null });
}

export function formatCard(card: TrucoCard): string {
  const labels: Record<number, string> = {
    1: 'A',
    11: 'J',
    12: 'Q',
    13: 'K',
  };
  const rank = labels[card.rank] ?? String(card.rank);
  const suitMap: Record<TrucoSuit, string> = {
    clubs: '♣',
    hearts: '♥',
    spades: '♠',
    diamonds: '♦',
  };
  return `${rank}${suitMap[card.suit]}`;
}

function bidLabel(value: TrucoBidLevel): string {
  if (value === 3) return 'Truco';
  if (value === 6) return 'Seis';
  if (value === 9) return 'Nove';
  if (value === 12) return 'Doze';
  return `${value}`;
}

export function botChooseTrucoCard(
  room: TrucoRoom,
  playerIndex: number,
): string | null {
  const player = room.players[playerIndex];
  if (player.cards.length === 0) return null;

  const sorted = [...player.cards].sort(
    (a, b) => getCardStrength(b) - getCardStrength(a),
  );

  const trick = room.currentTrick;
  if (trick.length === 0) {
    return sorted[sorted.length - 1]?.id ?? null;
  }

  const bestOnTable = Math.max(...trick.map((p) => getCardStrength(p.card)));
  const canWin = sorted.find((c) => getCardStrength(c) > bestOnTable);
  return (canWin ?? sorted[sorted.length - 1])?.id ?? null;
}

export function botShouldCallTruco(
  room: TrucoRoom,
  playerIndex: number,
): boolean {
  const strengths = room.players[playerIndex].cards.map(getCardStrength);
  const avg = strengths.reduce((a, b) => a + b, 0) / strengths.length;
  return avg >= 90 && Math.random() > 0.6;
}

export function botShouldAcceptBid(room: TrucoRoom, team: 0 | 1): boolean {
  const teamCards = room.players
    .filter((_, i) => getTeam(i) === team)
    .flatMap((p) => p.cards);
  const avg =
    teamCards.reduce((sum, c) => sum + getCardStrength(c), 0) /
    Math.max(teamCards.length, 1);
  return avg >= 85 || Math.random() > 0.45;
}

export function getHumanPlayerIndex(
  room: TrucoRoom,
  humanName: string,
): number {
  const idx = room.players.findIndex((p) => !p.isBot && p.name === humanName);
  return idx >= 0 ? idx : 0;
}

export function isHumanTurn(room: TrucoRoom, humanIndex: number): boolean {
  return (
    room.players[room.currentTurnIndex]?.id === room.players[humanIndex]?.id
  );
}

export function mapLobbyToTrucoPlayers(
  lobbyPlayers: {
    id: string;
    name: string;
    avatar: string;
    color?: string;
    isBot: boolean;
  }[],
): TrucoPlayer[] {
  return lobbyPlayers.map((p, idx) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    color: p.color,
    isBot: p.isBot,
    cards: [],
    team: getTeam(idx),
  }));
}
