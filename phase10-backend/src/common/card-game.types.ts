import { GameRoom } from './game.types';
import { PokerRoom } from '../games/poker/types';
import { TrucoRoom } from '../games/truco/types';

export type CardGameId = 'phase10' | 'truco' | 'poker' | 'tower_master';

export type AnyGameState = GameRoom | TrucoRoom | PokerRoom;

export function getCardGameFromState(state: AnyGameState): CardGameId {
  const cardGame = state.settings?.cardGame;
  if (cardGame === 'truco' || cardGame === 'poker' || cardGame === 'tower_master') {
    return cardGame;
  }
  return 'phase10';
}

export function isPhaseStyleRoom(state: AnyGameState): state is GameRoom {
  return getCardGameFromState(state) === 'phase10' || getCardGameFromState(state) === 'tower_master';
}
