import { BadRequestException } from '@nestjs/common';
import { Card, GameRoom, LaidDownPhase, Player, STANDARD_PHASES } from '../../common/game.types';
import {
  botTryToFormPhase,
  shuffleDeck,
  validatePhase,
} from '../../game/game-engine';
import { createTowerPowerCardById, pickRandomLegendaryId } from './cards';

export type TowerActionResult = {
  gameRoom: GameRoom;
  log?: string;
  logType?: string;
  privateMessages?: string[];
};

export function isTowerMaster(gameRoom: GameRoom): boolean {
  return gameRoom.settings.cardGame === 'tower_master';
}

function describeCard(card?: Card): string {
  if (!card) return 'Carta';
  if (card.type === 'power') return card.powerName ?? 'Poder';
  if (card.type === 'wild') return 'Coringa';
  if (card.type === 'skip') return 'Skip';
  return `${card.value} ${card.color}`;
}

function drawFromPile(drawPile: Card[], discardPile: Card[]): Card | undefined {
  if (drawPile.length === 0) {
    const topDiscard = discardPile.pop();
    const recycled = shuffleDeck([...discardPile]);
    discardPile.length = 0;
    if (topDiscard) discardPile.push(topDiscard);
    drawPile.push(...recycled);
  }
  return drawPile.pop();
}

function cardMatchesTowerColor(handCard: Card, color: Card['color']): boolean {
  return handCard.type === 'number' && handCard.color === color;
}

function clonePlayers(players: Player[]): Player[] {
  return players.map((p) => ({ ...p, cards: [...p.cards] }));
}

/** Devolve cartas baixadas à mão antes de trocas de mão entre jogadores. */
function returnLaidDownToHands(
  players: Player[],
  laidDownPhases: LaidDownPhase[],
  playerIds?: string[],
): LaidDownPhase[] {
  const idSet = playerIds ? new Set(playerIds) : null;
  laidDownPhases.forEach((layout) => {
    if (idSet && !idSet.has(layout.playerId)) return;
    const owner = players.find((p) => p.id === layout.playerId);
    if (owner) {
      owner.cards.push(...layout.groups.flat());
      owner.hasLaidDownThisRound = false;
    }
  });
  return idSet
    ? laidDownPhases.filter((layout) => !idSet.has(layout.playerId))
    : [];
}

export function prepareTowerRoundPlayers(gameRoom: GameRoom): GameRoom['players'] {
  return gameRoom.players.map((player) => ({
    ...player,
    hasLaidDownThisRound: false,
    isSkipped: false,
    energy: player.energy ?? 3,
    towerArmorTurns: Math.max(0, (player.towerArmorTurns ?? 0) - 1),
    towerCannotLayDown: false,
    towerCannotDraw: false,
    towerExtraTurn: false,
    towerAttackImmune: false,
    towerShield: player.towerCharacterClass === 'guardiao',
    towerLegendaryId: player.towerLegendaryId ?? pickRandomLegendaryId(),
    towerLegendaryUsedThisRound: false,
    towerClassAbilityUsedThisRound: false,
    towerAlchemistPassiveUsedThisTurn: false,
  }));
}

