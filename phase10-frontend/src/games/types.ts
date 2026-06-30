export type CardGameId = 'phase10' | 'truco' | 'poker' | 'tower_master';

export interface GamePlayerProfile {
  name: string;
  avatar: string;
  color: string;
}

export interface GameBoardProps<T> {
  initialRoom: T;
  playerProfile: GamePlayerProfile;
  onExit: () => void;
  initialSoundEnabled?: boolean;
}
