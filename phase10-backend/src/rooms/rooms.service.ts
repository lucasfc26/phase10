import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
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
    };
  }

  async listPublicRooms(): Promise<PublicRoomDto[]> {
    const rooms = await this.roomRepo.find({
      where: [{ status: 'lobby' }, { status: 'playing' }],
      relations: { members: true },
      order: { createdAt: 'DESC' },
    });

    return rooms.map((room) => {
      const host = room.members?.find((m) => m.id === room.hostMemberId);
      return {
        id: room.id,
        code: room.code,
        hostName: host?.name || 'Host',
        playerCount: room.members?.length || 0,
        maxPlayers: room.maxPlayers,
        hasPassword: !!room.passwordHash,
        status: room.status,
        createdAt: room.createdAt,
      };
    });
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
        botDelay: 1200,
        customPhases: false,
        allowBots: dto.allowBots ?? false,
      },
      roundNumber: 1,
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

    const lobby = await this.getLobbyState(savedRoom.id);
    return { session: this.toSession(savedRoom, member), lobby };
  }

  async joinRoom(dto: JoinRoomDto): Promise<{ session: RoomSessionDto; lobby: LobbyStateDto }> {
    const room = await this.roomRepo.findOne({
      where: { code: dto.code.toUpperCase() },
      relations: { members: true },
    });

    if (!room) throw new NotFoundException('Sala não encontrada.');
    if (room.status !== 'lobby') throw new BadRequestException('A partida já começou.');
    if ((room.members?.length || 0) >= room.maxPlayers) {
      throw new BadRequestException('Sala cheia.');
    }

    if (room.passwordHash) {
      if (!dto.password) throw new ForbiddenException('Senha obrigatória.');
      const ok = await bcrypt.compare(dto.password, room.passwordHash);
      if (!ok) throw new ForbiddenException('Senha incorreta.');
    }

    const memberId = uuidv4();
    const sessionToken = uuidv4();
    const seatIndex = room.members?.length || 0;

    const member = this.memberRepo.create({
      id: memberId,
      roomId: room.id,
      name: dto.name,
      avatar: dto.avatar,
      color: dto.color,
      isBot: false,
      sessionToken,
      seatIndex,
      isConnected: false,
    });

    await this.memberRepo.save(member);

    const lobby = await this.getLobbyState(room.id);
    return { session: this.toSession(room, member), lobby };
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
      }));

    return {
      roomId: room.id,
      code: room.code,
      status: room.status,
      maxPlayers: room.maxPlayers,
      hostMemberId: room.hostMemberId,
      players,
      hasPassword: !!room.passwordHash,
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

  async startGame(roomId: string, memberId: string): Promise<GameRoom> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: { members: true },
    });
    if (!room) throw new NotFoundException('Sala não encontrada.');
    if (room.hostMemberId !== memberId) throw new ForbiddenException('Apenas o host pode iniciar.');
    if (room.status !== 'lobby') throw new BadRequestException('A partida já foi iniciada.');

    const members = (room.members || []).sort((a, b) => a.seatIndex - b.seatIndex);
    if (members.length < 3) throw new BadRequestException('Mínimo de 3 jogadores.');

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

    room.status = 'playing';
    room.gameStateJson = this.gameService.serialize(gameRoom);
    room.roundNumber = gameRoom.roundNumber;
    await this.roomRepo.save(room);

    return gameRoom;
  }

  async getGameRoom(roomId: string): Promise<GameRoom> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room || !room.gameStateJson) throw new NotFoundException('Estado do jogo não encontrado.');
    return this.gameService.deserialize(room.gameStateJson);
  }

  async saveGameRoom(roomId: string, gameRoom: GameRoom): Promise<void> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Sala não encontrada.');
    room.gameStateJson = this.gameService.serialize(gameRoom);
    room.status = gameRoom.status as Room['status'];
    room.roundNumber = gameRoom.roundNumber;
    await this.roomRepo.save(room);
  }

  async getMaskedGameState(roomId: string, memberId: string): Promise<GameRoom | null> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room?.gameStateJson || room.status === 'lobby') return null;
    const gameRoom = this.gameService.deserialize(room.gameStateJson);
    return this.gameService.maskStateForPlayer(gameRoom, memberId);
  }
}