/** Energia e passivas de classe no início do turno de um jogador. */
export function applyTowerTurnStart(
  gameRoom: GameRoom,
  turnIndex: number,
): TowerActionResult {
  const drawPile = [...gameRoom.drawPile];
  const discardPile = [...gameRoom.discardPile];
  const players = clonePlayers(gameRoom.players);
  const active = players[turnIndex];
  if (!active) return { gameRoom };

  const logs: string[] = [];
  const privateMessages: string[] = [];

  active.energy = Math.min(6, (active.energy ?? 3) + 1);
  active.towerAttackImmune = false;
  active.towerAlchemistPassiveUsedThisTurn = false;
  active.towerCannotLayDown = false;
  active.towerCannotDraw = false;

  const bonusDraw = active.towerBonusDrawNextTurn ?? 0;
  if (bonusDraw > 0) {
    let drawnCount = 0;
    for (let i = 0; i < bonusDraw; i++) {
      const drawn = drawFromPile(drawPile, discardPile);
      if (drawn) {
        active.cards.push(drawn);
        drawnCount += 1;
      }
    }
    active.towerBonusDrawNextTurn = 0;
    if (drawnCount > 0) {
      logs.push(
        `${active.name} recebeu +${drawnCount} carta(s) extra no início do turno (efeito Guerreiro).`,
      );
    }
  }

  if (active.towerCharacterClass === 'ladino' && Math.random() < 0.2) {
    const top =
      drawPile.length > 0 ? drawPile[drawPile.length - 1] : discardPile[discardPile.length - 1];
    if (top) {
      logs.push(`${active.name} (Ladino) passiva: viu ${describeCard(top)} no topo do monte.`);
      privateMessages.push(`Topo do monte: ${describeCard(top)}`);
    }
  }

  if (active.towerCharacterClass === 'alquimista' && Math.random() < 0.15) {
    active.towerExtraTurn = true;
    logs.push(`${active.name} (Alquimista) passiva: jogará um turno extra!`);
  }

  if (active.towerCharacterClass === 'guerreiro' && Math.random() < 0.15) {
    const opponents = players.filter(
      (player, index) => index !== turnIndex && player.cards.length > 0,
    );
    if (opponents.length > 0) {
      const victim = opponents[Math.floor(Math.random() * opponents.length)];
      const cardIndex = Math.floor(Math.random() * victim.cards.length);
      const [destroyed] = victim.cards.splice(cardIndex, 1);
      if (destroyed) {
        discardPile.push(destroyed);
        const replacement = drawFromPile(drawPile, discardPile);
        if (replacement) victim.cards.push(replacement);
        logs.push(
          `${active.name} (Guerreiro) passiva: ${victim.name} perdeu ${describeCard(destroyed)} e comprou outra do monte.`,
        );
      }
    }
  }

  return {
    gameRoom: { ...gameRoom, drawPile, discardPile, players },
    log: logs.length > 0 ? logs.join(' ') : undefined,
    logType: 'info',
    privateMessages: privateMessages.length > 0 ? privateMessages : undefined,
  };
}

export type TowerPowerParams = {
  cardId?: string;
  copyMode?: boolean;
  copiedPowerId?: string;
  targetPlayerId?: string;
  chosenColor?: string;
  ownCardId?: string;
  discardRecoveryId?: string;
  reciclagemDiscardId?: string;
  segundaChanceDiscardIds?: string[];
};

