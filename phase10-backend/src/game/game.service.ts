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

export interface GameStatePayload {
  room: GameRoom;
  logs: Array<{ id: string; message: string; type: string; timestamp: string }>;
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
  ): { gameRoom: GameRoom; log?: string; logType?: string; skipLogs?: string[] } {
    if (action.type === 'next_round') {
      if (gameRoom.status !== 'round_end') {
        throw new BadRequestException('A rodada ainda não terminou.');
      }
      const next = {
        ...gameRoom,
        status: 'playing' as const,
        roundNumber: gameRoom.roundNumber + 1,
      };
      return { gameRoom: this.startNewRound(next), log: `--- Rodada ${next.roundNumber} Iniciando ---`, logType: 'phase' };
    }

    if (gameRoom.status !== 'playing') {
      throw new BadRequestException('A partida não está em andamento.');
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
        return { ...this.processHit(gameRoom, action.cardId, action.targetPlayerId, action.groupIndex), skipLogs };
      default:
        throw new BadRequestException('Ação inválida.');
    }
  }

  private processDraw(gameRoom: GameRoom, source: 'draw' | 'discard'): { gameRoom: GameRoom; log: string } {
    const drawPile = [...gameRoom.drawPile];
    const discardPile = [...gameRoom.discardPile];
    const players = [...gameRoom.players];
    const idx = gameRoom.currentTurnIndex;
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
      gameRoom: { ...gameRoom, drawPile, discardPile, players },
      log: `${players[idx].avatar} ${players[idx].name} comprou uma carta.`,
    };
  }

  private processDiscard(
    gameRoom: GameRoom,
    cardId: string,
    skipPlayerId: string | null,
  ): { gameRoom: GameRoom; log: string; logType: string; skipLogs?: string[] } {
    const players = gameRoom.players.map((p, idx) => {
      if (idx === gameRoom.currentTurnIndex) {
        const card = p.cards.find((c) => c.id === cardId);
        if (!card) throw new BadRequestException('Carta não está na sua mão.');
        return { ...p, cards: p.cards.filter((c) => c.id !== cardId) };
      }
      if (skipPlayerId && p.id === skipPlayerId) {
        return { ...p, isSkipped: true };
      }
      return p;
    });

    const card = gameRoom.players[gameRoom.currentTurnIndex].cards.find((c) => c.id === cardId);
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

    const advanced = advanceToNextPlayer(next.players, next.currentTurnIndex);
    next = {
      ...next,
      players: advanced.players,
      currentTurnIndex: advanced.currentTurnIndex,
    };

    const skipMessages = advanced.skippedPlayers.map(
      (p) => `🚫 ${p.avatar} ${p.name} foi pulado por um Skip!`,
    );

    return {
      gameRoom: next,
      log: `${players[gameRoom.currentTurnIndex].name} descartou uma carta.`,
      logType: 'action',
      skipLogs: skipMessages,
    };
  }

  private processLayDown(gameRoom: GameRoom, group1Ids: string[], group2Ids: string[]) {
    const idx = gameRoom.currentTurnIndex;
    const active = gameRoom.players[idx];
    const phaseDef = STANDARD_PHASES.find((p) => p.id === active.phase);
    if (!phaseDef) throw new BadRequestException('Fase inválida.');

    const allIds = [...group1Ids, ...group2Ids];
    const groups = [
      group1Ids.map((id) => active.cards.find((c) => c.id === id)).filter(Boolean) as Card[],
      group2Ids.map((id) => active.cards.find((c) => c.id === id)).filter(Boolean) as Card[],
    ].filter((g) => g.length > 0);

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
    return JSON.parse(json) as GameRoom;
  }
}
