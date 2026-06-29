export class PublicRoomDto {
  id!: string;
  code!: string;
  hostName!: string;
  playerCount!: number;
  maxPlayers!: number;
  hasPassword!: boolean;
  status!: string;
  createdAt!: Date;
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
}