export function applyTowerPower(
  gameRoom: GameRoom,
  memberId: string,
  params: TowerPowerParams,
): TowerActionResult {
  if (!isTowerMaster(gameRoom)) {
    throw new BadRequestException('Não é partida de Mestre da Torre.');
  }

  const activeIndex = gameRoom.currentTurnIndex;
  const active = gameRoom.players[activeIndex];
  if (!active || active.id !== memberId) {
    throw new BadRequestException('Não é o seu turno.');
  }
  if (!gameRoom.hasDrawnThisTurn) {
    throw new BadRequestException('Compre uma carta antes de usar um poder.');
  }

  let card: Card | undefined;
  if (params.copyMode) {
    const powerCard =
      gameRoom.lastTowerPowerPlayed ??
      (params.copiedPowerId ? createTowerPowerCardById(params.copiedPowerId) : null);
    if (!powerCard?.powerId) {
      throw new BadRequestException('Nenhum poder foi jogado nesta rodada para copiar.');
    }
    card = powerCard;
  } else {
    if (!params.cardId) throw new BadRequestException('Carta não informada.');
    card = active.cards.find((c) => c.id === params.cardId);
    if (!card || card.type !== 'power') {
      throw new BadRequestException('Carta de poder inválida.');
    }
    if (
      gameRoom.towerPowersDisabledRound === gameRoom.roundNumber &&
      card.powerId !== 'eclipse'
    ) {
      throw new BadRequestException('Eclipse está ativo: poderes bloqueados nesta rodada.');
    }
    const cost = card.powerCost ?? 0;
    if ((active.energy ?? 3) < cost) {
      throw new BadRequestException(`Energia insuficiente. ${card.powerName} custa ${cost}.`);
    }
  }

  const drawPile = [...gameRoom.drawPile];
  const discardPile = params.copyMode ? [...gameRoom.discardPile] : [...gameRoom.discardPile, card!];
  let laidDownPhases = gameRoom.laidDownPhases.map((layout) => ({
    ...layout,
    groups: layout.groups.map((group) => [...group]),
  }));
  const players = clonePlayers(gameRoom.players);
  const caster = players[activeIndex];
  const cost = params.copyMode ? 0 : (card!.powerCost ?? 0);

  if (!params.copyMode) {
    caster.cards = caster.cards.filter((handCard) => handCard.id !== card!.id);
  }
  if (cost > 0) {
    caster.energy = Math.max(0, (caster.energy ?? 3) - cost);
  }

  let towerPowersDisabledRound = gameRoom.towerPowersDisabledRound ?? null;
  let lastTowerPowerPlayed = gameRoom.lastTowerPowerPlayed ?? null;
  if (!params.copyMode && card!.powerId === 'eclipse') {
    towerPowersDisabledRound = gameRoom.roundNumber;
  }
  if (!params.copyMode) {
    lastTowerPowerPlayed = card!;
  }

  const privateMessages: string[] = [];
  const logs: string[] = [];

  let effectiveTargetId = params.targetPlayerId ?? null;
  const isAttack = card!.powerCategory === 'attack' || card!.powerId === 'roubo_supremo';

  if (isAttack && effectiveTargetId) {
    const targetPlayer = players.find((p) => p.id === effectiveTargetId);
    if (targetPlayer?.towerAttackImmune) {
      logs.push(`${targetPlayer.name} bloqueou ${card!.powerName} (imune a ataques).`);
      effectiveTargetId = null;
    } else if (targetPlayer?.towerArmorTurns && targetPlayer.towerArmorTurns > 0) {
      logs.push(`${targetPlayer.name} bloqueou ${card!.powerName} com Armadura.`);
      effectiveTargetId = null;
    } else if (targetPlayer?.towerShield) {
      targetPlayer.towerShield = false;
      logs.push(`${targetPlayer.name} bloqueou ${card!.powerName} com Escudo.`);
      effectiveTargetId = null;
    } else if (targetPlayer?.towerReflectNext) {
      targetPlayer.towerReflectNext = false;
      effectiveTargetId = caster.id;
      logs.push(`${targetPlayer.name} refletiu ${card!.powerName} de volta para ${caster.name}.`);
    }
  }

  const finalTarget = effectiveTargetId
    ? players.find((p) => p.id === effectiveTargetId) ?? null
    : null;

  switch (card!.powerId) {
    case 'roubo':
      if (finalTarget && finalTarget.cards.length > 0) {
        const stolenIndex = Math.floor(Math.random() * finalTarget.cards.length);
        const [stolen] = finalTarget.cards.splice(stolenIndex, 1);
        if (stolen) {
          caster.cards.push(stolen);
          logs.push(`${caster.name} roubou uma carta de ${finalTarget.name}.`);
        }
      }
      break;

    case 'quebra_sequencia':
      if (finalTarget) {
        const layoutIndex = laidDownPhases.findIndex((layout) => layout.playerId === finalTarget.id);
        const layout = laidDownPhases[layoutIndex];
        if (layout) {
          const allLaidCards = layout.groups.flat();
          if (allLaidCards.length > 0) {
            laidDownPhases = laidDownPhases.filter((_, index) => index !== layoutIndex);
            finalTarget.hasLaidDownThisRound = false;
            const returned = [...allLaidCards];
            const swapIndex = Math.floor(Math.random() * returned.length);
            const displaced = returned[swapIndex];
            const deckCard = drawFromPile(drawPile, discardPile);
            if (deckCard) {
              returned[swapIndex] = deckCard;
              discardPile.push(displaced);
            }
            caster.cards.push(...returned);
            logs.push(
              `${caster.name} quebrou o desafio de ${finalTarget.name}: cartas foram para sua mão.`,
            );
          }
        }
      }
      break;

    case 'destruicao':
      if (finalTarget && finalTarget.cards.length > 0) {
        const lostIndex = Math.floor(Math.random() * finalTarget.cards.length);
        const [lostCard] = finalTarget.cards.splice(lostIndex, 1);
        if (lostCard) discardPile.push(lostCard);
        const replacement = drawFromPile(drawPile, discardPile);
        if (replacement) finalTarget.cards.push(replacement);
        logs.push(
          `${finalTarget.name} perdeu ${describeCard(lostCard)} e recebeu ${describeCard(replacement)} do monte.`,
        );
      }
      break;

    case 'inversao':
      if (finalTarget) {
        laidDownPhases = returnLaidDownToHands(players, laidDownPhases, [caster.id, finalTarget.id]);
        const casterHand = caster.cards;
        caster.cards = finalTarget.cards;
        finalTarget.cards = casterHand;
        logs.push(
          `${caster.name} trocou a mão inteira com ${finalTarget.name} (desafios baixados voltaram às mãos antes da troca).`,
        );
      }
      break;

    case 'congelar':
      if (finalTarget) {
        finalTarget.towerCannotDraw = true;
        logs.push(`${finalTarget.name} foi congelado: não pode comprar cartas até o próximo turno.`);
      }
      break;

    case 'maldicao':
      if (finalTarget) {
        for (let i = 0; i < 2; i++) {
          const drawn = drawFromPile(drawPile, discardPile);
          if (drawn) finalTarget.cards.push(drawn);
        }
        logs.push(`${finalTarget.name} sofreu Maldição e comprou 2 cartas.`);
      }
      break;

    case 'bloqueio':
      if (finalTarget) {
        finalTarget.towerCannotLayDown = true;
        logs.push(`${finalTarget.name} não poderá baixar o desafio até o próximo turno.`);
      }
      break;

    case 'espiao':
      if (finalTarget) {
        privateMessages.push(
          `${finalTarget.name} tem: ${finalTarget.cards.map(describeCard).join(', ') || 'Sem cartas'}`,
        );
        logs.push(`${caster.name} espionou a mão de ${finalTarget.name}.`);
      }
      break;

    case 'cacador':
      if (params.chosenColor) {
        const chosenColor = params.chosenColor as Card['color'];
        players.forEach((player) => {
          const index = player.cards.findIndex((handCard) =>
            cardMatchesTowerColor(handCard, chosenColor),
          );
          if (index >= 0) {
            const [discarded] = player.cards.splice(index, 1);
            discardPile.push(discarded);
          }
          const drawn = drawFromPile(drawPile, discardPile);
          if (drawn) player.cards.push(drawn);
        });
        logs.push(`${caster.name} caçou a cor ${chosenColor}: todos descartaram (se possível) e compraram.`);
      }
      break;

    case 'escudo':
      caster.towerShield = true;
      logs.push(`${caster.name} ativou Escudo.`);
      break;

    case 'reflexao':
      caster.towerReflectNext = true;
      logs.push(`${caster.name} preparou Reflexão.`);
      break;

    case 'armadura':
      caster.towerArmorTurns = 1;
      logs.push(`${caster.name} ativou Armadura até o próximo turno.`);
      break;

    case 'contra_magica':
      caster.towerShield = true;
      caster.towerReflectNext = true;
      logs.push(`${caster.name} preparou Contra Mágica.`);
      break;

    case 'sorte': {
      const drawn = drawFromPile(drawPile, discardPile);
      if (drawn) caster.cards.push(drawn);
      logs.push(`${caster.name} usou Sorte e comprou ${describeCard(drawn)}.`);
      break;
    }

    case 'segunda_chance':
      for (let i = 0; i < 2; i++) {
        const drawn = drawFromPile(drawPile, discardPile);
        if (drawn) caster.cards.push(drawn);
      }
      (params.segundaChanceDiscardIds ?? []).forEach((discardId) => {
        const index = caster.cards.findIndex((handCard) => handCard.id === discardId);
        if (index >= 0) {
          const [removed] = caster.cards.splice(index, 1);
          if (removed) discardPile.push(removed);
        }
      });
      logs.push(`${caster.name} usou Segunda Chance.`);
      break;

    case 'reciclagem': {
      if (params.reciclagemDiscardId) {
        const handIndex = caster.cards.findIndex((handCard) => handCard.id === params.reciclagemDiscardId);
        if (handIndex >= 0) {
          const [removed] = caster.cards.splice(handIndex, 1);
          if (removed) discardPile.push(removed);
        }
      }
      const candidates = discardPile.filter((discarded) => discarded.id !== card!.id);
      if (candidates.length > 0) {
        const randomPick = candidates[Math.floor(Math.random() * candidates.length)];
        const discardIndex = discardPile.findIndex((discarded) => discarded.id === randomPick.id);
        if (discardIndex >= 0) {
          const [removed] = discardPile.splice(discardIndex, 1);
          caster.cards.push(removed);
        }
      }
      logs.push(`${caster.name} reciclou cartas do descarte.`);
      break;
    }

    case 'cura': {
      if (params.discardRecoveryId) {
        const discardIndex = discardPile.findIndex((discarded) => discarded.id === params.discardRecoveryId);
        if (discardIndex >= 0) {
          const [removed] = discardPile.splice(discardIndex, 1);
          caster.cards.push(removed);
        }
      }
      logs.push(`${caster.name} curou uma carta das últimas descartadas.`);
      break;
    }

    case 'visao': {
      const topCards =
        drawPile
          .slice(-5)
          .reverse()
          .map(describeCard)
          .join(', ') || 'Monte vazio';
      privateMessages.push(`Topo do monte: ${topCards}`);
      logs.push(`${caster.name} usou Visão para olhar o topo do monte.`);
      break;
    }

    case 'troca':
      if (finalTarget && params.ownCardId && finalTarget.cards.length > 0) {
        const ownIndex = caster.cards.findIndex((handCard) => handCard.id === params.ownCardId);
        const targetIndexForCard = Math.floor(Math.random() * finalTarget.cards.length);
        if (ownIndex >= 0) {
          const [ownCard] = caster.cards.splice(ownIndex, 1);
          const [targetCard] = finalTarget.cards.splice(targetIndexForCard, 1);
          caster.cards.push(targetCard);
          finalTarget.cards.push(ownCard);
          logs.push(`${caster.name} trocou uma carta com ${finalTarget.name}.`);
        }
      }
      break;

    case 'reforco':
      for (let i = 0; i < 3; i++) {
        const drawn = drawFromPile(drawPile, discardPile);
        if (drawn) caster.cards.push(drawn);
      }
      logs.push(`${caster.name} usou Reforço e comprou 3 cartas.`);
      break;

    case 'terremoto': {
      laidDownPhases.forEach((layout) => {
        const owner = players.find((player) => player.id === layout.playerId);
        if (owner) {
          owner.cards.push(...layout.groups.flat());
          owner.hasLaidDownThisRound = false;
        }
      });
      laidDownPhases = [];
      const handSizes = players.map((player) => player.cards.length);
      const allHandCards = shuffleDeck(players.flatMap((player) => player.cards));
      let cursor = 0;
      players.forEach((player, index) => {
        player.cards = allHandCards.slice(cursor, cursor + handSizes[index]);
        cursor += handSizes[index];
      });
      logs.push(`${caster.name} causou Terremoto.`);
      break;
    }

    case 'tempestade': {
      laidDownPhases = returnLaidDownToHands(players, laidDownPhases);
      const hands = players.map((player) => player.cards);
      players.forEach((player, index) => {
        player.cards = hands[(index - 1 + hands.length) % hands.length];
      });
      logs.push(
        `${caster.name} invocou Tempestade: desafios baixados voltaram às mãos e todos passaram a mão para a esquerda.`,
      );
      break;
    }

    case 'eclipse':
      logs.push(`${caster.name} ativou Eclipse: poderes bloqueados nesta rodada.`);
      break;

    case 'colapso':
      players.forEach((player) => {
        for (let i = 0; i < 3; i++) {
          const drawn = drawFromPile(drawPile, discardPile);
          if (drawn) player.cards.push(drawn);
        }
      });
      logs.push(`${caster.name} causou Colapso: todos compraram 3 cartas.`);
      break;

    case 'tempo_congelado':
      caster.towerExtraTurn = true;
      logs.push(`${caster.name} congelou o tempo e terá um turno extra.`);
      break;

    case 'roubo_supremo':
      if (finalTarget && finalTarget.cards.length > 0) {
        const amount = Math.floor(finalTarget.cards.length / 2);
        let stolenCount = 0;
        for (let i = 0; i < amount; i++) {
          const stolenIndex = Math.floor(Math.random() * finalTarget.cards.length);
          const [stolen] = finalTarget.cards.splice(stolenIndex, 1);
          if (stolen) {
            caster.cards.push(stolen);
            stolenCount += 1;
          }
        }
        if (stolenCount > 0) {
          finalTarget.towerBonusDrawNextTurn =
            (finalTarget.towerBonusDrawNextTurn ?? 0) + stolenCount;
        }
        logs.push(
          `${caster.name} roubou ${stolenCount} carta(s) de ${finalTarget.name}; ${finalTarget.name} comprará a mesma quantidade no próximo turno.`,
        );
      }
      break;

    case 'reset':
      players.forEach((player) => {
        if (player.phase > 1) {
          player.phase -= 1;
        }
      });
      logs.push(
        `${caster.name} usou Reset: jogadores acima do Desafio 1 voltaram um andar (quem estava no Desafio 1 permaneceu).`,
      );
      break;

    case 'julgamento': {
      const minCards = Math.min(...players.map((player) => player.cards.length));
      players
        .filter((player) => player.cards.length === minCards)
        .forEach((player) => {
          for (let i = 0; i < 5; i++) {
            const drawn = drawFromPile(drawPile, discardPile);
            if (drawn) player.cards.push(drawn);
          }
        });
      logs.push(`${caster.name} lançou Julgamento.`);
      break;
    }

    case 'destino': {
      const opponents = players.filter((player) => player.id !== caster.id);
      if (opponents.length > 0) {
        const randomTarget = opponents[Math.floor(Math.random() * opponents.length)];
        const casterPhase = caster.phase;
        caster.phase = randomTarget.phase;
        randomTarget.phase = casterPhase;
        logs.push(`${caster.name} trocou de desafio com ${randomTarget.name} (Destino).`);
      }
      break;
    }

    default:
      logs.push(`${caster.name} usou ${card!.powerName}.`);
      break;
  }

  if (caster.towerCharacterClass === 'mago') {
    const bonusDraw = drawFromPile(drawPile, discardPile);
    if (bonusDraw) {
      caster.cards.push(bonusDraw);
      logs.push(`${caster.name} (Mago) comprou +1 carta ao usar poder.`);
    }
  }

  return {
    gameRoom: {
      ...gameRoom,
      drawPile,
      discardPile,
      players,
      laidDownPhases,
      towerPowersDisabledRound,
      lastTowerPowerPlayed,
    },
    log: logs.join(' '),
    logType: 'action',
    privateMessages: privateMessages.length > 0 ? privateMessages : undefined,
  };
}

