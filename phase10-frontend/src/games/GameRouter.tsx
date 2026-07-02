import { GameBoard } from '../components/GameBoard';
import type { GameRoom } from '../types';
import { PokerBoard } from './poker/PokerBoard';
import type { PokerRoom } from './poker/types';
import { TrucoBoard } from './truco/TrucoBoard';
import type { TrucoRoom } from './truco/types';
import type { CardGameId, GamePlayerProfile } from './types';
import type { RoomSession } from '../services/onlineApi';

export type ActiveGameState =
  | { cardGame: 'phase10'; room: GameRoom; session?: RoomSession | null }
  | { cardGame: 'tower_master'; room: GameRoom; session?: RoomSession | null }
  | { cardGame: 'truco'; room: TrucoRoom; session?: RoomSession | null }
  | { cardGame: 'poker'; room: PokerRoom; session?: RoomSession | null };

interface GameRouterProps {
  game: ActiveGameState;
  playerProfile: GamePlayerProfile;
  onExit: () => void;
  masterVolume?: number;
  onMasterVolumeChange?: (volume: number) => void;
  onPhasesOnTableChange?: (hasPhases: boolean) => void;
}

export function GameRouter({
  game,
  playerProfile,
  onExit,
  masterVolume,
  onMasterVolumeChange,
  onPhasesOnTableChange,
}: GameRouterProps) {
  if (game.cardGame === 'truco') {
    return (
      <TrucoBoard
        initialRoom={game.room}
        playerProfile={playerProfile}
        onlineSession={game.session ?? null}
        onExit={onExit}
        masterVolume={masterVolume}
        onMasterVolumeChange={onMasterVolumeChange}
      />
    );
  }

  if (game.cardGame === 'poker') {
    return (
      <PokerBoard
        initialRoom={game.room}
        playerProfile={playerProfile}
        onlineSession={game.session ?? null}
        onExit={onExit}
        masterVolume={masterVolume}
        onMasterVolumeChange={onMasterVolumeChange}
      />
    );
  }

  return (
    <GameBoard
      initialRoom={game.room}
      playerProfile={playerProfile}
      onlineSession={game.session ?? null}
      onExit={onExit}
      masterVolume={masterVolume}
      onMasterVolumeChange={onMasterVolumeChange}
      onPhasesOnTableChange={onPhasesOnTableChange}
    />
  );
}

export function isPhase10Game(game: ActiveGameState): game is { cardGame: 'phase10'; room: GameRoom } {
  return game.cardGame === 'phase10';
}

export function getActiveCardGameId(game: ActiveGameState): CardGameId {
  return game.cardGame;
}
