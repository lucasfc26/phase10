import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AnyGameState, CardGameId, getCardGameFromState } from '../common/card-game.types';
import { GameRoom, Player } from '../common/game.types';
import {
  acceptTrucoBid,
  botChooseTrucoCard,
  botShouldAcceptBid,
  botShouldCallTruco,
  callTruco,
  createInitialTrucoRoom,
  dismissTrucoRoundSummary,
  getTeam,
  playTrucoCard,
  refuseTrucoBid,
} from '../games/truco/engine';
import { TrucoRoom } from '../games/truco/types';
import {
  autoAdvanceStreet,
  botPokerAction,
  canAutoAdvanceStreet,
  createInitialPokerRoom,
  dismissPokerRoundSummary,
  pokerAllIn,
  pokerCall,
  pokerCheck,
  pokerFold,
  pokerRaise,
} from '../games/poker/engine';
import { PokerRoom } from '../games/poker/types';
import {
  generateTowerMasterDeck,
  pickRandomTowerCharacterClass,
} from '../games/tower/cards';
import { applyTowerTurnStart, prepareTowerRoundPlayers } from '../games/tower/engine';
import { GameActionDto } from './dto/game-action.dto';
import { GameService } from './game.service';
import { generateDeck, shuffleDeck } from './game-engine';

type MemberLike = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isBot: boolean;
  seatIndex: number;
};

@Injectable()
export class OnlineGameService {
  constructor(private readonly gameService: GameService) {}

  deserialize(json: string): AnyGameState {
    const parsed = JSON.parse(json) as AnyGameState;
    if ('drawPile' in parsed && parsed.hasDrawnThisTurn === undefined) {
      (parsed as GameRoom).hasDrawnThisTurn = false;
    }
    if (parsed.stateVersion === undefined) {
      parsed.stateVersion = 0;
    }
    if (!parsed.currentTurnStartedAt) {
      parsed.currentTurnStartedAt = Date.now();
    }
    if ('players' in parsed && Array.isArray((parsed as GameRoom).players)) {
      for (const player of (parsed as GameRoom).players) {
        const legacy = (player as { towerBonusDrawNextRound?: number }).towerBonusDrawNextRound;
        if (legacy) {
          player.towerBonusDrawNextTurn = (player.towerBonusDrawNextTurn ?? 0) + legacy;
        }
      }
    }
    return parsed;
  }

  serialize(state: AnyGameState): string {
    return JSON.stringify(state);
  }

  bumpVersion(state: AnyGameState): AnyGameState {
    return { ...state, stateVersion: (state.stateVersion ?? 0) + 1 };
  }

  validateStartMembers(cardGame: CardGameId, count: number): void {
    if (cardGame === 'truco') {
      if (count !== 4) {
        throw new BadRequestException('Truco exige exatamente 4 jogadores.');
      }
      return;
    }
    if (cardGame === 'poker' || cardGame === 'tower_master') {
      if (count < 2) {
        throw new BadRequestException('Mínimo de 2 jogadores para iniciar.');
      }
      return;
    }
    if (count < 3) {
      throw new BadRequestException('Mínimo de 3 jogadores (humanos ou bots) para iniciar.');
    }
  }

  createInitialState(
    cardGame: CardGameId,
    roomId: string,
    code: string,
    hostId: string,
    members: MemberLike[],
    settings: GameRoom['settings'],
  ): AnyGameState {
    if (cardGame === 'truco') {
      const players = members.map((m, idx) => ({
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        color: m.color,
        isBot: m.isBot,
        cards: [],
        team: getTeam(idx),
      }));
      const trucoRoom = createInitialTrucoRoom(players, code, hostId, {
        gameMode: 'online',
        botDelay: settings.botDelay,
        cardGame: 'truco',
      });
      return { ...trucoRoom, id: roomId };
    }

    if (cardGame === 'poker') {
      const players = members.map((m) => ({
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        color: m.color,
        isBot: m.isBot,
        holeCards: [],
        chips: 1000,
        currentBet: 0,
        folded: false,
        allIn: false,
      }));
      const pokerRoom = createInitialPokerRoom(players, code, hostId, {
        gameMode: 'online',
        botDelay: settings.botDelay,
        cardGame: 'poker',
      });
      return { ...pokerRoom, id: roomId };
    }

    const players = this.gameService.membersToPlayers(members);
    let gameRoom = this.gameService.createInitialGameRoom(
      roomId,
      code,
      hostId,
      players,
      { ...settings, cardGame: cardGame === 'tower_master' ? 'tower_master' : 'phase10' },
    );
    gameRoom.maxPlayers = members.length;

    if (cardGame === 'tower_master') {
      gameRoom = {
        ...gameRoom,
        status: 'character_select',
        players: gameRoom.players.map((p) => ({
          ...p,
          energy: 3,
          towerCharacterClass: p.isBot ? pickRandomTowerCharacterClass() : undefined,
        })),
      };
      return gameRoom;
    }

    return this.gameService.startNewRound(gameRoom);
  }