export type ClassAbilityParams = {
  alchemistCardId?: string;
};

export function applyClassAbility(
  gameRoom: GameRoom,
  memberId: string,
  params: ClassAbilityParams,
): TowerActionResult {
  if (!isTowerMaster(gameRoom)) {
    throw new BadRequestException('Não é partida de Mestre da Torre.');
  }

  const playerIndex = gameRoom.players.findIndex((p) => p.id === memberId);
  if (playerIndex < 0) throw new BadRequestException('Jogador não encontrado.');
  const activeIndex = gameRoom.currentTurnIndex;
  if (playerIndex !== activeIndex) {
    throw new BadRequestException('Não é o seu turno.');
  }
  if (!gameRoom.hasDrawnThisTurn) {
    throw new BadRequestException('Compre uma carta antes de usar a habilidade.');
  }

  const player = gameRoom.players[playerIndex];
  if (player.towerClassAbilityUsedThisRound) {
    throw new BadRequestException('Habilidade de classe já usada nesta rodada.');
  }
  const classId = player.towerCharacterClass;
  if (!classId) throw new BadRequestException('Classe não selecionada.');

  if (classId === 'mago') {
    const copyResult = applyTowerPower(gameRoom, memberId, { copyMode: true });
    const players = copyResult.gameRoom.players.map((p, idx) =>
      idx === playerIndex ? { ...p, towerClassAbilityUsedThisRound: true } : p,
    );
    return {
      ...copyResult,
      gameRoom: { ...copyResult.gameRoom, players },
      log: `${player.name} (Mago) copiou ${gameRoom.lastTowerPowerPlayed?.powerName ?? 'um poder'}.`,
      logType: 'success',
    };
  }

  const drawPile = [...gameRoom.drawPile];
  const discardPile = [...gameRoom.discardPile];
  const players = clonePlayers(gameRoom.players);
  let laidDownPhases = gameRoom.laidDownPhases.map((layout) => ({
    ...layout,
    groups: layout.groups.map((group) => [...group]),
  }));
  const caster = players[playerIndex];
  const logs: string[] = [];

  if (classId === 'guerreiro') {
    const opponentLayouts = laidDownPhases.filter(
      (layout) => layout.playerId !== memberId && layout.groups.flat().length > 0,
    );
    if (opponentLayouts.length === 0) {
      throw new BadRequestException('Nenhum adversário tem cartas baixadas.');
    }
    const victimLayout = opponentLayouts[Math.floor(Math.random() * opponentLayouts.length)];
    const laidCards = victimLayout.groups.flat();
    const destroyed = laidCards[Math.floor(Math.random() * laidCards.length)];
    const victimId = victimLayout.playerId;
    const victim = players.find((p) => p.id === victimId);
    if (victim) {
      const returned = laidCards.filter((c) => c.id !== destroyed.id);
      victim.cards.push(...returned);
      victim.hasLaidDownThisRound = false;
      victim.towerBonusDrawNextTurn = (victim.towerBonusDrawNextTurn ?? 0) + 1;
    }
    laidDownPhases = laidDownPhases.filter((layout) => layout.playerId !== victimId);
    discardPile.push(destroyed);
    caster.towerClassAbilityUsedThisRound = true;
    logs.push(
      `${caster.name} (Guerreiro) destruiu ${describeCard(destroyed)} de ${victimLayout.playerName}.`,
    );
  } else if (classId === 'ladino') {
    const targets = players.filter((p) => p.id !== memberId && p.cards.length > 0);
    if (targets.length === 0) {
      throw new BadRequestException('Nenhum adversário com cartas na mão.');
    }
    const victim = targets[Math.floor(Math.random() * targets.length)];
    const stealCount = Math.min(2, victim.cards.length);
    const stolen: Card[] = [];
    for (let i = 0; i < stealCount; i++) {
      const pickIndex = Math.floor(Math.random() * victim.cards.length);
      const [stolenCard] = victim.cards.splice(pickIndex, 1);
      if (stolenCard) stolen.push(stolenCard);
    }
    caster.cards.push(...stolen);
    let drawnCount = 0;
    for (let i = 0; i < 2; i++) {
      const drawn = drawFromPile(drawPile, discardPile);
      if (drawn) {
        victim.cards.push(drawn);
        drawnCount += 1;
      }
    }
    caster.towerClassAbilityUsedThisRound = true;
    logs.push(
      `${caster.name} (Ladino) roubou ${stolen.length} carta(s) de ${victim.name}; ${victim.name} comprou ${drawnCount}.`,
    );
  } else if (classId === 'guardiao') {
    caster.towerAttackImmune = true;
    caster.towerClassAbilityUsedThisRound = true;
    logs.push(`${caster.name} (Guardião) ficou imune a ataques até o próximo turno.`);
  } else if (classId === 'alquimista') {
    if (!params.alchemistCardId) {
      throw new BadRequestException('Selecione uma carta para transformar.');
    }
    const picked = caster.cards.find((c) => c.id === params.alchemistCardId);
    if (!picked) throw new BadRequestException('Carta não está na sua mão.');
    if (picked.type === 'wild') {
      throw new BadRequestException('Esta carta já é um Coringa.');
    }
    caster.cards = caster.cards.map((handCard) =>
      handCard.id === picked.id
        ? { ...handCard, type: 'wild' as const, value: 0, color: 'wild' as const }
        : handCard,
    );
    caster.towerClassAbilityUsedThisRound = true;
    logs.push(`${caster.name} (Alquimista) transformou ${describeCard(picked)} em Coringa.`);
  } else {
    throw new BadRequestException('Habilidade de classe inválida.');
  }

  return {
    gameRoom: { ...gameRoom, drawPile, discardPile, players, laidDownPhases },
    log: logs.join(' '),
    logType: 'success',
  };
}

