import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  Card,
  GameRoom,
  LaidDownPhase,
  Player,
  STANDARD_PHASES,
} from '../common/game.types';
import {
  advanceToNextPlayer,
  botChooseDiscard,
  botFindHits,
  botShouldDrawFromDiscard,
  botTryToFormPhase,
  calculateHandScore,
  ensureActivePlayerNotSkipped,
  evaluateRoundEnd,
  generateDeck,
  generateId,
  identifyGroupTypes,
  isValidHit,
  shuffleDeck,
  validatePhase,
} from './game-engine';
import { GameActionDto } from './dto/game-action.dto';
import {
  applyAbsorbPowers,
  applyClassAbility,
  applyLegendary,
  applyTowerPower,
  applyTowerTurnStart,
  isTowerMaster,
} from '../games/tower/engine';

export interface GameActionResult {
  gameRoom: GameRoom;
  log?: string;
  logType?: string;
  skipLogs?: string[];
  privateMessages?: string[];
  privateReveals?: Array<{ title: string; cards: Card[] }>;
}

@Injectable()
export class GameService {
  createInitialGameRoom(
    roomId: string,
    code: string,
    hostId: string,
    members: Player[],
    settings: GameRoom['settings'],
  ): GameRoom {
    return {
      id: roomId,
      code,
      hostId,
      players: members,
      status: 'lobby',
      maxPlayers: members.length,
      currentTurnIndex: 0,
      drawPile: [],
      discardPile: [],
      phaseSets: STANDARD_PHASES,
      laidDownPhases: [],
      roundNumber: 1,
      winnerId: null,
      hasDrawnThisTurn: false,
      stateVersion: 0,
      settings,
    };
  }

