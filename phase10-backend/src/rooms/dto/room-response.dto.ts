export class PublicRoomDto {
  id!: string;
  code!: string;
  hostName!: string;
  playerCount!: number;
  maxPlayers!: number;
  hasPassword!: boolean;
  status!: string;
  createdAt!: Date;
  cardGame?: 'phase10' | 'truco' | 'poker' | 'tower_master';
}

export class RoomSessionDto {
  roomId!: string;
  code!: string;
  memberId!: string;
  sessionToken!: string;
  isHost!: boolean;
  waitingForNextRound?: boolean;
}

export class LobbyPlayerDto {
  id!: string;
  name!: string;
  avatar!: string;
  color!: string;
  isBot!: boolean;
  isConnected!: boolean;
  seatIndex!: number;
  waitingForNextRound?: boolean;
  isReady?: boolean;
}

export class LobbyStateDto {
  roomId!: string;
  code!: string;
  status!: string;
  maxPlayers!: number;
  hostMemberId!: string;
  players!: LobbyPlayerDto[];
  hasPassword!: boolean;
  allowBots!: boolean;
  cardGame?: 'phase10' | 'truco' | 'poker' | 'tower_master';
}
