import type { GameRoom, Player } from '../types';

export type TurnTimeoutPhase = 'draw' | 'discard';

export function getActiveTurnTimeout(
  room: GameRoom,
  activePlayer: Player | undefined,
  options: {
    isOnline: boolean;
    isTowerMaster: boolean;
    turnState: 'drawing' | 'playing' | 'idle';
    showTransition: boolean;
    offlinePhaseStartedAt: number;
  },
): { phase: TurnTimeoutPhase; limitMs: number; startedAt: number } | null {
  if (room.status !== 'playing' || !activePlayer) return null;

  const drawLimit = room.settings.drawTimeoutMs ?? 0;
  const discardLimit = room.settings.discardTimeoutMs ?? 0;
  const frozen = options.isTowerMaster && !!activePlayer.towerCannotDraw;

  if (options.isOnline) {
    const inDrawPhase = !room.hasDrawnThisTurn && !frozen;
    const limitMs = inDrawPhase ? drawLimit : discardLimit;
    if (limitMs <= 0) return null;
    return {
      phase: inDrawPhase ? 'draw' : 'discard',
      limitMs,
      startedAt: room.currentTurnStartedAt ?? Date.now(),
    };
  }

  if (options.showTransition || activePlayer.isBot || options.turnState === 'idle') {
    return null;
  }

  const inDrawPhase = options.turnState === 'drawing' && !frozen;
  const limitMs = inDrawPhase ? drawLimit : discardLimit;
  if (!inDrawPhase && options.turnState !== 'playing' && !frozen) return null;
  if (limitMs <= 0) return null;

  return {
    phase: inDrawPhase ? 'draw' : 'discard',
    limitMs,
    startedAt: options.offlinePhaseStartedAt,
  };
}

export function getSecondsRemaining(startedAt: number, limitMs: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((startedAt + limitMs - now) / 1000));
}