  maskStateForPlayer(state: AnyGameState, viewerId: string): AnyGameState {
    const cardGame = getCardGameFromState(state);

    if (cardGame === 'truco') {
      const room = state as TrucoRoom;
      return {
        ...room,
        players: room.players.map((p) => {
          if (p.id === viewerId) return p;
          return {
            ...p,
            cards: Array.from({ length: p.cards.length }, (_, i) => ({
              id: `hidden-${p.id}-${i}`,
              suit: 'clubs' as const,
              rank: 0,
            })),
          };
        }),
        deck: [],
      };
    }

    if (cardGame === 'poker') {
      const room = state as PokerRoom;
      return {
        ...room,
        deck: [],
        players: room.players.map((p) => {
          if (p.id === viewerId) return p;
          return {
            ...p,
            holeCards: Array.from({ length: p.holeCards.length }, (_, i) => ({
              id: `hidden-${p.id}-${i}`,
              suit: 'clubs' as const,
              rank: 0,
            })),
          };
        }),
      };
    }

    return this.gameService.maskStateForPlayer(state as GameRoom, viewerId);
  }

  applyAction(
    state: AnyGameState,
    memberId: string,
    action: GameActionDto,
  ): { state: AnyGameState; log?: string; logType?: string; skipLogs?: string[]; privateMessages?: string[] } {
    const cardGame = getCardGameFromState(state);

    if (cardGame === 'truco') {
      return this.applyTrucoAction(state as TrucoRoom, memberId, action);
    }
    if (cardGame === 'poker') {
      return this.applyPokerAction(state as PokerRoom, memberId, action);
    }

    const gameRoom = state as GameRoom;
    if (action.type === 'select_character') {
      return this.applySelectCharacter(gameRoom, memberId, action.classId ?? '');
    }
    const result = this.gameService.applyAction(gameRoom, memberId, action);
    return {
      state: result.gameRoom,
      log: result.log,
      logType: result.logType,
      skipLogs: result.skipLogs,
      privateMessages: result.privateMessages,
    };
  }

  applyNextRound(
    state: AnyGameState,
    memberId: string,
  ): { state: AnyGameState; log: string; logType: string } {
    const cardGame = getCardGameFromState(state);

    if (cardGame === 'truco') {
      const room = state as TrucoRoom;
      if (!room.roundSummary) {
        throw new BadRequestException('Não há resumo de mão para avançar.');
      }
      if (memberId !== room.hostId) {
        throw new ForbiddenException('Apenas o host pode iniciar a próxima mão.');
      }
      const next = dismissTrucoRoundSummary(room);
      return { state: next, log: 'Nova mão iniciada.', logType: 'info' };
    }

    if (cardGame === 'poker') {
      const room = state as PokerRoom;
      if (!room.roundSummary) {
        throw new BadRequestException('Não há resumo de mão para avançar.');
      }
      if (memberId !== room.hostId) {
        throw new ForbiddenException('Apenas o host pode iniciar a próxima mão.');
      }
      const next = dismissPokerRoundSummary(room);
      return { state: next, log: 'Nova mão iniciada.', logType: 'info' };
    }

    const gameRoom = state as GameRoom;
    if (gameRoom.status !== 'round_end') {
      throw new BadRequestException('A rodada ainda não terminou.');
    }
    if (memberId !== gameRoom.hostId) {
      throw new ForbiddenException('Apenas o host pode iniciar a próxima rodada.');
    }
    const next = {
      ...gameRoom,
      status: 'playing' as const,
      roundNumber: gameRoom.roundNumber + 1,
    };
    const cardGameId = gameRoom.settings.cardGame;
    let final =
      cardGameId === 'tower_master'
        ? this.startNewTowerRound(next)
        : this.gameService.startNewRound(next);
    if (cardGameId === 'tower_master') {
      const turnStart = applyTowerTurnStart(final, final.currentTurnIndex);
      final = turnStart.gameRoom;
    }
    return {
      state: final,
      log: `--- Rodada ${final.roundNumber} Iniciando ---`,
      logType: 'phase',
    };
  }