  membersToPlayers(members: Array<{ id: string; name: string; avatar: string; color: string; isBot: boolean; seatIndex: number }>): Player[] {
    return members.map((m) => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar,
      color: m.color,
      isBot: m.isBot,
      cards: [],
      phase: 1,
      hasLaidDownThisRound: false,
      score: 0,
      isSkipped: false,
    }));
  }

  startNewRound(gameRoom: GameRoom): GameRoom {
    const freshDeck = generateDeck();
    const shuffled = shuffleDeck(freshDeck);

    const updatedPlayers = gameRoom.players.map((player) => {
      const hand: Card[] = [];
      for (let i = 0; i < 10; i++) {
        const card = shuffled.pop();
        if (card) hand.push(card);
      }
      return {
        ...player,
        cards: hand.sort((a, b) => a.value - b.value),
        hasLaidDownThisRound: false,
        isSkipped: false,
      };
    });

    const discardPile: Card[] = [];
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
    };
  }

  maskStateForPlayer(gameRoom: GameRoom, viewerId: string): GameRoom {
    return {
      ...gameRoom,
      players: gameRoom.players.map((p) => {
        if (p.id === viewerId) return p;
        return {
          ...p,
          cards: Array.from({ length: p.cards.length }, (_, i) => ({
            id: `hidden-${p.id}-${i}`,
            type: 'number' as const,
            value: 0,
            color: 'blue' as const,
          })),
        };
      }),
    };
  }

  applyAction(
    gameRoom: GameRoom,
    memberId: string,
    action: GameActionDto,
  ): GameActionResult {
    if (action.type === 'next_round') {
      throw new BadRequestException('Use o endpoint de próxima rodada do servidor.');
    }

    if (gameRoom.status !== 'playing') {
      throw new BadRequestException('A partida não está em andamento.');
    }

    if (action.type === 'use_legendary') {
      const legendaryResult = applyLegendary(gameRoom, memberId, {
        generalCardIds: action.generalCardIds,
        group1CardIds: action.group1CardIds,
        group2CardIds: action.group2CardIds,
      });
      let next = legendaryResult.gameRoom;
      const endResult = evaluateRoundEnd(next.players, next.laidDownPhases, {
        drawPile: next.drawPile,
        discardPile: next.discardPile,
      });
      if (endResult) {
        next = this.handleRoundEnd(next, endResult.allAdvance);
        return {
          gameRoom: next,
          log: endResult.allAdvance
            ? '🎉 TODOS BAIARAM SUAS FASES! A RODADA FOI ENCERRADA! 🎉'
            : `🎉 ${endResult.winner?.name} BATEU E FECHOU A RODADA! 🎉`,
          logType: 'success',
          privateMessages: legendaryResult.privateMessages,
        };
      }
      return {
        gameRoom: next,
        log: legendaryResult.log,
        logType: legendaryResult.logType,
        privateMessages: legendaryResult.privateMessages,
      };
    }

    if (action.type === 'use_tower_power') {
      const powerResult = applyTowerPower(gameRoom, memberId, {
        cardId: action.cardId,
        copyMode: action.copyMode,
        copiedPowerId: action.copiedPowerId,
        targetPlayerId: action.targetPlayerId,
        chosenColor: action.chosenColor,
        ownCardId: action.ownCardId,
        discardRecoveryId: action.discardRecoveryId,
        reciclagemDiscardId: action.reciclagemDiscardId,
        segundaChanceDiscardIds: action.segundaChanceDiscardIds,
      });
      return {
        gameRoom: powerResult.gameRoom,
        log: powerResult.log,
        logType: powerResult.logType,
        privateMessages: powerResult.privateMessages,
        privateReveals: powerResult.privateReveals,
      };
    }

    if (action.type === 'use_class_ability') {
      const classResult = applyClassAbility(gameRoom, memberId, {
        alchemistCardId: action.alchemistCardId,
      });
      return {
        gameRoom: classResult.gameRoom,
        log: classResult.log,
        logType: classResult.logType,
        privateMessages: classResult.privateMessages,
      };
    }

    if (action.type === 'absorb_powers') {
      const absorbResult = applyAbsorbPowers(gameRoom, memberId, action.powerCardIds ?? []);
      return {
        gameRoom: absorbResult.gameRoom,
        log: absorbResult.log,
        logType: absorbResult.logType,
        privateMessages: absorbResult.privateMessages,
      };
    }

    const resolved = ensureActivePlayerNotSkipped(gameRoom.players, gameRoom.currentTurnIndex);
    const skipLogs = resolved.skippedPlayers.map(
      (p) => `🚫 ${p.avatar} ${p.name} foi pulado por um Skip!`,
    );
    gameRoom = {
      ...gameRoom,
      players: resolved.players,
      currentTurnIndex: resolved.currentTurnIndex,
    };

    const active = gameRoom.players[gameRoom.currentTurnIndex];
    if (!active || active.id !== memberId) {
      throw new ForbiddenException('Não é o seu turno.');
    }
    if (active.isBot) {
      throw new BadRequestException('Aguarde o bot jogar.');
    }

    switch (action.type) {
      case 'draw':
        return { ...this.processDraw(gameRoom, action.source || 'draw'), skipLogs };
      case 'discard': {
        if (!action.cardId) throw new BadRequestException('Carta não informada.');
        const discardResult = this.processDiscard(gameRoom, action.cardId, action.skipPlayerId ?? null);
        return {
          ...discardResult,
          skipLogs: [...skipLogs, ...(discardResult.skipLogs || [])],
        };
      }
      case 'lay_down':
        return { ...this.processLayDown(gameRoom, action.group1CardIds || [], action.group2CardIds || []), skipLogs };
      case 'hit':
        if (!action.cardId || !action.targetPlayerId || action.groupIndex === undefined) {
          throw new BadRequestException('Dados de hit incompletos.');
        }
        return {
          ...this.processHit(
            gameRoom,
            action.cardId,
            action.targetPlayerId,
            Number(action.groupIndex),
          ),
          skipLogs,
        };
      default:
        throw new BadRequestException('Ação inválida.');
    }
  }

  executeBotTurn(gameRoom: GameRoom): {
    gameRoom: GameRoom;
    logs: Array<{ id: string; message: string; type: string; timestamp: string }>;
  } {
    const logs: Array<{ id: string; message: string; type: string; timestamp: string }> = [];
    const ts = () => new Date().toLocaleTimeString();
    const logId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (gameRoom.status !== 'playing') return { gameRoom, logs };

    const resolved = ensureActivePlayerNotSkipped(gameRoom.players, gameRoom.currentTurnIndex);
    for (const p of resolved.skippedPlayers) {
      logs.push({
        id: logId(),
        message: `🚫 ${p.avatar} ${p.name} foi pulado por um Skip!`,
        type: 'warning',
        timestamp: ts(),
      });
    }
    let state: GameRoom = {
      ...gameRoom,
      players: resolved.players,
      currentTurnIndex: resolved.currentTurnIndex,
    };

    const bot = state.players[state.currentTurnIndex];
    if (!bot?.isBot) return { gameRoom: state, logs };

    const topDiscard = state.discardPile[state.discardPile.length - 1];
    const drawSource =
      topDiscard && botShouldDrawFromDiscard(bot, topDiscard) ? 'discard' : 'draw';
    const drawResult = this.processDraw(state, drawSource);
    state = drawResult.gameRoom;
    logs.push({ id: logId(), message: drawResult.log, type: 'action', timestamp: ts() });

    if (state.status !== 'playing') return { gameRoom: state, logs };

    let activeBot = state.players[state.currentTurnIndex];
    if (!activeBot.hasLaidDownThisRound) {
      const botGroups = botTryToFormPhase(activeBot);
      if (botGroups) {
        const g1 = botGroups[0]?.map((c) => c.id) || [];
        const g2 = botGroups[1]?.map((c) => c.id) || [];
        const layResult = this.processLayDown(state, g1, g2);
        state = layResult.gameRoom;
        logs.push({
          id: logId(),
          message: layResult.log || `✨ ${activeBot.name} baixou a fase!`,
          type: layResult.logType || 'success',
          timestamp: ts(),
        });
        if (state.status !== 'playing') return { gameRoom: state, logs };
        activeBot = state.players[state.currentTurnIndex];
      }
    }

    const hits = botFindHits(state.players[state.currentTurnIndex], state.laidDownPhases);
    for (const hit of hits) {
      const hitResult = this.processHit(state, hit.cardId, hit.targetPlayerId, hit.groupIndex);
      state = hitResult.gameRoom;
      logs.push({
        id: logId(),
        message: hitResult.log || `${bot.name} bateu uma carta.`,
        type: hitResult.logType || 'success',
        timestamp: ts(),
      });
      if (state.status !== 'playing') return { gameRoom: state, logs };
    }

    activeBot = state.players[state.currentTurnIndex];
    const discardCard = botChooseDiscard(activeBot);
    let skipPlayerId: string | null = null;
    if (discardCard.type === 'skip') {
      const opponents = state.players.filter((p) => p.id !== bot.id && !p.isSkipped);
      if (opponents.length > 0) {
        const sorted = [...opponents].sort((a, b) => {
          if (b.phase !== a.phase) return b.phase - a.phase;
          return a.score - b.score;
        });
        skipPlayerId = sorted[0].id;
      }
    }

    const discardResult = this.processDiscard(state, discardCard.id, skipPlayerId);
    state = discardResult.gameRoom;
    logs.push({
      id: logId(),
      message: discardResult.log ?? `${bot.name} descartou.`,
      type: discardResult.logType || 'action',
      timestamp: ts(),
    });
    for (const skipLog of discardResult.skipLogs || []) {
      logs.push({ id: logId(), message: skipLog, type: 'warning', timestamp: ts() });
    }

    return { gameRoom: state, logs };
  }

  /** Pula o turno de um bot que ficou travado por mais de 1 minuto. */
  skipStuckBotTurn(gameRoom: GameRoom): {
    gameRoom: GameRoom;
    log: string;
    logType: string;
    skipLogs?: string[];
  } {
    if (gameRoom.status !== 'playing') {
      return { gameRoom, log: '', logType: 'warning' };
    }

    const resolved = ensureActivePlayerNotSkipped(gameRoom.players, gameRoom.currentTurnIndex);
    let state: GameRoom = {
      ...gameRoom,
      players: resolved.players,
      currentTurnIndex: resolved.currentTurnIndex,
    };

    const bot = state.players[state.currentTurnIndex];
    if (!bot?.isBot) {
      return { gameRoom: state, log: '', logType: 'warning' };
    }

    const advanced = advanceToNextPlayer(state.players, state.currentTurnIndex);
    let next: GameRoom = {
      ...state,
      players: advanced.players,
      currentTurnIndex: advanced.currentTurnIndex,
      hasDrawnThisTurn: false,
      currentTurnStartedAt: Date.now(),
    };

    if (isTowerMaster(next)) {
      const turnStart = applyTowerTurnStart(next, next.currentTurnIndex);
      next = turnStart.gameRoom;
    }

    const skipMessages = [
      ...resolved.skippedPlayers.map((p) => `🚫 ${p.avatar} ${p.name} foi pulado por um Skip!`),
      ...advanced.skippedPlayers.map((p) => `🚫 ${p.avatar} ${p.name} foi pulado por um Skip!`),
    ];

    return {
      gameRoom: next,
      log: `⚠️ ${bot.avatar} ${bot.name} ficou inativo — turno pulado.`,
      logType: 'warning',
      skipLogs: skipMessages,
    };
  }

  private processDraw(gameRoom: GameRoom, source: 'draw' | 'discard'): { gameRoom: GameRoom; log: string } {
    if (gameRoom.hasDrawnThisTurn) {
      throw new BadRequestException('Você já comprou uma carta neste turno.');
    }

    const drawPile = [...gameRoom.drawPile];
    const discardPile = [...gameRoom.discardPile];
    const players = [...gameRoom.players];
    const idx = gameRoom.currentTurnIndex;

    if (isTowerMaster(gameRoom) && players[idx].towerCannotDraw) {
      throw new BadRequestException('Você está congelado e não pode comprar cartas neste turno.');
    }

    const hand = [...players[idx].cards];
    let drawn: Card | undefined;

    if (source === 'discard') {
      if (discardPile.length === 0) throw new BadRequestException('Monte de descarte vazio.');
      drawn = discardPile.pop();
    } else {
      if (drawPile.length === 0) {
        const topDiscard = discardPile.pop();
        const newDraw = shuffleDeck([...discardPile]);
        discardPile.length = 0;
        if (topDiscard) discardPile.push(topDiscard);
        drawPile.push(...newDraw);
      }
      drawn = drawPile.pop();
    }

    if (!drawn) throw new BadRequestException('Não foi possível comprar carta.');
    hand.push(drawn);
    players[idx] = { ...players[idx], cards: hand };

    return {
      gameRoom: { ...gameRoom, drawPile, discardPile, players, hasDrawnThisTurn: true },
      log: `${players[idx].avatar} ${players[idx].name} comprou uma carta.`,
    };
  }

  private processDiscard(
    gameRoom: GameRoom,
    cardId: string,
    skipPlayerId: string | null,
  ): GameActionResult {
    const turnIndex = gameRoom.currentTurnIndex;
    const players = gameRoom.players.map((p, idx) => {
      if (idx === turnIndex) {
        const card = p.cards.find((c) => c.id === cardId);
        if (!card) throw new BadRequestException('Carta não está na sua mão.');
        return { ...p, cards: p.cards.filter((c) => c.id !== cardId) };
      }
      if (skipPlayerId && p.id === skipPlayerId) {
        return { ...p, isSkipped: true };
      }
      return p;
    });

    const card = gameRoom.players[turnIndex].cards.find((c) => c.id === cardId);
    if (!card) throw new BadRequestException('Carta inválida.');
    if (card.type === 'skip' && !skipPlayerId) {
      throw new BadRequestException('Selecione um jogador para pular.');
    }

    let next: GameRoom = {
      ...gameRoom,
      players,
      discardPile: [...gameRoom.discardPile, card],
    };

    const endResult = evaluateRoundEnd(next.players, next.laidDownPhases, {
      drawPile: next.drawPile,
      discardPile: next.discardPile,
    });

    if (endResult) {
      next = this.handleRoundEnd(next, endResult.allAdvance);
      return {
        gameRoom: next,
        log: endResult.allAdvance
          ? '🎉 TODOS BAIARAM SUAS FASES! A RODADA FOI ENCERRADA! 🎉'
          : `🎉 ${endResult.winner?.name} BATEU E FECHOU A RODADA! 🎉`,
        logType: 'success',
      };
    }

    const privateMessages: string[] = [];
    const extraLogs: string[] = [];

    if (isTowerMaster(next) && players[turnIndex]?.towerExtraTurn) {
      const updatedPlayers = next.players.map((p, idx) =>
        idx === turnIndex ? { ...p, towerExtraTurn: false } : p,
      );
      next = {
        ...next,
        players: updatedPlayers,
        hasDrawnThisTurn: false,
        currentTurnStartedAt: Date.now(),
      };
      const turnStart = applyTowerTurnStart(next, turnIndex);
      next = turnStart.gameRoom;
      if (turnStart.log) extraLogs.push(turnStart.log);
      if (turnStart.privateMessages) privateMessages.push(...turnStart.privateMessages);
      extraLogs.push(`${players[turnIndex].name} ganhou o turno extra.`);
      return {
        gameRoom: next,
        log: `${players[turnIndex].name} descartou uma carta. ${extraLogs.join(' ')}`,
        logType: 'action',
        privateMessages: privateMessages.length > 0 ? privateMessages : undefined,
      };
    }

    const advanced = advanceToNextPlayer(next.players, next.currentTurnIndex);
    next = {
      ...next,
      players: advanced.players,
      currentTurnIndex: advanced.currentTurnIndex,
      hasDrawnThisTurn: false,
      currentTurnStartedAt: Date.now(),
    };

    if (isTowerMaster(next)) {
      const turnStart = applyTowerTurnStart(next, next.currentTurnIndex);
      next = turnStart.gameRoom;
      if (turnStart.log) extraLogs.push(turnStart.log);
      if (turnStart.privateMessages) privateMessages.push(...turnStart.privateMessages);
    }

    const skipMessages = advanced.skippedPlayers.map(
      (p) => `🚫 ${p.avatar} ${p.name} foi pulado por um Skip!`,
    );

    return {
      gameRoom: next,
      log: `${players[turnIndex].name} descartou uma carta.${extraLogs.length ? ` ${extraLogs.join(' ')}` : ''}`,
      logType: 'action',
      skipLogs: skipMessages,
      privateMessages: privateMessages.length > 0 ? privateMessages : undefined,
    };
  }

  private processLayDown(gameRoom: GameRoom, group1Ids: string[], group2Ids: string[]) {
    const idx = gameRoom.currentTurnIndex;
    const active = gameRoom.players[idx];
    const phaseDef = STANDARD_PHASES.find((p) => p.id === active.phase);
    if (!phaseDef) throw new BadRequestException('Fase inválida.');

    if (!gameRoom.hasDrawnThisTurn) {
      throw new BadRequestException('Compre uma carta antes de baixar a fase.');
    }

    if (isTowerMaster(gameRoom) && active.towerCannotLayDown) {
      throw new BadRequestException('Você está bloqueado e não pode baixar o desafio neste turno.');
    }

    const allIds = [...group1Ids, ...group2Ids];
    if (allIds.length === 0) {
      throw new BadRequestException('Nenhuma carta selecionada para baixar.');
    }

    const missingIds = allIds.filter((id) => !active.cards.some((c) => c.id === id));
    if (missingIds.length > 0) {
      throw new BadRequestException('Uma ou mais cartas não estão na sua mão.');
    }

    const g1 = group1Ids
      .map((id) => active.cards.find((c) => c.id === id))
      .filter(Boolean) as Card[];
    const g2 = group2Ids
      .map((id) => active.cards.find((c) => c.id === id))
      .filter(Boolean) as Card[];

    const groups: Card[][] = [];
    if (g1.length > 0) groups.push(g1);
    if (g2.length > 0) groups.push(g2);

    const validation = validatePhase(phaseDef.type, groups);
    if (!validation.isValid) throw new BadRequestException(validation.error || 'Fase inválida.');

    const players = gameRoom.players.map((p, i) => {
      if (i !== idx) return p;
      return {
        ...p,
        cards: p.cards.filter((c) => !allIds.includes(c.id)),
        hasLaidDownThisRound: true,
      };
    });

    const newLaidDown: LaidDownPhase = {
      playerId: active.id,
      playerName: active.name,
      playerColor: active.color || '#a855f7',
      phaseId: active.phase,
      groups,
    };

    let next: GameRoom = {
      ...gameRoom,
      players,
      laidDownPhases: [...gameRoom.laidDownPhases, newLaidDown],
    };

    const endResult = evaluateRoundEnd(next.players, next.laidDownPhases, {
      drawPile: next.drawPile,
      discardPile: next.discardPile,
    });

    if (endResult) {
      next = this.handleRoundEnd(next, endResult.allAdvance);
      return {
        gameRoom: next,
        log: `✨ ${active.name} BAIXOU A FASE ${active.phase}! Rodada encerrada.`,
        logType: 'success',
      };
    }

    return {
      gameRoom: next,
      log: `✨ ${active.name} BAIXOU A FASE ${active.phase}!`,
      logType: 'success',
    };
  }

  private processHit(gameRoom: GameRoom, cardId: string, targetPlayerId: string, groupIndex: number) {
    const idx = gameRoom.currentTurnIndex;
    const active = gameRoom.players[idx];
    if (!active.hasLaidDownThisRound) {
      throw new BadRequestException('Baixe sua fase antes de bater.');
    }

    if (!gameRoom.hasDrawnThisTurn) {
      throw new BadRequestException('Compre uma carta antes de bater.');
    }

    if (Number.isNaN(groupIndex) || groupIndex < 0) {
      throw new BadRequestException('Grupo alvo inválido.');
    }

    const card = active.cards.find((c) => c.id === cardId);
    if (!card) throw new BadRequestException('Carta não está na sua mão.');

    const layout = gameRoom.laidDownPhases.find((p) => p.playerId === targetPlayerId);
    if (!layout) throw new BadRequestException('Fase alvo não encontrada.');

    const phaseDef = STANDARD_PHASES.find((p) => p.id === layout.phaseId);
    if (!phaseDef) throw new BadRequestException('Fase inválida.');

    const categories = identifyGroupTypes(phaseDef.type, layout.groups);
    const category = categories[groupIndex] || 'Grupo';
    const group = layout.groups[groupIndex];
    if (!isValidHit(card, group, category)) {
      throw new BadRequestException(`Carta não se encaixa em ${category}.`);
    }

    const players = gameRoom.players.map((p, i) => {
      if (i !== idx) return p;
      return { ...p, cards: p.cards.filter((c) => c.id !== cardId) };
    });

    const laidDownPhases = gameRoom.laidDownPhases.map((item) => {
      if (item.playerId !== targetPlayerId) return item;
      const groups = item.groups.map((grp, gIdx) =>
        gIdx === groupIndex ? [...grp, card] : grp,
      );
      return { ...item, groups };
    });

    let next: GameRoom = { ...gameRoom, players, laidDownPhases };

    const endResult = evaluateRoundEnd(next.players, next.laidDownPhases, {
      drawPile: next.drawPile,
      discardPile: next.discardPile,
    });

    if (endResult) {
      next = this.handleRoundEnd(next, endResult.allAdvance);
      return { gameRoom: next, log: `${active.name} bateu e a rodada encerrou.`, logType: 'success' };
    }

    return { gameRoom: next, log: `${active.name} bateu uma carta.`, logType: 'success' };
  }

  private handleRoundEnd(gameRoom: GameRoom, allAdvance: boolean): GameRoom {
    const players = gameRoom.players.map((p) => {
      const addedScore = calculateHandScore(p.cards);
      let nextPhase = p.phase;
      if (allAdvance || p.hasLaidDownThisRound) nextPhase = p.phase + 1;
      return {
        ...p,
        score: p.score + addedScore,
        phase: nextPhase,
        cards: [],
        hasLaidDownThisRound: false,
        isSkipped: false,
      };
    });

    const finishedPlayers = players.filter((p) => p.phase > 10);
    let status: GameRoom['status'] = 'round_end';
    let winnerId: string | null = null;

    if (finishedPlayers.length > 0) {
      status = 'game_over';
      const winner = finishedPlayers.reduce((best, p) => (p.score < best.score ? p : best));
      winnerId = winner.id;
    }

    return { ...gameRoom, status, players, winnerId };
  }

  serialize(gameRoom: GameRoom): string {
    return JSON.stringify(gameRoom);
  }

  deserialize(json: string): GameRoom {
    const room = JSON.parse(json) as GameRoom;
    if (room.hasDrawnThisTurn === undefined) {
      room.hasDrawnThisTurn = false;
    }
    if (room.stateVersion === undefined) {
      room.stateVersion = 0;
    }
    if (!room.currentTurnStartedAt) {
      room.currentTurnStartedAt = Date.now();
    }
    return room;
  }
}
