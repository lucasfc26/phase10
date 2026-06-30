import type { CardGameId } from './games/types';

export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild' | 'skip';

export interface Card {
  id: string;
  type: 'number' | 'wild' | 'skip';
  value: number; // 1 to 12, or 0 for skip/wild
  color: CardColor;
}

export type PhaseType =
  | 'sets_2_3'           // 1: 2 sets of 3
  | 'set_3_run_4'        // 2: 1 set of 3 + 1 run of 4
  | 'set_4_run_4'        // 3: 1 set of 4 + 1 run of 4
  | 'run_7'              // 4: 1 run of 7
  | 'run_8'              // 5: 1 run of 8
  | 'run_9'              // 6: 1 run of 9
  | 'sets_2_4'           // 7: 2 sets of 4
  | 'color_7'            // 8: 7 cards of 1 color
  | 'set_5_set_2'        // 9: 1 set of 5 + 1 set of 2
  | 'set_5_set_3';       // 10: 1 set of 5 + 1 set of 3

export interface PhaseDefinition {
  id: number;
  name: string;
  description: string;
  type: PhaseType;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  botDifficulty?: 'easy' | 'medium' | 'hard';
  cards: Card[];
  phase: number;          // Current phase (1 to 10)
  hasLaidDownThisRound: boolean;
  score: number;
  isSkipped: boolean;     // If player is skipped on their next turn
  color?: string;         // Theme color
}

export interface GameLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'action' | 'phase';
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderAvatar: string;
  senderColor: string;
  message: string;
  timestamp: string;
  isSystem?: boolean;
}

export interface LaidDownPhase {
  playerId: string;
  playerName: string;
  playerColor: string;
  phaseId: number;
  // Expressed as groups of cards, e.g. [ [Card, Card, Card], [Card, Card, Card, Card] ]
  groups: Card[][];
}

export interface GameRoom {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  status: 'lobby' | 'playing' | 'round_end' | 'game_over';
  maxPlayers: number;
  currentTurnIndex: number;
  drawPile: Card[];
  discardPile: Card[];
  phaseSets: PhaseDefinition[];
  laidDownPhases: LaidDownPhase[]; // All phases laid down on table in this round
  roundNumber: number;
  winnerId: string | null;
  hasDrawnThisTurn?: boolean;
  stateVersion?: number;
  settings: {
    gameMode: 'bots' | 'pass_and_play' | 'online'; // Added 'online'
    botDelay: number; // milliseconds
    customPhases: boolean;
    allowBots: boolean; // Option to allow bots or not
    roomPassword?: string;
    cardGame?: CardGameId;
  };
}

export const STANDARD_PHASES: PhaseDefinition[] = [
  { id: 1, name: "Fase 1", description: "2 Trincas (2 grupos de 3 cartas de mesmo valor)", type: "sets_2_3" },
  { id: 2, name: "Fase 2", description: "1 Trinca + 1 Sequência de 4 cartas", type: "set_3_run_4" },
  { id: 3, name: "Fase 3", description: "1 Quadra + 1 Sequência de 4 cartas", type: "set_4_run_4" },
  { id: 4, name: "Fase 4", description: "1 Sequência de 7 cartas", type: "run_7" },
  { id: 5, name: "Fase 5", description: "1 Sequência de 8 cartas", type: "run_8" },
  { id: 6, name: "Fase 6", description: "1 Sequência de 9 cartas", type: "run_9" },
  { id: 7, name: "Fase 7", description: "2 Quadras (2 grupos de 4 cartas de mesmo valor)", type: "sets_2_4" },
  { id: 8, name: "Fase 8", description: "7 cartas de uma mesma cor", type: "color_7" },
  { id: 9, name: "Fase 9", description: "1 Grupo de 5 + 1 Dupla (mesmo valor)", type: "set_5_set_2" },
  { id: 10, name: "Fase 10", description: "1 Grupo de 5 + 1 Trinca (mesmo valor)", type: "set_5_set_3" },
];