export type LegendaryParams = {
  generalCardIds?: string[];
  group1CardIds?: string[];
  group2CardIds?: string[];
};

export function applyLegendary(
  gameRoom: GameRoom,
  memberId: string,
  params: LegendaryParams,
): TowerActionResult {
  if (!isTowerMaster(gameRoom)) {
    throw new BadRequestException('Não é partida de Mestre da Torre.');
  }

  const playerIndex = gameRoom.players.findIndex((p) => p.id === memberId);
  if (playerIndex < 0) throw new BadRequestException('Jogador não encontrado.');

  const player = gameRoom.players[playerIndex];
  if (player.towerLegendaryUsedThisRound) {
    throw new BadRequestException('Lendária já usada nesta rodada.');
  }
  const legendaryId = player.towerLegendaryId;
  if (!legendaryId) throw new BadRequestException('Sem carta lendária.');

  const isActiveTurn = gameRoom.currentTurnIndex === playerIndex;
  const isMestreOrdemOffTurn =
    legendaryId === 'mestre_da_ordem' && !isActiveTurn && !player.hasLaidDownThisRound;

  if (legendaryId !== 'mestre_da_ordem' || isActiveTurn) {
    if (!isActiveTurn) {
      throw new BadRequestException('Não é o seu turno.');
    }
    if (!gameRoom.hasDrawnThisTurn && legendaryId !== 'guardiao') {
      throw new BadRequestException('Compre uma carta antes de usar a lendária.');
    }
  } else if (!isMestreOrdemOffTurn) {
    throw new BadRequestException('Não pode usar Mestre da Ordem agora.');
  }

  if (player.towerCannotLayDown && legendaryId === 'mestre_da_ordem') {
    throw new BadRequestException('Você está bloqueado e não pode baixar o desafio.');
  }

  const drawPile = [...gameRoom.drawPile];
  const discardPile = [...gameRoom.discardPile];
  const players = clonePlayers(gameRoom.players);
  let laidDownPhases = [...gameRoom.laidDownPhases];
  const caster = players[playerIndex];
  const logs: string[] = [];

  if (legendaryId === 'ladrao') {
    let stolenTotal = 0;
    players.forEach((p, index) => {
      if (index === playerIndex) return;
      if (p.cards.length === 0) return;
      const pickIndex = Math.floor(Math.random() * p.cards.length);
      const [stolen] = p.cards.splice(pickIndex, 1);
      if (stolen) {
        caster.cards.push(stolen);
        stolenTotal += 1;
      }
    });
    players.forEach((p) => {
      const drawn = drawFromPile(drawPile, discardPile);
      if (drawn) p.cards.push(drawn);
    });
    caster.towerLegendaryUsedThisRound = true;
    logs.push(`${caster.name} usou Ladrão: roubou ${stolenTotal} carta(s); todos compraram 1.`);
  } else if (legendaryId === 'general') {
    const peek = drawPile.slice(-3);
    if (peek.length === 0) throw new BadRequestException('O monte está vazio.');
    const chosenIds = params.generalCardIds ?? [];
    if (chosenIds.length === 0) {
      throw new BadRequestException('Escolha cartas do monte.');
    }
    const chosen: Card[] = [];
    for (const id of chosenIds) {
      const card = peek.find((c) => c.id === id);
      if (card) chosen.push(card);
    }
    chosen.forEach((card) => {
      const pileIndex = drawPile.findIndex((pileCard) => pileCard.id === card.id);
      if (pileIndex >= 0) drawPile.splice(pileIndex, 1);
      caster.cards.push(card);
    });
    caster.towerLegendaryUsedThisRound = true;
    logs.push(`${caster.name} usou General e escolheu ${chosen.length} carta(s) do monte.`);
  } else if (legendaryId === 'mago') {
    const copyResult = applyTowerPower(
      { ...gameRoom, drawPile, discardPile, players, laidDownPhases },
      memberId,
      { copyMode: true },
    );
    const updatedPlayers = copyResult.gameRoom.players.map((p, idx) =>
      idx === playerIndex ? { ...p, towerLegendaryUsedThisRound: true } : p,
    );
    return {
      ...copyResult,
      gameRoom: { ...copyResult.gameRoom, players: updatedPlayers },
      log: `${caster.name} usou Mago lendário e copiou ${gameRoom.lastTowerPowerPlayed?.powerName ?? 'um poder'}.`,
      logType: 'success',
    };
  } else if (legendaryId === 'mestre_da_ordem') {
    if (player.hasLaidDownThisRound) {
      throw new BadRequestException('Você já baixou o desafio nesta rodada.');
    }
    const groups =
      params.group1CardIds && params.group1CardIds.length > 0
        ? [
            params.group1CardIds
              .map((id) => caster.cards.find((c) => c.id === id))
              .filter((c): c is Card => !!c),
            (params.group2CardIds ?? [])
              .map((id) => caster.cards.find((c) => c.id === id))
              .filter((c): c is Card => !!c),
          ].filter((g) => g.length > 0)
        : botTryToFormPhase(caster);

    const phaseDef = STANDARD_PHASES.find((phase) => phase.id === caster.phase);
    if (!groups || !phaseDef || !validatePhase(phaseDef.type, groups).isValid) {
      throw new BadRequestException('Você não tem as cartas para baixar o desafio atual.');
    }

    const usedIds = new Set(groups.flat().map((c) => c.id));
    caster.cards = caster.cards.filter((c) => !usedIds.has(c.id));
    caster.hasLaidDownThisRound = true;
    caster.towerLegendaryUsedThisRound = true;

    const newLaidDown: LaidDownPhase = {
      playerId: caster.id,
      playerName: caster.name,
      playerColor: caster.color || '#a855f7',
      phaseId: caster.phase,
      groups,
    };
    laidDownPhases = [...laidDownPhases, newLaidDown];
    logs.push(`${caster.name} usou Mestre da Ordem e baixou o desafio automaticamente!`);
  } else if (legendaryId === 'guardiao') {
    caster.towerAttackImmune = true;
    caster.towerLegendaryUsedThisRound = true;
    logs.push(`${caster.name} usou Guardião lendário: imune a ataques até o próximo turno.`);
  } else {
    throw new BadRequestException('Lendária inválida.');
  }

  return {
    gameRoom: { ...gameRoom, drawPile, discardPile, players, laidDownPhases },
    log: logs.join(' '),
    logType: 'success',
  };
}

/** Após descarte: turno extra ou avanço com efeitos de início de turno. */
export function afterTowerDiscardAdvance(
  gameRoom: GameRoom,
  consumedExtraTurn: boolean,
): { gameRoom: GameRoom; extraTurnLog?: string; turnStart?: TowerActionResult } {
  const active = gameRoom.players[gameRoom.currentTurnIndex];
  if (active?.towerExtraTurn && !consumedExtraTurn) {
    const players = gameRoom.players.map((p, idx) =>
      idx === gameRoom.currentTurnIndex ? { ...p, towerExtraTurn: false } : p,
    );
    let next: GameRoom = {
      ...gameRoom,
      players,
      hasDrawnThisTurn: false,
      currentTurnStartedAt: Date.now(),
    };
    const turnStart = applyTowerTurnStart(next, next.currentTurnIndex);
    next = turnStart.gameRoom;
    return {
      gameRoom: next,
      extraTurnLog: `${active.name} ganhou o turno extra.`,
      turnStart,
    };
  }
  return { gameRoom };
}
