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
  | { cardGame: 'truco'; room: TrucoRoom }
  | { cardGame: 'poker'; room: PokerRoom };

interface GameRouterProps {
  game: ActiveGameState;
  playerProfile: GamePlayerProfile;
  onExit: () => void;
  initialSoundEnabled?: boolean;
}

export function GameRouter({
  game,
  playerProfile,
  onExit,
  initialSoundEnabled,
}: GameRouterProps) {
  if (game.cardGame === 'truco') {
    return (
      <TrucoBoard
        initialRoom={game.room}
        playerProfile={playerProfile}
        onExit={onExit}
        initialSoundEnabled={initialSoundEnabled}
      />
    );
  }

  if (game.cardGame === 'poker') {
    return (
      <PokerBoard
        initialRoom={game.room}
        playerProfile={playerProfile}
        onExit={onExit}
        initialSoundEnabled={initialSoundEnabled}
      />
    );
  }

  return (
    <GameBoard
      initialRoom={game.room}
      playerProfile={playerProfile}
      onlineSession={game.session ?? null}
      onExit={onExit}
      initialSoundEnabled={initialSoundEnabled}
    />
  );
}

export function isPhase10Game(game: ActiveGameState): game is { cardGame: 'phase10'; room: GameRoom } {
  return game.cardGame === 'phase10';
}
