import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameActionDto } from '../game/dto/game-action.dto';
import { GameService } from '../game/game.service';
import { RoomsService } from './rooms.service';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/game',
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private memberSockets = new Map<string, string>();

  constructor(
    private readonly roomsService: RoomsService,
    private readonly gameService: GameService,
  ) {}

  async handleConnection(client: Socket) {
    const token = (client.handshake.auth?.token || client.handshake.query?.token) as string;
    if (!token) {
      client.disconnect();
      return;
    }

    const member = await this.roomsService.findMemberByToken(token);
    if (!member) {
      client.disconnect();
      return;
    }

    client.data.memberId = member.id;
    client.data.roomId = member.roomId;
    this.memberSockets.set(member.id, client.id);

    await this.roomsService.bindSocket(member.id, client.id);
    client.join(member.roomId);

    const lobby = await this.roomsService.getLobbyState(member.roomId);
    this.server.to(member.roomId).emit('lobby:update', lobby);

    const masked = await this.roomsService.getMaskedGameState(member.roomId, member.id);
    if (masked) {
      client.emit('game:state', masked);
    }
  }

  async handleDisconnect(client: Socket) {
    const memberId = client.data.memberId as string | undefined;
    if (!memberId) return;
    this.memberSockets.delete(memberId);
    await this.roomsService.bindSocket(memberId, null);

    const roomId = client.data.roomId as string;
    if (roomId) {
      const lobby = await this.roomsService.getLobbyState(roomId);
      this.server.to(roomId).emit('lobby:update', lobby);
    }
  }

  @SubscribeMessage('lobby:refresh')
  async refreshLobby(@ConnectedSocket() client: Socket) {
    const roomId = client.data.roomId as string;
    const lobby = await this.roomsService.getLobbyState(roomId);
    client.emit('lobby:update', lobby);
  }

  @SubscribeMessage('game:start')
  async startGame(@ConnectedSocket() client: Socket) {
    const memberId = client.data.memberId as string;
    const roomId = client.data.roomId as string;

    const gameRoom = await this.roomsService.startGame(roomId, memberId);
    await this.broadcastGameState(roomId, gameRoom);

    const lobby = await this.roomsService.getLobbyState(roomId);
    this.server.to(roomId).emit('lobby:update', lobby);
  }

  @SubscribeMessage('game:action')
  async gameAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() action: GameActionDto,
  ) {
    const memberId = client.data.memberId as string;
    const roomId = client.data.roomId as string;

    let gameRoom = await this.roomsService.getGameRoom(roomId);
    const result = this.gameService.applyAction(gameRoom, memberId, action);
    gameRoom = result.gameRoom;
    await this.roomsService.saveGameRoom(roomId, gameRoom);

    if (result.log) {
      this.server.to(roomId).emit('game:log', {
        id: Date.now().toString(),
        message: result.log,
        type: result.logType || 'info',
        timestamp: new Date().toLocaleTimeString(),
      });
    }

    await this.broadcastGameState(roomId, gameRoom);
  }

  private async broadcastGameState(roomId: string, gameRoom: import('../common/game.types').GameRoom) {
    const sockets = await this.server.in(roomId).fetchSockets();
    for (const socket of sockets) {
      const viewerId = socket.data.memberId as string;
      socket.emit('game:state', this.gameService.maskStateForPlayer(gameRoom, viewerId));
    }
  }
}
