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

import { OnlineGameService } from '../game/online-game.service';

import { AnyGameState } from '../common/card-game.types';

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

  private roomActionChains = new Map<string, Promise<unknown>>();

  private static readonly BOT_TURN_TIMEOUT_MS = 60 * 1000;

  private static readonly EMPTY_LOBBY_MS = 3 * 60 * 1000;

  private static readonly INACTIVITY_MS = 60 * 60 * 1000;

  private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  private cleanupTimer?: ReturnType<typeof setInterval>;



  constructor(

    private readonly roomsService: RoomsService,

    private readonly gameService: GameService,

    private readonly onlineGameService: OnlineGameService,

  ) {}



  onModuleInit() {

    void this.cleanupInactiveRooms();

    this.cleanupTimer = setInterval(() => {

      void this.cleanupInactiveRooms();

    }, RoomsGateway.CLEANUP_INTERVAL_MS);

  }



  onModuleDestroy() {

    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

  }



  private async cleanupInactiveRooms() {

    const emptyDeleted = await this.roomsService.deleteEmptyLobbyRooms(
      RoomsGateway.EMPTY_LOBBY_MS,
    );

    const deleted = await this.roomsService.deleteInactiveRooms(RoomsGateway.INACTIVITY_MS);

    for (const roomId of new Set([...emptyDeleted, ...deleted])) {

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



  @SubscribeMessage('lobby:set_ready')

  async setReady(

    @ConnectedSocket() client: Socket,

    @MessageBody() body: { ready?: boolean },

  ) {

    const memberId = client.data.memberId as string;

    const roomId = client.data.roomId as string;

    try {

      const lobby = await this.roomsService.setMemberReady(

        roomId,

        memberId,

        body?.ready !== false,

      );

      this.server.to(roomId).emit('lobby:update', lobby);

      return { ok: true };

    } catch (err) {

      const message = err instanceof Error ? err.message : 'Erro ao marcar pronto.';

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



    return this.runSerializedRoomAction(roomId, async () => {

    try {

      if (action.type === 'next_round') {
        const current = await this.roomsService.getGameRoom(roomId);
        this.roomsService.assertStateVersion(current, action.expectedStateVersion);
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

      const masked = this.onlineGameService.maskStateForPlayer(gameRoom, memberId);
      return { ok: true, room: masked };
      }

      await this.roomsService.assertMemberCanPlay(memberId, roomId);

      let gameRoom = await this.roomsService.getGameRoom(roomId);
      this.roomsService.assertStateVersion(gameRoom, action.expectedStateVersion);

      const result = this.onlineGameService.applyAction(gameRoom, memberId, action);

      gameRoom = await this.roomsService.saveGameRoom(roomId, result.state);



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

      const masked = this.onlineGameService.maskStateForPlayer(gameRoom, memberId);

      return { ok: true, room: masked, privateMessages: result.privateMessages, privateReveals: result.privateReveals };

    } catch (err) {

      const message = err instanceof Error ? err.message : 'Ação inválida.';

      return { error: message };

    }

    });

  }



  private shouldPersistAfterBotTurn(gameRoom: AnyGameState): boolean {
    return this.onlineGameService.shouldPersistAfterBotTurn(gameRoom);
  }

  private async publishBotGameState(
    roomId: string,
    gameRoom: AnyGameState,
    persist: boolean,
  ): Promise<AnyGameState> {
    if (persist) {
      const saved = await this.roomsService.saveGameRoom(roomId, gameRoom);
      await this.broadcastGameState(roomId, saved);
      return saved;
    }
    this.roomsService.setCachedGameRoom(roomId, gameRoom);
    await this.broadcastGameState(roomId, gameRoom);
    return gameRoom;
  }

  private emitBotLogs(
    roomId: string,
    result:
      | { logs?: Array<{ id: string; message: string; type: string; timestamp: string }> }
      | { log?: string; logType?: string; skipLogs?: string[] },
  ) {
    const logs = 'logs' in result ? result.logs || [] : [];
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
  }

  private async scheduleBotTurns(roomId: string) {

    if (this.botProcessingRooms.has(roomId)) return;

    this.botProcessingRooms.add(roomId);

    let pendingPersist = false;

    try {

      while (true) {

        let gameRoom;

        try {

          gameRoom = await this.roomsService.getGameRoom(roomId);

        } catch {

          break;

        }



        if (gameRoom.status !== 'playing') break;



        if (!this.onlineGameService.isBotTurn(gameRoom)) break;



        const turnStartedAt = gameRoom.currentTurnStartedAt ?? Date.now();

        const turnAge = Date.now() - turnStartedAt;



        if (turnAge >= RoomsGateway.BOT_TURN_TIMEOUT_MS) {

          const skipResult = this.onlineGameService.skipStuckBotTurn(gameRoom);

          gameRoom = skipResult.state;

          this.emitBotLogs(roomId, skipResult);

          pendingPersist = !this.shouldPersistAfterBotTurn(gameRoom);

          gameRoom = await this.publishBotGameState(
            roomId,
            gameRoom,
            !pendingPersist,
          );

          if (!pendingPersist) {
            continue;
          }

          pendingPersist = false;
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



        if (!this.onlineGameService.isBotTurn(gameRoom)) break;



        const ageAfterWait = Date.now() - (gameRoom.currentTurnStartedAt ?? Date.now());

        if (ageAfterWait >= RoomsGateway.BOT_TURN_TIMEOUT_MS) {

          continue;

        }



        let result;

        try {

          result = this.onlineGameService.executeBotTurn(gameRoom);

        } catch {

          result = this.onlineGameService.skipStuckBotTurn(gameRoom);

        }

        gameRoom = result.state;

        this.emitBotLogs(roomId, result);

        pendingPersist = true;

        const persistNow = this.shouldPersistAfterBotTurn(gameRoom);

        gameRoom = await this.publishBotGameState(roomId, gameRoom, persistNow);

        if (persistNow) pendingPersist = false;

      }

      if (pendingPersist) {
        try {
          const gameRoom = await this.roomsService.getGameRoom(roomId);
          await this.publishBotGameState(roomId, gameRoom, true);
        } catch {
          // room may have been deleted
        }
      }

    } finally {

      this.botProcessingRooms.delete(roomId);

    }

  }



  private async runSerializedRoomAction<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.roomActionChains.get(roomId) ?? Promise.resolve();
    const next = prev.then(() => fn());
    this.roomActionChains.set(roomId, next);
    try {
      return await next;
    } finally {
      if (this.roomActionChains.get(roomId) === next) {
        this.roomActionChains.delete(roomId);
      }
    }
  }

  private async broadcastGameState(roomId: string, gameRoom: AnyGameState) {
    const sockets = await this.server.in(roomId).fetchSockets();

    for (const socket of sockets) {
      const viewerId = socket.data.memberId as string;
      const masked = this.onlineGameService.maskStateForPlayer(gameRoom, viewerId);
      socket.emit('game:state', masked);
    }
  }

}


