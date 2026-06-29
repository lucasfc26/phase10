import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_BOT_DELAY_MS } from '../common/game.constants';
import { GameService } from '../game/game.service';
import { GameRoom } from '../common/game.types';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import {
  LobbyStateDto,
  PublicRoomDto,
  RoomSessionDto,
} from './dto/room-response.dto';
import { Room, RoomMember } from './entities/room.entities';

@Injectable()
export class RoomsService {
  private readonly roomRepo: Repository<Room>;
  private readonly memberRepo: Repository<RoomMember>;
  private readonly gameRoomCache = new Map<string, GameRoom>();
  private publicRoomsCache: { at: number; data: PublicRoomDto[] } | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly gameService: GameService,
  ) {
    this.roomRepo = this.dataSource.getRepository(Room);
    this.memberRepo = this.dataSource.getRepository(RoomMember);
  }

  private generateCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = this.generateCode();
      const exists = await this.roomRepo.findOne({ where: { code } });
      if (!exists) return code;
    }
    return this.generateCode() + 'X';
  }

  private toSession(room: Room, member: RoomMember): RoomSessionDto {
    return {
      roomId: room.id,
      code: room.code,
      memberId: member.id,
      sessionToken: member.sessionToken,
      isHost: room.hostMemberId === member.id,
      waitingForNextRound: member.waitingForNextRound ?? false,
    };
  }

  invalidateGameRoomCache(roomId: string): void {
    this.gameRoomCache.delete(roomId);
  }

  setCachedGameRoom(roomId: string, gameRoom: GameRoom): void {
    this.gameRoomCache.set(roomId, gameRoom);
  }

  private invalidatePublicRoomsCache(): void {
    this.publicRoomsCache = null;
  }

  async listPublicRooms(): Promise<PublicRoomDto[]> {
    await this.deleteEmptyLobbyRooms(2 * 60 * 1000);

    if (
      this.publicRoomsCache &&
      Date.now() - this.publicRoomsCache.at < 4000
    ) {
      return this.publicRoomsCache.data;
    }

    const rooms = await this.roomRepo.find({
      where: [{ status: 'lobby' }, { status: 'playing' }, { status: 'round_end' }],
      relations: { members: true },
      order: { createdAt: 'DESC' },
    });

    const result = rooms
      .map((room) => {
      const host = room.members?.find((m) => m.id === room.hostMemberId);
      const activeCount =
        room.members?.filter((m) => m.isBot || m.isConnected).length || 0;
      return {
        id: room.id,
        code: room.code,
        hostName: host?.name || 'Host',
        playerCount: activeCount,
        maxPlayers: room.maxPlayers,
        hasPassword: !!room.passwordHash,
        status: room.status,
        createdAt: room.createdAt,
      };
    })
      .filter((room) => room.status !== 'lobby' || room.playerCount > 0);

    this.publicRoomsCache = { at: Date.now(), data: result };
    return result;
  }

  async createRoom(dto: CreateRoomDto): Promise<{ session: RoomSessionDto; lobby: LobbyStateDto }> {
    const code = await this.uniqueCode();
    const memberId = uuidv4();
    const sessionToken = uuidv4();

    const room = this.roomRepo.create({
      code,
      passwordHash: dto.password ? await bcrypt.hash(dto.password, 8) : null,
      hostMemberId: memberId,
      maxPlayers: dto.maxPlayers,
      status: 'lobby',
      settings: {
        gameMode: 'online',
        botDelay: DEFAULT_BOT_DELAY_MS,
        customPhases: false,
        allowBots: dto.allowBots ?? true,
      },
      roundNumber: 1,
      lastActivityAt: new Date(),
    });

    const savedRoom = await this.roomRepo.save(room);

    const member = this.memberRepo.create({
      id: memberId,
      roomId: savedRoom.id,
      name: dto.name,
      avatar: dto.avatar,
      color: dto.color,
      isBot: false,
      sessionToken,
      seatIndex: 0,
      isConnected: false,
    });

    await this.memberRepo.save(member);

    await this.touchRoomActivity(savedRoom.id);
    this.invalidatePublicRoomsCache();

    const lobby = await this.getLobbyState(savedRoom.id);
    return { session: this.toSession(savedRoom, member), lobby };
  }

  async joinRoom(dto: JoinRoomDto): Promise<{ session: RoomSessionDto; lobby: LobbyStateDto }> {
    const room = await this.roomRepo.findOne({
      where: { code: dto.code.toUpperCase() },
      relations: { members: true },
    });

    if (!room) throw new NotFoundException('Sala não encontrada.');

    if (room.passwordHash) {
      if (!dto.password) throw new ForbiddenException('Senha obrigatória.');
      const ok = await bcrypt.compare(dto.password, room.passwordHash);
      if (!ok) throw new ForbiddenException('Senha incorreta.');
    }

    const normalizedName = dto.name.trim().toLowerCase();

    // Reconectar jogador que saiu (mesmo nome, desconectado)
    const existingDisconnected = room.members?.find(
      (m) => !m.isConnected && m.name.trim().toLowerCase() === normalizedName,
    );
    if (existingDisconnected) {
      existingDisconnected.sessionToken = uuidv4();
      existingDisconnected.avatar = dto.avatar;
      existingDisconnected.color = dto.color;
      await this.memberRepo.save(existingDisconnected);
      await this.touchRoomActivity(room.id);
      const lobby = await this.getLobbyState(room.id);
      return { session: this.toSession(room, existingDisconnected), lobby };
    }

    if ((room.members?.length || 0) >= room.maxPlayers) {
      throw new BadRequestException('Sala cheia.');
    }

    const joiningMidGame = room.status !== 'lobby';

    const memberId = uuidv4();
    const sessionToken = uuidv4();
    const seatIndex = room.members?.length || 0;

    const member = this.memberRepo.create({
      id: memberId,
      roomId: room.id,
      name: dto.name.trim(),
      avatar: dto.avatar,
      color: dto.color,
      isBot: false,
      sessionToken,
      seatIndex,
      isConnected: false,
      waitingForNextRound: joiningMidGame,
    });

    await this.memberRepo.save(member);

    await this.touchRoomActivity(room.id);
    this.invalidatePublicRoomsCache();

    const lobby = await this.getLobbyState(room.id);
    return { session: this.toSession(room, member), lobby };
  }

  async touchRoomActivity(roomId: string): Promise<void> {
    await this.roomRepo.update(roomId, { lastActivityAt: new Date() });
  }

  /** Remove lobbies abandonados (sem jogadores ativos: conectados ou bots). */
  async deleteEmptyLobbyRooms(maxIdleMs: number): Promise<string[]> {
    const cutoff = new Date(Date.now() - maxIdleMs);
    const rooms = await this.roomRepo.find({
      where: { status: 'lobby' },
      relations: { members: true },
    });

    const deletedIds: string[] = [];
    for (const room of rooms) {
      const members = room.members ?? [];
      const activeCount = members.filter((m) => m.isBot || m.isConnected).length;
      if (activeCount > 0) continue;

      const lastTouch = room.lastActivityAt ?? room.createdAt ?? room.updatedAt;
      if (lastTouch >= cutoff) continue;

      this.invalidateGameRoomCache(room.id);
      await this.roomRepo.delete(room.id);
      deletedIds.push(room.id);
    }

    if (deletedIds.length > 0) {
      this.invalidatePublicRoomsCache();
    }
    return deletedIds;
  }

  /** Remove salas sem atividade (jogadas ou alterações no lobby) por mais de maxIdleMs. */
  async deleteInactiveRooms(maxIdleMs: number): Promise<string[]> {
    const cutoff = new Date(Date.now() - maxIdleMs);
    const stale = await this.roomRepo
      .createQueryBuilder('room')
      .where('datetime(COALESCE(room.lastActivityAt, room.updatedAt)) < datetime(:cutoff)', {
        cutoff: cutoff.toISOString(),
      })
      .getMany();

    const deletedIds: string[] = [];
    for (const room of stale) {
      this.invalidateGameRoomCache(room.id);
      await this.roomRepo.delete(room.id);
      deletedIds.push(room.id);
    }
    this.invalidatePublicRoomsCache();
    return deletedIds;
  }

  async getLobbyState(roomId: string): Promise<LobbyStateDto> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: { members: true },
    });
    if (!room) throw new NotFoundException('Sala não encontrada.');

    const players = (room.members || [])
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((m) => ({
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        color: m.color,
        isBot: m.isBot,
        isConnected: m.isConnected,
        seatIndex: m.seatIndex,
        waitingForNextRound: m.waitingForNextRound ?? false,
      }));

    return {
      roomId: room.id,
      code: room.code,
      status: room.status,
      maxPlayers: room.maxPlayers,
      hostMemberId: room.hostMemberId,
      players,
      hasPassword: !!room.passwordHash,
      allowBots: (room.settings as GameRoom['settings']).allowBots ?? false,
    };
  }

  async findMemberByToken(token: string): Promise<RoomMember | null> {
    return this.memberRepo.findOne({ where: { sessionToken: token } });
  }

  async bindSocket(memberId: string, socketId: string | null): Promise<void> {
    await this.memberRepo.update(memberId, {
      socketId,
      isConnected: !!socketId,
    });
  }

  /** Remove jogador do lobby ou encerra a sala se o host sair. */
  async leaveLobbyMember(
    memberId: string,
  ): Promise<{ type: 'member_left'; roomId: string } | { type: 'room_deleted'; roomId: string } | null> {
    const member = await this.memberRepo.findOne({ where: { id: memberId } });
    if (!member) return null;

    const room = await this.roomRepo.findOne({ where: { id: member.roomId } });
    if (!room) {
      await this.memberRepo.delete(memberId);
      return null;
    }

    if (room.hostMemberId === memberId) {
      const roomId = room.id;
      const members = await this.memberRepo.find({ where: { roomId } });
      const others = members.filter((m) => m.id !== memberId);

      if (room.status === 'lobby' && others.length === 0) {
        this.invalidateGameRoomCache(roomId);
        await this.roomRepo.delete(roomId);
        this.invalidatePublicRoomsCache();
        return { type: 'room_deleted', roomId };
      }

      if (room.status === 'lobby' && others.length > 0) {
        const nextHost = others.sort((a, b) => a.seatIndex - b.seatIndex)[0];
        await this.roomRepo.update(roomId, { hostMemberId: nextHost.id });
        await this.bindSocket(memberId, null);
        return { type: 'member_left', roomId };
      }

      this.invalidateGameRoomCache(roomId);
      await this.roomRepo.delete(roomId);
      this.invalidatePublicRoomsCache();
      return { type: 'room_deleted', roomId };
    }

    if (room.status !== 'lobby') {
      if (member.waitingForNextRound) {
        await this.memberRepo.delete(memberId);
        return { type: 'member_left', roomId: member.roomId };
      }
      await this.bindSocket(memberId, null);
      return { type: 'member_left', roomId: member.roomId };
    }

    await this.memberRepo.delete(memberId);
    return { type: 'member_left', roomId: member.roomId };
  }

  private readonly BOT_NAMES = [
    'AlphaBot',
    'BetaMind',
    'CardShark',
    'PhaseMaster',
    'SkipKing',
    'WildCard',
    'TrincaBot',
    'SequenciaAI',
  ];

  private readonly BOT_AVATARS = ['🤖', '🦾', '🧠', '👾', '🎮', '⚡', '🃏', '🎯'];
  private readonly BOT_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

  async addBotToRoom(roomId: string, hostMemberId: string): Promise<LobbyStateDto> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: { members: true },
    });
    if (!room) throw new NotFoundException('Sala não encontrada.');
    if (room.hostMemberId !== hostMemberId) {
      throw new ForbiddenException('Apenas o host pode adicionar bots.');
    }
    if (room.status !== 'lobby') throw new BadRequestException('A partida já começou.');
    const settings = room.settings as GameRoom['settings'];
    if (!settings.allowBots) throw new BadRequestException('Bots não estão habilitados nesta sala.');

    const members = room.members || [];
    if (members.length >= room.maxPlayers) {
      throw new BadRequestException('Sala cheia.');
    }

    const usedNames = members.map((m) => m.name);
    const name =
      this.BOT_NAMES.find((n) => !usedNames.includes(n)) || `Bot AI ${uuidv4().slice(0, 4)}`;
    const usedAvatars = members.map((m) => m.avatar);
    const avatar =
      this.BOT_AVATARS.find((a) => !usedAvatars.includes(a)) || '🤖';
    const usedColors = members.map((m) => m.color);
    const color =
      this.BOT_COLORS.find((c) => !usedColors.includes(c)) || '#6b7280';

    const bot = this.memberRepo.create({
      id: uuidv4(),
      roomId: room.id,
      name,
      avatar,
      color,
      isBot: true,
      sessionToken: uuidv4(),
      seatIndex: members.length,
      isConnected: true,
      socketId: null,
    });

    await this.memberRepo.save(bot);
    await this.touchRoomActivity(roomId);
    return this.getLobbyState(roomId);
  }

  async removeBotFromRoom(
    roomId: string,
    hostMemberId: string,
    botMemberId: string,
  ): Promise<LobbyStateDto> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Sala não encontrada.');
    if (room.hostMemberId !== hostMemberId) {
      throw new ForbiddenException('Apenas o host pode remover bots.');
    }
    if (room.status !== 'lobby') throw new BadRequestException('A partida já começou.');

    const bot = await this.memberRepo.findOne({ where: { id: botMemberId, roomId } });
    if (!bot || !bot.isBot) throw new BadRequestException('Bot não encontrado.');

    await this.memberRepo.delete(botMemberId);
    await this.touchRoomActivity(roomId);
    return this.getLobbyState(roomId);
  }

  async startGame(roomId: string, memberId: string): Promise<GameRoom> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: { members: true },
    });
    if (!room) throw new NotFoundException('Sala não encontrada.');
    if (room.hostMemberId !== memberId) throw new ForbiddenException('Apenas o host pode iniciar.');
    if (room.status !== 'lobby') throw new BadRequestException('A partida já foi iniciada.');

    const members = (room.members || [])
      .filter((m) => !m.waitingForNextRound && (m.isBot || m.isConnected))
      .sort((a, b) => a.seatIndex - b.seatIndex);

    if (members.length < 3) {
      throw new BadRequestException('Mínimo de 3 jogadores (humanos ou bots) para iniciar.');
    }

    const players = this.gameService.membersToPlayers(members);
    let gameRoom = this.gameService.createInitialGameRoom(
      room.id,
      room.code,
      room.hostMemberId,
      players,
      room.settings as GameRoom['settings'],
    );
    gameRoom.maxPlayers = room.maxPlayers;
    gameRoom = this.gameService.startNewRound(gameRoom);

    const saved = await this.saveGameRoom(roomId, gameRoom);
    this.invalidatePublicRoomsCache();
    return saved;
  }

  async getGameRoom(roomId: string): Promise<GameRoom> {
    const cached = this.gameRoomCache.get(roomId);
    if (cached) return cached;

    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room || !room.gameStateJson) throw new NotFoundException('Estado do jogo não encontrado.');
    const gameRoom = this.gameService.deserialize(room.gameStateJson);
    this.gameRoomCache.set(roomId, gameRoom);
    return gameRoom;
  }

  async saveGameRoom(roomId: string, gameRoom: GameRoom): Promise<GameRoom> {
    const versioned: GameRoom = {
      ...gameRoom,
      stateVersion: (gameRoom.stateVersion ?? 0) + 1,
    };

    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Sala não encontrada.');
    room.gameStateJson = this.gameService.serialize(versioned);
    room.status = versioned.status as Room['status'];
    room.roundNumber = versioned.roundNumber;
    room.lastActivityAt = new Date();
    await this.roomRepo.save(room);

    this.gameRoomCache.set(roomId, versioned);
    return versioned;
  }

  assertStateVersion(gameRoom: GameRoom, expected?: number): void {
    if (expected === undefined) return;
    const current = gameRoom.stateVersion ?? 0;
    if (expected !== current) {
      throw new BadRequestException(
        `Estado desatualizado (esperado v${expected}, servidor v${current}). Aguarde a sincronização.`,
      );
    }
  }

  async assertMemberCanPlay(memberId: string, roomId: string): Promise<void> {
    const member = await this.memberRepo.findOne({ where: { id: memberId, roomId } });
    if (!member) throw new NotFoundException('Jogador não encontrado.');
    if (member.waitingForNextRound) {
      throw new BadRequestException('Aguarde o início da próxima rodada para jogar.');
    }

    const gameRoom = await this.getGameRoom(roomId);
    if (!gameRoom.players.some((p) => p.id === memberId)) {
      throw new BadRequestException('Você ainda não entrou na partida em andamento.');
    }
  }

  async startNextRound(
    roomId: string,
    memberId: string,
  ): Promise<{ gameRoom: GameRoom; log: string; logType: string }> {
    let gameRoom = await this.getGameRoom(roomId);
    if (gameRoom.status !== 'round_end') {
      throw new BadRequestException('A rodada ainda não terminou.');
    }
    if (memberId !== gameRoom.hostId) {
      throw new ForbiddenException('Apenas o host pode iniciar a próxima rodada.');
    }

    gameRoom = await this.mergeWaitingPlayersForNextRound(roomId, gameRoom);
    const next = {
      ...gameRoom,
      status: 'playing' as const,
      roundNumber: gameRoom.roundNumber + 1,
    };
    const final = this.gameService.startNewRound(next);
    const saved = await this.saveGameRoom(roomId, final);
    return {
      gameRoom: saved,
      log: `--- Rodada ${saved.roundNumber} Iniciando ---`,
      logType: 'phase',
    };
  }

  private async mergeWaitingPlayersForNextRound(roomId: string, gameRoom: GameRoom): Promise<GameRoom> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: { members: true },
    });
    const members = (room?.members || []).sort((a, b) => a.seatIndex - b.seatIndex);
    const activeMemberIds = new Set(
      members.filter((m) => m.isBot || m.isConnected).map((m) => m.id),
    );

    let players = gameRoom.players.filter((p) => activeMemberIds.has(p.id));

    for (const m of members) {
      if (!activeMemberIds.has(m.id)) continue;

      const existing = players.find((p) => p.id === m.id);
      if (!existing) {
        players.push(this.gameService.membersToPlayers([m])[0]);
      } else if (m.waitingForNextRound) {
        players = players.map((p) =>
          p.id === m.id
            ? { ...this.gameService.membersToPlayers([m])[0], phase: 1, score: 0 }
            : p,
        );
      }
    }

    await this.memberRepo
      .createQueryBuilder()
      .update(RoomMember)
      .set({ waitingForNextRound: false })
      .where('roomId = :roomId', { roomId })
      .andWhere('waitingForNextRound = :waiting', { waiting: true })
      .execute();

    players.sort((a, b) => {
      const seatA = members.find((m) => m.id === a.id)?.seatIndex ?? 0;
      const seatB = members.find((m) => m.id === b.id)?.seatIndex ?? 0;
      return seatA - seatB;
    });

    return { ...gameRoom, players };
  }

  async getMaskedGameState(roomId: string, memberId: string): Promise<GameRoom | null> {
    const member = await this.memberRepo.findOne({ where: { id: memberId } });
    if (member?.waitingForNextRound) return null;

    try {
      const gameRoom = await this.getGameRoom(roomId);
      if (!gameRoom.players.some((p) => p.id === memberId)) return null;
      return this.gameService.maskStateForPlayer(gameRoom, memberId);
    } catch {
      return null;
    }
  }
}