  executeBotTurn(state: AnyGameState): {
    state: AnyGameState;
    logs: Array<{ id: string; message: string; type: string; timestamp: string }>;
  } {
    const cardGame = getCardGameFromState(state);
    const ts = () => new Date().toLocaleTimeString();
    const logId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (cardGame === 'truco') {
      return this.executeTrucoBotTurn(state as TrucoRoom, ts, logId);
    }
    if (cardGame === 'poker') {
      return this.executePokerBotTurn(state as PokerRoom, ts, logId);
    }

    const result = this.gameService.executeBotTurn(state as GameRoom);
    return { state: result.gameRoom, logs: result.logs };
  }

  skipStuckBotTurn(state: AnyGameState): {
    state: AnyGameState;
    log: string;
    logType: string;
    skipLogs?: string[];
  } {
    const cardGame = getCardGameFromState(state);
    if (cardGame === 'truco' || cardGame === 'poker') {
      return { state, log: '', logType: 'warning' };
    }
    const result = this.gameService.skipStuckBotTurn(state as GameRoom);
    return {
      state: result.gameRoom,
      log: result.log,
      logType: result.logType,
      skipLogs: result.skipLogs,
    };
  }

  isBotTurn(state: AnyGameState): boolean {
    const cardGame = getCardGameFromState(state);
    if (cardGame === 'truco') {
      const room = state as TrucoRoom;
      if (room.status !== 'playing' || room.roundSummary) return false;
      if (room.awaitingResponseFromTeam !== null) {
        const team = room.awaitingResponseFromTeam;
        const botsOnTeam = room.players.filter(
          (p, i) => getTeam(i) === team && p.isBot,
        );
        const humansOnTeam = room.players.filter(
          (p, i) => getTeam(i) === team && !p.isBot,
        );
        return botsOnTeam.length > 0 && humansOnTeam.length === 0;
      }
      return room.players[room.currentTurnIndex]?.isBot ?? false;
    }
    if (cardGame === 'poker') {
      const room = state as PokerRoom;
      if (room.status !== 'playing' || room.roundSummary) return false;
      return room.players[room.currentPlayerIndex]?.isBot ?? false;
    }
    const room = state as GameRoom;
    if (room.status !== 'playing') return false;
    return room.players[room.currentTurnIndex]?.isBot ?? false;
  }

  shouldPersistAfterBotTurn(state: AnyGameState): boolean {
    const cardGame = getCardGameFromState(state);
    if (cardGame === 'poker') {
      const room = state as PokerRoom;
      if (room.status !== 'playing' || room.roundSummary) return true;
      if (canAutoAdvanceStreet(room)) return false;
      return !room.players[room.currentPlayerIndex]?.isBot;
    }
    if (cardGame === 'truco') {
      const room = state as TrucoRoom;
      if (room.status !== 'playing' || room.roundSummary) return true;
      if (room.awaitingResponseFromTeam !== null) {
        const team = room.awaitingResponseFromTeam;
        const humans = room.players.filter((p, i) => getTeam(i) === team && !p.isBot);
        if (humans.length === 0) return false;
        return true;
      }
      return !room.players[room.currentTurnIndex]?.isBot;
    }
    const room = state as GameRoom;
    if (room.status !== 'playing') return true;
    return !room.players[room.currentTurnIndex]?.isBot;
  }

  assertMemberInGame(state: AnyGameState, memberId: string): void {
    const players =
      'drawPile' in state
        ? (state as GameRoom).players
        : (state as TrucoRoom | PokerRoom).players;
    if (!players.some((p) => p.id === memberId)) {
      throw new BadRequestException('Você ainda não entrou na partida em andamento.');
    }
  }

