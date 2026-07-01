export type SuitSymbol = '♠' | '♥' | '♦' | '♣';

export type TrucoSuit = 'clubs' | 'hearts' | 'spades' | 'diamonds';

export const TRUCO_SUIT_SYMBOL: Record<TrucoSuit, SuitSymbol> = {
  clubs: '♣',
  hearts: '♥',
  spades: '♠',
  diamonds: '♦',
};

export interface TrucoCard {
  id: string;
  suit: TrucoSuit;
  rank: number;
}

export interface TrucoPlayer {
  id: string;
  name: string;
  avatar: string;
  color?: string;
  isBot: boolean;
  cards: TrucoCard[];
  team: 0 | 1;
}

export type TrucoBidLevel = 1 | 3 | 6 | 9 | 12;

export interface TrucoTrickPlay {
  playerIndex: number;
  card: TrucoCard;
}

export interface TrucoRoom {
  id: string;
  code: string;
  hostId: string;
  players: TrucoPlayer[];
  status: 'playing' | 'game_over';
  maxPlayers: number;
  teamScores: [number, number];
  roundHandValue: TrucoBidLevel;
  pendingBid: TrucoBidLevel | null;
  biddingTeam: 0 | 1 | null;
  awaitingResponseFromTeam: 0 | 1 | null;
  trickNumber: number;
  currentTrick: TrucoTrickPlay[];
  trickWinners: (number | null)[];
  currentTurnIndex: number;
  roundStarterIndex: number;
  vira: TrucoCard | null;
  deck: TrucoCard[];
  log: string[];
  winnerTeam: 0 | 1 | null;
  roundSummary: string | null;
  stateVersion?: number;
  currentTurnStartedAt?: number;
  settings: {
    gameMode: 'bots' | 'pass_and_play' | 'online';
    botDelay: number;
    cardGame: 'truco';
  };
}
