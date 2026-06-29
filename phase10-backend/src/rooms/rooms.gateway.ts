import {

  ConnectedSocket,

  MessageBody,

  OnGatewayConnection,

  OnGatewayDisconnect,

  SubscribeMessage,

  WebSocketGateway,

  WebSocketServer,

} from '@nestjs/websockets';

import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Server, Socket } from 'socket.io';

import { GameActionDto } from '../game/dto/game-action.dto';

import { GameService } from '../game/game.service';

import { RoomsService } from './rooms.service';



@WebSocketGateway({

  cors: { origin: true, credentials: true },

  namespace: '/game',

})

export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {

  @WebSocketServer()

  server!: Server;



  private memberSockets = new Map<string, string>();

  private botProcessingRooms = new Set<string>();

  private static readonly BOT_TURN_TIMEOUT_MS = 60 * 1000;

  private static readonly INACTIVITY_MS = 60 * 60 * 1000;

  private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  private cleanupTimer?: ReturnType<typeof setInterval>;



  constructor(

    private readonly roomsService: RoomsService,

    private readonly gameService: GameService,

  ) {}



  onModuleInit() {

    this.cleanupTimer = setInterval(() => {

      void this.cleanupInactiveRooms();

    }, RoomsGateway.CLEANUP_INTERVAL_MS);

  }



  onModuleDestroy() {

    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

  }



  private async cleanupInactiveRooms() {

    const deleted = await this.roomsService.deleteInactiveRooms(RoomsGateway.INACTIVITY_MS);

    for (const roomId of deleted) {

      this.botProcessingRooms.delete(roomId);

      this.server.to(roomId).emit('room:deleted', {

        roomId,

        reason: 'inactive',

      });

    }

  }



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



    const result = await this.roomsService.leaveLobbyMember(memberId);



    if (result) {

      await this.broadcastAfterMemberLeave(result);

    }

  }



  @SubscribeMessage('room:leave')

  async leaveRoom(@ConnectedSocket() client: Socket) {

    const memberId = client.data.memberId as string | undefined;

    if (!memberId) return;



    const result = await this.roomsService.leaveLobbyMember(memberId);

    this.memberSockets.delete(memberId);

    client.disconnect();



    if (result) {

      await this.broadcastAfterMemberLeave(result);

    }

  }



  private async broadcastAfterMemberLeave(

    result: { type: 'member_left'; roomId: string } | { type: 'room_deleted'; roomId: string },

  ) {

    if (result.type === 'room_deleted') {

      this.botProcessingRooms.delete(result.roomId);

      this.server.to(result.roomId).emit('room:deleted', {

        roomId: result.roomId,

        reason: 'host_left',

      });

      return;

    }



    try {

      const lobby = await this.roomsService.getLobbyState(result.roomId);

      this.server.to(result.roomId).emit('lobby:update', lobby);

    } catch {

      // Sala pode ter sido removida em condição de corrida.

    }

  }



  @SubscribeMessage('lobby:refresh')

  async refreshLobby(@ConnectedSocket() client: Socket) {

    const roomId = client.data.roomId as string;

    const lobby = await this.roomsService.getLobbyState(roomId);

    client.emit('lobby:update', lobby);

  }



  @SubscribeMessage('lobby:add_bot')

  async addBot(@ConnectedSocket() client: Socket) {

    const memberId = client.data.memberId as string;

    const roomId = client.data.roomId as string;

    try {

      const lobby = await this.roomsService.addBotToRoom(roomId, memberId);

      this.server.to(roomId).emit('lobby:update', lobby);

      return { ok: true };

    } catch (err) {

      const message = err instanceof Error ? err.message : 'Erro ao adicionar bot.';

      return { error: message };

    }

  }



  @SubscribeMessage('lobby:remove_bot')

  async removeBot(

    @ConnectedSocket() client: Socket,

    @MessageBody() body: { botMemberId: string },

  ) {

    const memberId = client.data.memberId as string;

    const roomId = client.data.roomId as string;

    try {

      const lobby = await this.roomsService.removeBotFromRoom(roomId, memberId, body.botMemberId);

      this.server.to(roomId).emit('lobby:update', lobby);

      return { ok: true };

    } catch (err) {

      const message = err instanceof Error ? err.message : 'Erro ao remover bot.';

      return { error: message };

    }

  }



  @SubscribeMessage('game:start')

  async startGame(@ConnectedSocket() client: Socket) {

    const memberId = client.data.memberId as string;

    const roomId = client.data.roomId as string;



    try {

      const gameRoom = await this.roomsService.startGame(roomId, memberId);

      await this.broadcastGameState(roomId, gameRoom);



      const lobby = await this.roomsService.getLobbyState(roomId);

      this.server.to(roomId).emit('lobby:update', lobby);



      void this.scheduleBotTurns(roomId);

      return { ok: true };

    } catch (err) {

      const message = err instanceof Error ? err.message : 'Erro ao iniciar partida.';

      return { error: message };

    }

  }



  @SubscribeMessage('game:action')

  async gameAction(

    @ConnectedSocket() client: Socket,

    @MessageBody() action: GameActionDto,

  ) {

    const memberId = client.data.memberId as string;

    const roomId = client.data.roomId as string;



    try {

      if (action.type === 'next_round') {
        const result = await this.roomsService.startNextRound(roomId, memberId);
        const gameRoom = result.gameRoom;

        this.server.to(roomId).emit('game:log', {
          id: Date.now().toString(),
          message: result.log,
          type: result.logType || 'info',
          timestamp: new Date().toLocaleTimeString(),
        });

        await this.broadcastGameState(roomId, gameRoom);
        void this.scheduleBotTurns(roomId);

        const lobby = await this.roomsService.getLobbyState(roomId);
        this.server.to(roomId).emit('lobby:update', lobby);

        const masked = this.gameService.maskStateForPlayer(gameRoom, memberId);
        return { ok: true, room: masked };
      }

      await this.roomsService.assertMemberCanPlay(memberId, roomId);

      let gameRoom = await this.roomsService.getGameRoom(roomId);

      const result = this.gameService.applyAction(gameRoom, memberId, action);

      gameRoom = result.gameRoom;

      await this.roomsService.saveGameRoom(roomId, gameRoom);



      for (const skipLog of result.skipLogs || []) {

        this.server.to(roomId).emit('game:log', {

          id: `${Date.now()}-skip-${Math.random().toString(36).slice(2, 7)}`,

          message: skipLog,

          type: 'warning',

          timestamp: new Date().toLocaleTimeString(),

        });

      }



      if (result.log) {

        this.server.to(roomId).emit('game:log', {

          id: Date.now().toString(),

          message: result.log,

          type: result.logType || 'info',

          timestamp: new Date().toLocaleTimeString(),

        });

      }



      await this.broadcastGameState(roomId, gameRoom);

      void this.scheduleBotTurns(roomId);

      const masked = this.gameService.maskStateForPlayer(gameRoom, memberId);

      return { ok: true, room: masked };

    } catch (err) {

      const message = err instanceof Error ? err.message : 'Ação inválida.';

      return { error: message };

    }

  }



  private async scheduleBotTurns(roomId: string) {

    if (this.botProcessingRooms.has(roomId)) return;

    this.botProcessingRooms.add(roomId);



    try {

      while (true) {

        let gameRoom;

        try {

          gameRoom = await this.roomsService.getGameRoom(roomId);

        } catch {

          break;

        }



        if (gameRoom.status !== 'playing') break;



        const active = gameRoom.players[gameRoom.currentTurnIndex];

        if (!active?.isBot) break;



        const turnStartedAt = gameRoom.currentTurnStartedAt ?? Date.now();

        const turnAge = Date.now() - turnStartedAt;



        if (turnAge >= RoomsGateway.BOT_TURN_TIMEOUT_MS) {

          const skipResult = this.gameService.skipStuckBotTurn(gameRoom);

          gameRoom = skipResult.gameRoom;

          await this.roomsService.saveGameRoom(roomId, gameRoom);



          if (skipResult.log) {

            this.server.to(roomId).emit('game:log', {

              id: Date.now().toString(),

              message: skipResult.log,

              type: skipResult.logType || 'warning',

              timestamp: new Date().toLocaleTimeString(),

            });

          }



          for (const skipLog of skipResult.skipLogs || []) {

            this.server.to(roomId).emit('game:log', {

              id: `${Date.now()}-skip-${Math.random().toString(36).slice(2, 7)}`,

              message: skipLog,

              type: 'warning',

              timestamp: new Date().toLocaleTimeString(),

            });

          }



          await this.broadcastGameState(roomId, gameRoom);

          continue;

        }



        const waitMs = Math.min(

          gameRoom.settings.botDelay,

          RoomsGateway.BOT_TURN_TIMEOUT_MS - turnAge,

        );

        await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 0)));



        try {

          gameRoom = await this.roomsService.getGameRoom(roomId);

        } catch {

          break;

        }



        if (gameRoom.status !== 'playing') break;



        const stillActive = gameRoom.players[gameRoom.currentTurnIndex];

        if (!stillActive?.isBot) break;



        const ageAfterWait = Date.now() - (gameRoom.currentTurnStartedAt ?? Date.now());

        if (ageAfterWait >= RoomsGateway.BOT_TURN_TIMEOUT_MS) {

          continue;

        }



        let result;

        try {

          result = this.gameService.executeBotTurn(gameRoom);

        } catch {

          result = this.gameService.skipStuckBotTurn(gameRoom);

        }

        gameRoom = result.gameRoom;

        await this.roomsService.saveGameRoom(roomId, gameRoom);



        const logs = 'logs' in result ? result.logs : [];

        for (const log of logs) {

          this.server.to(roomId).emit('game:log', log);

        }



        if ('log' in result && result.log) {

          this.server.to(roomId).emit('game:log', {

            id: Date.now().toString(),

            message: result.log,

            type: result.logType || 'warning',

            timestamp: new Date().toLocaleTimeString(),

          });

        }



        for (const skipLog of ('skipLogs' in result ? result.skipLogs : []) || []) {

          this.server.to(roomId).emit('game:log', {

            id: `${Date.now()}-skip-${Math.random().toString(36).slice(2, 7)}`,

            message: skipLog,

            type: 'warning',

            timestamp: new Date().toLocaleTimeString(),

          });

        }



        await this.broadcastGameState(roomId, gameRoom);

      }

    } finally {

      this.botProcessingRooms.delete(roomId);

    }

  }



  private async broadcastGameState(roomId: string, gameRoom: import('../common/game.types').GameRoom) {

    const sockets = await this.server.in(roomId).fetchSockets();

    for (const socket of sockets) {

      const viewerId = socket.data.memberId as string;

      const masked = await this.roomsService.getMaskedGameState(roomId, viewerId);

      if (masked) {

        socket.emit('game:state', masked);

      }

    }

  }

}


