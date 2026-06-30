import type { SuitSymbol } from '../shared/SuitCard';

export type PokerSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export const POKER_SUIT_SYMBOL: Record<PokerSuit, SuitSymbol> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export interface PokerCard {
  id: string;
  suit: PokerSuit;
  rank: number;
}

export interface PokerPlayer {
  id: string;
  name: string;
  avatar: string;
  color?: string;
  isBot: boolean;
  holeCards: PokerCard[];
  chips: number;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
}

export type PokerStreet = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface PokerShowdownEntry {
  playerIndex: number;
  handName: string;
  handRank: number;
  cards: PokerCard[];
}

export interface PokerRoom {
  id: string;
  code: string;
  hostId: string;
  players: PokerPlayer[];
  status: 'playing' | 'game_over';
  maxPlayers: number;
  deck: PokerCard[];
  communityCards: PokerCard[];
  pot: number;
  street: PokerStreet;
  dealerIndex: number;
  currentPlayerIndex: number;
  currentBet: number;
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  lastAggressorIndex: number | null;
  log: string[];
  winnerIds: string[];
  roundSummary: string | null;
  showdown: PokerShowdownEntry[];
  settings: {
    gameMode: 'bots' | 'pass_and_play' | 'online';
    botDelay: number;
    cardGame: 'poker';
  };
}