  private applySelectCharacter(
    gameRoom: GameRoom,
    memberId: string,
    classId: string,
  ): { state: GameRoom; log?: string; logType?: string; privateMessages?: string[] } {
    if (gameRoom.status !== 'character_select') {
      throw new BadRequestException('Seleção de classe não está ativa.');
    }
    if (!classId) {
      throw new BadRequestException('Classe inválida.');
    }

    const players = gameRoom.players.map((p) =>
      p.id === memberId ? { ...p, towerCharacterClass: classId } : p,
    );
    const actor = players.find((p) => p.id === memberId);
    if (!actor || actor.isBot) {
      throw new BadRequestException('Bots não selecionam classe manualmente.');
    }

    let next: GameRoom = { ...gameRoom, players };
    const allReady = next.players.every((p) => p.towerCharacterClass);
    if (allReady) {
      const playingRoom = this.startNewTowerRound({ ...next, status: 'playing' });
      const turnStart = applyTowerTurnStart(playingRoom, playingRoom.currentTurnIndex);
      const started = turnStart.gameRoom;
      return {
        state: started,
        log: 'Todos escolheram a classe — partida iniciada!',
        logType: 'success',
        privateMessages: turnStart.privateMessages,
      };
    }

    return {
      state: next,
      log: `${actor.name} escolheu a classe ${classId}.`,
      logType: 'info',
    };
  }

  startNewTowerRound(gameRoom: GameRoom): GameRoom {
    const freshDeck = generateTowerMasterDeck(generateDeck());
    const shuffled = shuffleDeck(freshDeck);
    const handSize = 12;

    const preparedPlayers = prepareTowerRoundPlayers(gameRoom);
    const updatedPlayers = preparedPlayers.map((player) => {
      const hand: GameRoom['drawPile'] = [];
      for (let i = 0; i < handSize; i++) {
        const card = shuffled.pop();
        if (card) hand.push(card);
      }
      return {
        ...player,
        cards: hand.sort((a, b) => a.value - b.value),
      };
    });

    const discardPile: GameRoom['discardPile'] = [];
    const initialDiscard = shuffled.pop();
    if (initialDiscard) discardPile.push(initialDiscard);

    return {
      ...gameRoom,
      status: 'playing',
      players: updatedPlayers,
      drawPile: shuffled,
      discardPile,
      laidDownPhases: [],
      currentTurnIndex: 0,
      hasDrawnThisTurn: false,
      currentTurnStartedAt: Date.now(),
      towerPowersDisabledRound: null,
      lastTowerPowerPlayed: null,
    };
  }

  private applyTrucoAction(
    room: TrucoRoom,
    memberId: string,
    action: GameActionDto,
  ): { state: TrucoRoom; log?: string; logType?: string } {
    const playerIndex = room.players.findIndex((p) => p.id === memberId);
    if (playerIndex < 0) throw new BadRequestException('Jogador não encontrado.');

    if (action.type === 'next_round') {
      throw new BadRequestException('Use o fluxo de próxima mão do servidor.');
    }

    let next = room;
    let log: string | undefined;
    let logType = 'action';

    switch (action.type) {
      case 'play_card': {
        if (!action.cardId) throw new BadRequestException('Carta não informada.');
        if (room.players[room.currentTurnIndex]?.id !== memberId) {
          throw new ForbiddenException('Não é o seu turno.');
        }
        next = playTrucoCard(room, playerIndex, action.cardId);
        log = `${room.players[playerIndex].name} jogou uma carta.`;
        break;
      }
      case 'call_truco': {
        if (room.players[room.currentTurnIndex]?.id !== memberId) {
          throw new ForbiddenException('Não é o seu turno.');
        }
        next = callTruco(room, playerIndex);
        log = `${room.players[playerIndex].name} pediu Truco!`;
        break;
      }
      case 'accept_truco': {
        if (room.awaitingResponseFromTeam === null) {
          throw new BadRequestException('Não há Truco pendente.');
        }
        const myTeam = getTeam(playerIndex);
        if (room.awaitingResponseFromTeam !== myTeam) {
          throw new ForbiddenException('Aguardando resposta do outro time.');
        }
        next = acceptTrucoBid(room);
        log = `Time ${myTeam + 1} aceitou o Truco!`;
        break;
      }
      case 'refuse_truco': {
        if (room.awaitingResponseFromTeam === null) {
          throw new BadRequestException('Não há Truco pendente.');
        }
        const myTeam = getTeam(playerIndex);
        if (room.awaitingResponseFromTeam !== myTeam) {
          throw new ForbiddenException('Aguardando resposta do outro time.');
        }
        next = refuseTrucoBid(room);
        log = `Time ${myTeam + 1} correu!`;
        logType = 'warning';
        break;
      }
      default:
        throw new BadRequestException('Ação inválida para Truco.');
    }

    return { state: { ...next, currentTurnStartedAt: Date.now() }, log, logType };
  }

  private applyPokerAction(
    room: PokerRoom,
    memberId: string,
    action: GameActionDto,
  ): { state: PokerRoom; log?: string; logType?: string } {
    const playerIndex = room.players.findIndex((p) => p.id === memberId);
    if (playerIndex < 0) throw new BadRequestException('Jogador não encontrado.');
    if (room.players[room.currentPlayerIndex]?.id !== memberId) {
      throw new ForbiddenException('Não é o seu turno.');
    }
    if (room.roundSummary) {
      throw new BadRequestException('Aguarde o fim da mão.');
    }

    let next = room;
    switch (action.type) {
      case 'fold':
        next = pokerFold(room, playerIndex);
        break;
      case 'check':
        next = pokerCheck(room, playerIndex);
        break;
      case 'call':
        next = pokerCall(room, playerIndex);
        break;
      case 'raise': {
        const total = action.raiseTotal ?? room.currentBet + room.minRaise;
        next = pokerRaise(room, playerIndex, total);
        break;
      }
      case 'all_in':
        next = pokerAllIn(room, playerIndex);
        break;
      default:
        throw new BadRequestException('Ação inválida para Poker.');
    }

    return {
      state: { ...next, currentTurnStartedAt: Date.now() },
      log: `${room.players[playerIndex].name}: ${action.type}`,
      logType: 'action',
    };
  }

  private executeTrucoBotTurn(
    room: TrucoRoom,
    ts: () => string,
    logId: () => string,
  ): {
    state: TrucoRoom;
    logs: Array<{ id: string; message: string; type: string; timestamp: string }>;
  } {
    const logs: Array<{ id: string; message: string; type: string; timestamp: string }> = [];
    let state = room;

    if (state.awaitingResponseFromTeam !== null) {
      const team = state.awaitingResponseFromTeam;
      const accept = botShouldAcceptBid(state, team);
      state = accept ? acceptTrucoBid(state) : refuseTrucoBid(state);
      logs.push({
        id: logId(),
        message: accept ? `Time ${team + 1} aceitou o Truco (bot).` : `Time ${team + 1} correu (bot).`,
        type: 'action',
        timestamp: ts(),
      });
      return { state, logs };
    }

    if (state.roundSummary) return { state, logs };

    const idx = state.currentTurnIndex;
    const bot = state.players[idx];
    if (!bot?.isBot) return { state, logs };

    if (botShouldCallTruco(state, idx) && !state.pendingBid) {
      state = callTruco(state, idx);
      logs.push({
        id: logId(),
        message: `${bot.name} pediu Truco!`,
        type: 'action',
        timestamp: ts(),
      });
      if (state.awaitingResponseFromTeam !== null) return { state, logs };
    }

    const cardId = botChooseTrucoCard(state, idx);
    if (cardId) {
      state = playTrucoCard(state, idx, cardId);
      logs.push({
        id: logId(),
        message: `${bot.name} jogou uma carta.`,
        type: 'action',
        timestamp: ts(),
      });
    }

    return { state, logs };
  }

  private executePokerBotTurn(
    room: PokerRoom,
    ts: () => string,
    logId: () => string,
  ): {
    state: PokerRoom;
    logs: Array<{ id: string; message: string; type: string; timestamp: string }>;
  } {
    const logs: Array<{ id: string; message: string; type: string; timestamp: string }> = [];
    let state = room;

    if (state.roundSummary) return { state, logs };

    if (canAutoAdvanceStreet(state)) {
      state = autoAdvanceStreet(state);
      logs.push({
        id: logId(),
        message: 'Mesa avançou (all-in).',
        type: 'info',
        timestamp: ts(),
      });
      return { state, logs };
    }

    const idx = state.currentPlayerIndex;
    const bot = state.players[idx];
    if (!bot?.isBot) return { state, logs };

    const action = botPokerAction(state, idx);
    switch (action) {
      case 'fold':
        state = pokerFold(state, idx);
        break;
      case 'check':
        state = pokerCheck(state, idx);
        break;
      case 'call':
        state = pokerCall(state, idx);
        break;
      case 'raise':
        state = pokerRaise(state, idx, state.currentBet + state.minRaise);
        break;
      case 'all_in':
        state = pokerAllIn(state, idx);
        break;
    }

    logs.push({
      id: logId(),
      message: `${bot.name}: ${action}`,
      type: 'action',
      timestamp: ts(),
    });

    return { state, logs };
  }
}
