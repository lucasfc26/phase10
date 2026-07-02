import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Book, Send, MessageSquare, ListTodo, 
  Check, ArrowRight, CornerRightDown,
  Award, AlertCircle, Volume2, VolumeX, Ban, Trash2, Wand2, Layers, Hand, User, BatteryCharging
} from 'lucide-react';
import { PlayerAvatar } from './PlayerAvatar';
import { avatarDisplayText } from '../lib/characterAvatar';
import {
  getHandFanLayout,
  getHandFanSpreadWidth,
  sortHandCards,
  useCompactHandLayout,
  type HandSortMode,
} from '../lib/handFan';
import { cardPipClass, isTowerPowerCard, towerPowerCategoryLabel, resolveTowerCardImageSrc, getPlayingCardShellClass } from '../lib/cards';
import {
  StandardPlayingCardFace,
  TowerPowerCardFace,
} from './PlayingCardFace';
import {
  getCardDisplayInfo,
  getLegendaryDisplayInfo,
  pickRandomLegendaryId,
  towerChallengeLabel,
} from '../games/towerMaster/cardInfo';
import {
  pickRandomTowerCharacterClass,
  getTowerCharacterInfo,
} from '../games/towerMaster/characters';
import type { TowerCharacterClass } from '../types';
import { TowerCharacterSelect, TowerCharacterBadge } from './TowerCharacterSelect';
import { 
  Card, Player, GameRoom, LaidDownPhase, GameLog, ChatMessage, STANDARD_PHASES 
} from '../types';
import { 
  generateDeck, generateTowerMasterDeck, shuffleDeck, calculateHandScore, validatePhase, 
  identifyGroupTypes, isValidHit, botShouldDrawFromDiscard, 
  botTryToFormPhase, botChooseDiscard, botFindHits, getRandomBotPhrase, generateId,
  evaluateRoundEnd, advanceToNextPlayer, ensureActivePlayerNotSkipped,
  getRoundStarterIndex, pickRandomAutoDrawSource, pickRandomCardFromHand, pickRandomSkipTarget, recycleDiscardIntoDrawPile
} from '../gameEngine';
import { RulesModal } from './RulesModal';
import { PassAndPlayTransition } from './PassAndPlayTransition';
import { ToastStack, type ToastItem, type ToastType } from './ToastStack';
import { TowerPromptModal, type TowerPromptState } from './TowerPromptModal';
import { TowerAbsorbModal } from './TowerAbsorbModal';
import { TowerRevealModal, type TowerRevealState } from './TowerRevealModal';
import { absorbEnergyGain, isAbsorbablePowerCard } from '../games/towerMaster/absorb';
import { RoomSession } from '../services/onlineApi';
import { connectOnlineSocket, emitGameAction, getRoomDeletedMessage } from '../services/onlineSocket';

interface GameBoardProps {
  initialRoom: GameRoom;
  playerProfile: { name: string; avatar: string; color: string };
  onlineSession?: RoomSession | null;
  onExit: () => void;
  initialSoundEnabled?: boolean;
  onPhasesOnTableChange?: (hasPhases: boolean) => void;
}

function TowerInspectedCardPreview({ card }: { card: Card }) {
  const isPower = isTowerPowerCard(card);

  return (
    <div className={`playing-card tower-inspected-card text-left ${getPlayingCardShellClass(card)}`}>
      {isPower ? <TowerPowerCardFace card={card} /> : <StandardPlayingCardFace card={card} />}
    </div>
  );
}

function TowerLegendaryPreview({ legendaryId }: { legendaryId: string }) {
  const info = getLegendaryDisplayInfo(legendaryId);
  return (
    <div className="playing-card playing-card--tower playing-card--tower-legendary tower-inspected-card">
      <div className="playing-card__power-art">
        <img src={info.imageSrc} alt="" draggable={false} />
      </div>
      <div className="playing-card__power-name">{info.name}</div>
    </div>
  );
}

function TowerClassPreview({ classId }: { classId: TowerCharacterClass }) {
  const info = getTowerCharacterInfo(classId);
  if (!info) return null;
  return (
    <div className="playing-card playing-card--tower playing-card--tower-legendary tower-inspected-card tower-class-preview">
      <div className="playing-card__power-art">
        <img src={info.imageSrc} alt="" draggable={false} />
      </div>
      <div className="playing-card__power-name">{info.name}</div>
    </div>
  );
}

export const GameBoard: React.FC<GameBoardProps> = ({
  initialRoom,
  playerProfile,
  onlineSession,
  onExit,
  initialSoundEnabled = true,
  onPhasesOnTableChange,
}) => {
  const [room, setRoom] = useState<GameRoom>(initialRoom);
  const isOnline = !!onlineSession;
  const isTowerMaster = initialRoom.settings.cardGame === 'tower_master';
  const gameTitle = isTowerMaster ? 'Mestre da Torre' : 'Phase 10';
  const floorLabel = (n: number) => (isTowerMaster ? towerChallengeLabel(n) : `Fase ${n}`);
  const floorWord = isTowerMaster ? 'Desafio' : 'Fase';
  const floorWordLower = isTowerMaster ? 'desafio' : 'fase';
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'logs' | 'chat'>('logs');
  
  // Rules modal state
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  
  // Audio state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(initialSoundEnabled);

  // Turn Flow States
  // 'idle' = not their turn, 'drawing' = must draw, 'playing' = can lay down/hit/must discard
  const [turnState, setTurnState] = useState<'drawing' | 'playing' | 'idle'>('idle');
  
  // Local Pass and Play transition overlay
  const [showTransition, setShowTransition] = useState<boolean>(false);
  const [transitionPlayer, setTransitionPlayer] = useState<Player | null>(null);

  // Phase Builder states (for assembling sets/runs before laying down)
  const [isBuildingPhase, setIsBuildingPhase] = useState<boolean>(false);
  const [buildGroup1, setBuildGroup1] = useState<Card[]>([]);
  const [buildGroup2, setBuildGroup2] = useState<Card[]>([]);

  // Selected cards in hand (multi-select in phase builder, single for discard/hit)
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [towerInspectedCardId, setTowerInspectedCardId] = useState<string | null>(null);
  const [towerLegendarySelected, setTowerLegendarySelected] = useState(false);
  const [towerClassSelected, setTowerClassSelected] = useState(false);
  const primarySelectedCard = selectedCards.length === 1 ? selectedCards[0] : null;
  const selectedHitCard = selectedCards.length > 0 ? selectedCards[0] : null;

  const clearCardSelection = () => {
    setSelectedCards([]);
    setTowerInspectedCardId(null);
    setTowerLegendarySelected(false);
    setTowerClassSelected(false);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const resolveTowerPrompt = (value: unknown) => {
    towerPromptResolverRef.current?.(value);
    towerPromptResolverRef.current = null;
    setTowerPrompt(null);
  };

  const cancelTowerPrompt = () => resolveTowerPrompt(null);

  const openTowerPrompt = <T,>(state: TowerPromptState): Promise<T | null> =>
    new Promise((resolve) => {
      towerPromptResolverRef.current = resolve as (value: unknown) => void;
      setTowerPrompt(state);
    });

  const resolveHandPick = (card: Card | null) => {
    towerHandPickResolverRef.current?.(card);
    towerHandPickResolverRef.current = null;
    setTowerHandPick(null);
  };

  const pickHandCard = (title: string, cards: Card[], subtitle?: string): Promise<Card | null> => {
    if (cards.length === 0) {
      showToast('Nenhuma carta disponível para seleção.', 'warning');
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      towerHandPickResolverRef.current = resolve;
      setTowerHandPick({
        title,
        subtitle,
        eligibleIds: new Set(cards.map((handCard) => handCard.id)),
      });
    });
  };

  const [handSortMode, setHandSortMode] = useState<HandSortMode | null>(null);
  const compactHand = useCompactHandLayout();
  const [towerPowersDisabledRound, setTowerPowersDisabledRound] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [towerPrompt, setTowerPrompt] = useState<TowerPromptState | null>(null);
  const [towerHandPick, setTowerHandPick] = useState<{
    title: string;
    subtitle?: string;
    eligibleIds: Set<string>;
  } | null>(null);
  const [towerAbsorbOpen, setTowerAbsorbOpen] = useState(false);
  const [towerReveal, setTowerReveal] = useState<TowerRevealState | null>(null);
  const towerPromptResolverRef = useRef<((value: unknown) => void) | null>(null);
  const towerHandPickResolverRef = useRef<((card: Card | null) => void) | null>(null);
  const towerInfoToastsRef = useRef<string[]>([]);
  const towerRevealPendingRef = useRef<TowerRevealState | null>(null);
  const lastTowerPowerPlayedRef = useRef<Card | null>(null);

  // Skip selector target modal
  const [skipCardPending, setSkipCardPending] = useState<Card | null>(null);
  const [showSkipSelector, setShowSkipSelector] = useState<boolean>(false);

  // How the current round ended (for results screen messaging)
  const [roundEndReason, setRoundEndReason] = useState<'go_out' | 'all_laid_down'>('go_out');
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null);
  const roundEndHandledRef = useRef(false);
  const pendingActionRef = useRef(false);
  const lastStateVersionRef = useRef(initialRoom.stateVersion ?? 0);
  const lastTowerEnergyTurnRef = useRef<string>('');
  const lastTurnAlertKeyRef = useRef<string | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  // Sound generator
  const playSound = (type: 'draw' | 'discard' | 'laydown' | 'skip' | 'win' | 'click' | 'turn') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'draw') {
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'discard') {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'laydown') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(261.63, ctx.currentTime); // C4
        osc.frequency.setValueAtTime(329.63, ctx.currentTime + 0.1); // E4
        osc.frequency.setValueAtTime(392.00, ctx.currentTime + 0.2); // G4
        osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.3); // C5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } else if (type === 'skip') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.setValueAtTime(200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'win') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3);
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      } else if (type === 'turn') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else { // click
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {
      console.warn("Audio Context blocked or not supported", e);
    }
  };

  const alertPlayerTurn = (key: string) => {
    if (lastTurnAlertKeyRef.current === key) return;
    lastTurnAlertKeyRef.current = key;
    playSound('turn');
  };

  const getAutoDiscardChoice = (player: Player): { card: Card; skipPlayerId: string | null } | null => {
    const randomCard = pickRandomCardFromHand(player.cards);
    if (!randomCard) return null;
    if (randomCard.type !== 'skip') {
      return { card: randomCard, skipPlayerId: null };
    }

    const randomTarget = pickRandomSkipTarget(room.players, player.id);
    if (randomTarget) {
      return { card: randomCard, skipPlayerId: randomTarget };
    }

    const nonSkipCards = player.cards.filter((card) => card.type !== 'skip');
    const fallbackCard = pickRandomCardFromHand(nonSkipCards);
    if (!fallbackCard) return null;
    return { card: fallbackCard, skipPlayerId: null };
  };

  // Helper for scroll references
  const logEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    onPhasesOnTableChange?.(room.laidDownPhases.length > 0);
    return () => {
      onPhasesOnTableChange?.(false);
    };
  }, [room.laidDownPhases, onPhasesOnTableChange]);

  // Log a new system message
  const addLog = (message: string, type: GameLog['type'] = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, {
      id: generateId(),
      timestamp: time,
      message,
      type
    }]);
  };

  // Add a chat message
  const addChatMessage = (senderName: string, senderAvatar: string, senderColor: string, message: string, isSystem = false) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [...prev, {
      id: generateId(),
      senderName,
      senderAvatar,
      senderColor,
      message,
      timestamp: time,
      isSystem
    }]);
  };

  const applyOnlineGameState = (state: GameRoom) => {
    const version = state.stateVersion ?? 0;
    if (version < lastStateVersionRef.current) return;
    lastStateVersionRef.current = version;

    setRoom(state);
    roundEndHandledRef.current = state.status === 'round_end';
    if (state.status === 'round_end') {
      const allLaid =
        state.players.length > 0 &&
        state.players.every((p) => state.laidDownPhases.some((l) => l.playerId === p.id));
      setRoundEndReason(allLaid ? 'all_laid_down' : 'go_out');
    }
    if (state.status === 'playing') {
      setAutoStartCountdown(null);
      roundEndHandledRef.current = false;
      const active = state.players[state.currentTurnIndex];
      const myTurn = active?.id === onlineSession?.memberId && !active?.isSkipped;
      if (myTurn) {
        setTurnState(state.hasDrawnThisTurn ? 'playing' : 'drawing');
      } else {
        setTurnState('idle');
      }
    }
    if (state.status === 'character_select') {
      setTurnState('idle');
    }
  };

  const handleOnlineActionResult = (result: {
    ok?: boolean;
    error?: string;
    room?: GameRoom;
    privateMessages?: string[];
    privateReveals?: TowerRevealState[];
  }) => {
    if (result?.error) {
      showToast(result.error, 'error');
      return false;
    }
    result.privateMessages?.forEach((message) => showToast(message, 'info'));
    if (result.privateReveals?.[0]) {
      setTowerReveal(result.privateReveals[0]);
    }
    if (result?.room) applyOnlineGameState(result.room);
    return true;
  };

  const sendOnlineAction = (
    action: Record<string, unknown>,
    onSuccess?: () => void,
  ) => {
    if (pendingActionRef.current) return false;
    pendingActionRef.current = true;
    setIsActionPending(true);
    emitGameAction(
      { ...action, expectedStateVersion: lastStateVersionRef.current },
      (result) => {
      pendingActionRef.current = false;
      setIsActionPending(false);
      if (!handleOnlineActionResult(result)) return;
      onSuccess?.();
    });
    return true;
  };

  // ----------------------------------------------------
  // GAME STARTER (SETUP PILES, DEAL CARDS)
  // ----------------------------------------------------
  const startNewRound = (currentRoom: GameRoom) => {
    addLog(`--- Rodada ${currentRoom.roundNumber} Iniciando ---`, 'phase');
    lastTowerPowerPlayedRef.current = null;
    setTowerLegendarySelected(false);
    setTowerClassSelected(false);
    
    // Create new clean deck
    const freshDeck = currentRoom.settings.cardGame === 'tower_master'
      ? generateTowerMasterDeck()
      : generateDeck();
    const shuffled = shuffleDeck(freshDeck);
    
    // Deal starting hand (12 in Tower Master, 10 in Phase 10)
    const handSize = currentRoom.settings.cardGame === 'tower_master' ? 12 : 10;
    const updatedPlayers = currentRoom.players.map((player) => {
      const hand: Card[] = [];
      for (let i = 0; i < handSize; i++) {
        const card = shuffled.pop();
        if (card) hand.push(card);
      }
      const isTower = currentRoom.settings.cardGame === 'tower_master';
      return {
        ...player,
        cards: hand.sort((a, b) => a.value - b.value), // sort by value initially
        hasLaidDownThisRound: false,
        isSkipped: false,
        energy: isTower ? player.energy ?? 3 : player.energy,
        towerArmorTurns: Math.max(0, (player.towerArmorTurns ?? 0) - 1),
        towerCannotLayDown: false,
        towerCannotDraw: false,
        towerExtraTurn: false,
        towerAttackImmune: false,
        towerShield: isTower && player.towerCharacterClass === 'guardiao' ? true : false,
        towerLegendaryId: isTower
          ? player.towerLegendaryId ?? pickRandomLegendaryId()
          : player.towerLegendaryId,
        towerLegendaryUsedThisRound: false,
        towerClassAbilityUsedThisRound: false,
      };
    });

    // Populate discard pile with 1 card
    const discardPile: Card[] = [];
    let initialDiscard = shuffled.pop();
    // In Phase 10, if the first discard is a Skip, it can still stand, but usually we just put it.
    // If it's a Wild, it counts too.
    if (initialDiscard) {
      discardPile.push(initialDiscard);
    }

    const starterIndex = getRoundStarterIndex(currentRoom.roundNumber, updatedPlayers.length);

    const nextRoomState: GameRoom = {
      ...currentRoom,
      status: 'playing',
      players: updatedPlayers,
      drawPile: shuffled,
      discardPile,
      laidDownPhases: [],
      currentTurnIndex: starterIndex,
    };

    setRoom(nextRoomState);

    roundEndHandledRef.current = false;

    // Announce current phases
    updatedPlayers.forEach(p => {
      addLog(`${avatarDisplayText(p.avatar)} ${p.name} está buscando o ${floorLabel(p.phase)}.`, 'info');
    });

    // Setup first turn
    const firstPlayer = updatedPlayers[starterIndex];
    addLog(`Vez de ${firstPlayer.name}!`, 'action');

    // Trigger Transition Overlay if it's a human in Pass & Play
    if (currentRoom.settings.gameMode === 'pass_and_play') {
      setTransitionPlayer(firstPlayer);
      setShowTransition(true);
      setTurnState('idle');
    } else {
      // VS bots mode: if index 0 is host (human), set local state
      if (!firstPlayer.isBot) {
        setTurnState('drawing');
      } else {
        setTurnState('idle');
      }
    }
  };

  // Initialize local game or connect online
  useEffect(() => {
    if (isOnline && onlineSession) {
      applyOnlineGameState(initialRoom);
      connectOnlineSocket(onlineSession.sessionToken, {
        onGameState: (state) => applyOnlineGameState(state),
        onGameLog: (log) => {
          setLogs((prev) => [...prev, log]);
        },
        onRoomDeleted: (payload) => {
          showToast(getRoomDeletedMessage(payload.reason), 'warning');
          onExit();
        },
      });
      return;
    }

    roundEndHandledRef.current = false;

    lastTowerPowerPlayedRef.current = null;

    if (isTowerMaster && initialRoom.status === 'character_select') {
      const playersWithClasses = initialRoom.players.map((player) => ({
        ...player,
        towerCharacterClass:
          player.towerCharacterClass ??
          (player.isBot ? pickRandomTowerCharacterClass() : player.towerCharacterClass),
      }));
      const allReady = playersWithClasses.every((player) => player.towerCharacterClass);
      if (allReady) {
        const readyRoom = {
          ...initialRoom,
          players: playersWithClasses,
          status: 'playing' as const,
        };
        startNewRound(readyRoom);
        addChatMessage('Sistema', 'system', '#78716c', `Bem-vindo ao ${gameTitle}. Boa partida!`, true);
      } else {
        setRoom((prev) => ({
          ...prev,
          players: playersWithClasses,
        }));
        addChatMessage('Sistema', 'system', '#78716c', 'Escolha seu personagem para começar a partida.', true);
      }
      return;
    }

    startNewRound(initialRoom);
    addChatMessage('Sistema', 'system', '#78716c', `Bem-vindo ao ${gameTitle}. Boa partida!`, true);
  }, []);

  const characterSelectPlayer =
    isTowerMaster && room.status === 'character_select'
      ? isOnline
        ? room.players.find(
            (p) => p.id === onlineSession?.memberId && !p.towerCharacterClass && !p.isBot,
          )
        : room.players.find((player) => !player.towerCharacterClass && !player.isBot)
      : null;

  const handleCharacterClassPick = (classId: TowerCharacterClass) => {
    if (!characterSelectPlayer) return;

    if (isOnline) {
      sendOnlineAction({ type: 'select_character', classId });
      return;
    }

    const classInfo = getTowerCharacterInfo(classId);
    setRoom((prev) => {
      const updatedPlayers = prev.players.map((player) =>
        player.id === characterSelectPlayer.id
          ? { ...player, towerCharacterClass: classId }
          : player,
      );
      const allReady = updatedPlayers.every((player) => player.towerCharacterClass);
      if (allReady) {
        const readyRoom = { ...prev, players: updatedPlayers, status: 'playing' as const };
        window.setTimeout(() => startNewRound(readyRoom), 0);
        return readyRoom;
      }
      return { ...prev, players: updatedPlayers };
    });
    addLog(
      `${characterSelectPlayer.name} escolheu a classe ${classInfo?.name ?? classId}.`,
      'success',
    );
  };

  // ----------------------------------------------------
  // GETTERS & HELPERS
  // ----------------------------------------------------
  const activePlayer = room.players[room.currentTurnIndex];
  const localHumanPlayer =
    isOnline && onlineSession
      ? room.players.find((p) => p.id === onlineSession.memberId)
      : room.settings.gameMode === 'pass_and_play'
        ? activePlayer
        : room.players.find((p) => !p.isBot) ?? room.players[0];
  const myPlayer = localHumanPlayer || activePlayer;

  const legendaryInfo =
    isTowerMaster && myPlayer?.towerLegendaryId
      ? getLegendaryDisplayInfo(myPlayer.towerLegendaryId)
      : null;

  const characterClassInfo =
    isTowerMaster && myPlayer?.towerCharacterClass
      ? getTowerCharacterInfo(myPlayer.towerCharacterClass)
      : null;

  const isMyTurn = isOnline
    ? room.players[room.currentTurnIndex]?.id === onlineSession?.memberId && !showTransition
    : activePlayer && !activePlayer.isBot && !showTransition;

  const inspectedCard =
    isTowerMaster && towerInspectedCardId
      ? myPlayer.cards.find((c) => c.id === towerInspectedCardId) ?? null
      : selectedCards.length > 0
        ? selectedCards[selectedCards.length - 1]
        : null;
  const inspectedCardInfo = towerClassSelected && characterClassInfo
    ? { name: characterClassInfo.name, description: characterClassInfo.exclusive }
    : towerLegendarySelected && legendaryInfo
    ? { name: legendaryInfo.name, description: legendaryInfo.description }
    : inspectedCard
      ? getCardDisplayInfo(inspectedCard)
      : null;

  const canActivateClassAbility =
    isTowerMaster &&
    !!characterClassInfo &&
    !myPlayer.towerClassAbilityUsedThisRound &&
    isMyTurn &&
    turnState === 'playing' &&
    !towerPrompt &&
    !towerHandPick &&
    !towerAbsorbOpen &&
    room.status === 'playing';

  const absorbableHandCards = myPlayer.cards.filter(isAbsorbablePowerCard);
  const canOpenAbsorb =
    isTowerMaster &&
    isMyTurn &&
    turnState === 'playing' &&
    room.hasDrawnThisTurn &&
    !towerPrompt &&
    !towerHandPick &&
    !towerAbsorbOpen &&
    !isBuildingPhase &&
    absorbableHandCards.length > 0 &&
    room.status === 'playing';

  const canUseClassAbility = canActivateClassAbility && towerClassSelected;

  const canUseLegendaryBase =
    isTowerMaster &&
    towerLegendarySelected &&
    !myPlayer.towerLegendaryUsedThisRound &&
    !towerPrompt &&
    !towerHandPick &&
    !towerAbsorbOpen &&
    room.status === 'playing';

  const towerPowersBlocked = isOnline
    ? room.towerPowersDisabledRound === room.roundNumber
    : room.roundNumber === towerPowersDisabledRound;

  const canUseMestreOrdemOffTurn =
    myPlayer.towerLegendaryId === 'mestre_da_ordem' &&
    !isMyTurn &&
    !myPlayer.hasLaidDownThisRound &&
    !myPlayer.towerCannotLayDown;

  const canUseLegendary =
    canUseLegendaryBase &&
    ((isMyTurn && turnState === 'playing') || canUseMestreOrdemOffTurn);
  
  useEffect(() => {
    if (!isTowerMaster || isOnline || room.status !== 'playing') return;
    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer) return;

    const turnKey = `${room.roundNumber}-${room.currentTurnIndex}-${currentPlayer.id}`;
    if (lastTowerEnergyTurnRef.current === turnKey) return;
    lastTowerEnergyTurnRef.current = turnKey;

    let ladinoPeekToast: string | null = null;

    setRoom((prev) => {
      const drawPile = [...prev.drawPile];
      const discardPile = [...prev.discardPile];
      const players = prev.players.map((player) => ({ ...player, cards: [...player.cards] }));
      const activeIndex = prev.currentTurnIndex;
      const active = players[activeIndex];
      const nextEnergy = Math.min(6, (active.energy ?? 3) + 1);
      active.energy = nextEnergy;
      active.towerAttackImmune = false;
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
          addLog(
            `${active.name} recebeu +${drawnCount} carta(s) extra no início do turno (efeito Guerreiro).`,
            'info',
          );
        }
      }

      if (active.towerCharacterClass === 'ladino' && Math.random() < 0.2) {
        const top =
          drawPile.length > 0
            ? drawPile[drawPile.length - 1]
            : discardPile[discardPile.length - 1];
        if (top) {
          addLog(
            `${active.name} (Ladino) passiva: viu ${describeCard(top)} no topo do monte.`,
            'info',
          );
          if (active.id === localHumanPlayer?.id) {
            ladinoPeekToast = `Topo do monte: ${describeCard(top)}`;
          }
        }
      }

      if (active.towerCharacterClass === 'alquimista' && Math.random() < 0.15) {
        active.towerExtraTurn = true;
        addLog(`${active.name} (Alquimista) passiva: jogará um turno extra!`, 'success');
      }

      if (active.towerCharacterClass === 'guerreiro' && Math.random() < 0.15) {
        const opponents = players.filter(
          (player, index) =>
            index !== activeIndex && player.cards.length > 0 && !player.towerAttackImmune,
        );
        if (opponents.length > 0) {
          const victim = opponents[Math.floor(Math.random() * opponents.length)];
          const cardIndex = Math.floor(Math.random() * victim.cards.length);
          const [destroyed] = victim.cards.splice(cardIndex, 1);
          if (destroyed) {
            discardPile.push(destroyed);
            const replacement = drawFromPile(drawPile, discardPile);
            if (replacement) victim.cards.push(replacement);
            addLog(
              `${active.name} (Guerreiro) passiva: ${victim.name} perdeu ${describeCard(destroyed)} e comprou outra do monte.`,
              'warning',
            );
          }
        }
      }

      return { ...prev, drawPile, discardPile, players };
    });

    if (ladinoPeekToast) showToast(ladinoPeekToast, 'info');
  }, [isTowerMaster, isOnline, room.status, room.roundNumber, room.currentTurnIndex]);

  // Sincroniza turno no modo online quando o servidor atualiza currentTurnIndex
  useEffect(() => {
    if (!isOnline || !onlineSession || room.status !== 'playing') return;

    const active = room.players[room.currentTurnIndex];
    if (!active) return;

    if (active.id === onlineSession.memberId && !active.isSkipped) {
      if (!room.hasDrawnThisTurn) {
        alertPlayerTurn(
          `online-${room.roundNumber}-${room.currentTurnIndex}-${room.stateVersion ?? 0}`,
        );
      }
      setTurnState((prev) => {
        if (room.hasDrawnThisTurn) return 'playing';
        return prev === 'playing' ? 'playing' : 'drawing';
      });
    } else {
      setIsBuildingPhase(false);
      setBuildGroup1([]);
      setBuildGroup2([]);
      clearCardSelection();
      setTurnState('idle');
    }
  }, [
    isOnline,
    onlineSession?.memberId,
    room.currentTurnIndex,
    room.roundNumber,
    room.status,
    room.players,
    room.hasDrawnThisTurn,
    room.stateVersion,
  ]);

  useEffect(() => {
    if (isOnline || room.status !== 'playing' || showTransition || !activePlayer || activePlayer.isBot) {
      return;
    }

    const timeoutMs =
      turnState === 'drawing'
        ? room.settings.drawTimeoutMs
        : turnState === 'playing'
          ? room.settings.discardTimeoutMs
          : 0;

    if (!timeoutMs || timeoutMs <= 0) return;

    const timer = window.setTimeout(() => {
      if (turnState === 'drawing') {
        const source = pickRandomAutoDrawSource(room.discardPile.length);
        handleDrawCard(source);
        return;
      }

      if (turnState === 'playing') {
        const choice = getAutoDiscardChoice(activePlayer);
        if (choice) {
          executeDiscard(choice.card, choice.skipPlayerId);
        }
      }
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [
    activePlayer,
    isOnline,
    room.currentTurnIndex,
    room.discardPile.length,
    room.roundNumber,
    room.settings.discardTimeoutMs,
    room.settings.drawTimeoutMs,
    room.status,
    showTransition,
    turnState,
  ]);

  // Is Phase builder complete/valid?
  const checkBuilderValidity = (): { isValid: boolean; error?: string } => {
    const builderPlayer = isOnline ? myPlayer : activePlayer;
    const playerPhaseId = builderPlayer.phase;
    const phaseDef = STANDARD_PHASES.find(p => p.id === playerPhaseId);
    if (!phaseDef) return { isValid: false, error: 'Fase não encontrada' };

    const groups: Card[][] = [];
    if (buildGroup1.length > 0) groups.push(buildGroup1);
    if (buildGroup2.length > 0) groups.push(buildGroup2);

    return validatePhase(phaseDef.type, groups);
  };

  const sortHand = (mode: HandSortMode) => {
    playSound('click');
    setHandSortMode(mode);
  };

  const describeCard = (card?: Card): string => {
    if (!card) return 'Carta';
    if (card.type === 'power') return card.powerName ?? 'Poder';
    if (card.type === 'wild') return 'Curinga';
    if (card.type === 'skip') return 'Skip';
    return `${card.value} ${card.color}`;
  };

  const drawFromPile = (drawPile: Card[], discardPile: Card[]): Card | undefined => {
    recycleDiscardIntoDrawPile(drawPile, discardPile);
    return drawPile.pop();
  };

  const cardMatchesTowerColor = (handCard: Card, color: Card['color']): boolean =>
    handCard.type === 'number' && handCard.color === color;

  const returnLaidDownToHands = (
    players: Player[],
    phases: LaidDownPhase[],
    playerIds?: string[],
  ): LaidDownPhase[] => {
    const idSet = playerIds ? new Set(playerIds) : null;
    phases.forEach((layout) => {
      if (idSet && !idSet.has(layout.playerId)) return;
      const owner = players.find((p) => p.id === layout.playerId);
      if (owner) {
        owner.cards.push(...layout.groups.flat());
        owner.hasLaidDownThisRound = false;
      }
    });
    return idSet ? phases.filter((layout) => !idSet.has(layout.playerId)) : [];
  };

  const applyTowerPower = (
    card: Card,
    {
      target,
      chosenColor,
      ownChosenCard,
      discardRecoveryId,
      reciclagemDiscardId,
      segundaChanceDiscardIds,
    }: {
      target: Player | null;
      chosenColor: Card['color'] | null;
      ownChosenCard: Card | null;
      discardRecoveryId: string | null;
      reciclagemDiscardId: string | null;
      segundaChanceDiscardIds: string[];
    },
    options?: { copyMode?: boolean },
  ) => {
    playSound('laydown');
    if (!options?.copyMode && card.powerId === 'eclipse') {
      setTowerPowersDisabledRound(room.roundNumber);
    }
    if (!options?.copyMode) {
      lastTowerPowerPlayedRef.current = card;
    }

    towerInfoToastsRef.current = [];
    towerRevealPendingRef.current = null;
    const handAfterPowerRef = { cards: [] as Card[] };
    const cost = options?.copyMode ? 0 : (card.powerCost ?? 0);

    setRoom((prev) => {
      const drawPile = [...prev.drawPile];
      const discardPile = options?.copyMode ? [...prev.discardPile] : [...prev.discardPile, card];
      let laidDownPhases = prev.laidDownPhases.map((layout) => ({
        ...layout,
        groups: layout.groups.map((group) => [...group]),
      }));
      const players = prev.players.map((player) => ({
        ...player,
        cards: [...player.cards],
        energy: player.energy ?? 3,
      }));

      const activeIndex = prev.currentTurnIndex;
      const caster = players[activeIndex];
      if (!options?.copyMode) {
        caster.cards = caster.cards.filter((handCard) => handCard.id !== card.id);
      }
      if (cost > 0) {
        caster.energy = Math.max(0, (caster.energy ?? 3) - cost);
      }

      let effectiveTargetId = target?.id ?? null;
      const targetIndex = effectiveTargetId ? players.findIndex((player) => player.id === effectiveTargetId) : -1;

      const isAttack = card.powerCategory === 'attack' || card.powerId === 'roubo_supremo';
      if (isAttack && targetIndex >= 0) {
        const targetPlayer = players[targetIndex];
        if (targetPlayer.towerAttackImmune) {
          addLog(`${targetPlayer.name} bloqueou ${card.powerName} (imune a ataques).`, 'warning');
          effectiveTargetId = null;
        } else if (targetPlayer.towerArmorTurns && targetPlayer.towerArmorTurns > 0) {
          addLog(`${targetPlayer.name} bloqueou ${card.powerName} com Armadura.`, 'warning');
          effectiveTargetId = null;
        } else if (targetPlayer.towerShield) {
          targetPlayer.towerShield = false;
          addLog(`${targetPlayer.name} bloqueou ${card.powerName} com Escudo.`, 'warning');
          effectiveTargetId = null;
        } else if (targetPlayer.towerReflectNext) {
          targetPlayer.towerReflectNext = false;
          effectiveTargetId = caster.id;
          addLog(`${targetPlayer.name} refletiu ${card.powerName} de volta para ${caster.name}.`, 'warning');
        }
      }

      const finalTargetIndex = effectiveTargetId ? players.findIndex((player) => player.id === effectiveTargetId) : -1;
      const finalTarget = finalTargetIndex >= 0 ? players[finalTargetIndex] : null;

      switch (card.powerId) {
        case 'roubo':
          if (finalTarget && finalTarget.cards.length > 0) {
            const stolenIndex = Math.floor(Math.random() * finalTarget.cards.length);
            const [stolen] = finalTarget.cards.splice(stolenIndex, 1);
            if (stolen) {
              caster.cards.push(stolen);
              addLog(`${caster.name} roubou uma carta de ${finalTarget.name}.`, 'action');
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
                addLog(
                  `${caster.name} quebrou o desafio de ${finalTarget.name}: cartas foram para sua mão${deckCard ? ' (1 substituída pelo monte)' : ''}.`,
                  'warning',
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
            addLog(
              `${finalTarget.name} perdeu ${describeCard(lostCard)} e recebeu ${describeCard(replacement)} do monte.`,
              'warning',
            );
          }
          break;

        case 'inversao':
          if (finalTarget) {
            laidDownPhases = returnLaidDownToHands(players, laidDownPhases, [caster.id, finalTarget.id]);
            const casterHand = caster.cards;
            caster.cards = finalTarget.cards;
            finalTarget.cards = casterHand;
            addLog(
              `${caster.name} trocou a mão inteira com ${finalTarget.name} (desafios baixados voltaram às mãos antes da troca).`,
              'warning',
            );
          }
          break;

        case 'congelar':
          if (finalTarget) {
            finalTarget.towerCannotDraw = true;
            addLog(`${finalTarget.name} foi congelado: não pode comprar cartas até o próximo turno.`, 'warning');
          }
          break;

        case 'maldicao':
          if (finalTarget) {
            for (let i = 0; i < 2; i++) {
              const drawn = drawFromPile(drawPile, discardPile);
              if (drawn) finalTarget.cards.push(drawn);
            }
            addLog(`${finalTarget.name} sofreu Maldição e comprou 2 cartas.`, 'warning');
          }
          break;

        case 'bloqueio':
          if (finalTarget) {
            finalTarget.towerCannotLayDown = true;
            addLog(`${finalTarget.name} não poderá baixar ${floorWordLower} até o próximo turno.`, 'warning');
          }
          break;

        case 'espiao':
          if (finalTarget) {
            towerRevealPendingRef.current = {
              title: `Mão de ${finalTarget.name}`,
              cards: finalTarget.cards.map((handCard) => ({ ...handCard })),
            };
            addLog(`${caster.name} espionou a mão de ${finalTarget.name}.`, 'action');
          }
          break;

        case 'cacador':
          if (chosenColor) {
            players.forEach((player) => {
              const index = player.cards.findIndex((handCard) => cardMatchesTowerColor(handCard, chosenColor));
              if (index >= 0) {
                const [discarded] = player.cards.splice(index, 1);
                discardPile.push(discarded);
              }
              const drawn = drawFromPile(drawPile, discardPile);
              if (drawn) player.cards.push(drawn);
            });
            addLog(`${caster.name} caçou a cor ${chosenColor}: todos descartaram (se possível) e compraram do monte.`, 'warning');
          }
          break;

        case 'escudo':
          caster.towerShield = true;
          addLog(`${caster.name} ativou Escudo: ataques contra você serão negados em tempo real.`, 'success');
          break;

        case 'reflexao':
          caster.towerReflectNext = true;
          addLog(`${caster.name} preparou Reflexão para devolver o próximo ataque.`, 'success');
          break;

        case 'armadura':
          caster.towerArmorTurns = 1;
          addLog(`${caster.name} ativou Armadura até o próximo turno.`, 'success');
          break;

        case 'contra_magica':
          caster.towerShield = true;
          caster.towerReflectNext = true;
          addLog(`${caster.name} preparou Contra Mágica como defesa reforçada.`, 'success');
          break;

        case 'sorte': {
          const drawn = drawFromPile(drawPile, discardPile);
          if (drawn) caster.cards.push(drawn);
          addLog(`${caster.name} usou Sorte e comprou ${describeCard(drawn)}.`, 'success');
          break;
        }

        case 'segunda_chance':
          for (let i = 0; i < 2; i++) {
            const drawn = drawFromPile(drawPile, discardPile);
            if (drawn) caster.cards.push(drawn);
          }
          segundaChanceDiscardIds.forEach((discardId) => {
            const index = caster.cards.findIndex((handCard) => handCard.id === discardId);
            if (index >= 0) {
              const [removed] = caster.cards.splice(index, 1);
              if (removed) discardPile.push(removed);
            }
          });
          addLog(`${caster.name} usou Segunda Chance.`, 'success');
          break;

        case 'reciclagem': {
          if (reciclagemDiscardId) {
            const handIndex = caster.cards.findIndex((handCard) => handCard.id === reciclagemDiscardId);
            if (handIndex >= 0) {
              const [removed] = caster.cards.splice(handIndex, 1);
              if (removed) discardPile.push(removed);
            }
          }
          const candidates = discardPile.filter((discarded) => discarded.id !== card.id);
          if (candidates.length > 0) {
            const randomPick = candidates[Math.floor(Math.random() * candidates.length)];
            const discardIndex = discardPile.findIndex((discarded) => discarded.id === randomPick.id);
            if (discardIndex >= 0) {
              const [removed] = discardPile.splice(discardIndex, 1);
              caster.cards.push(removed);
            }
          }
          addLog(`${caster.name} reciclou: descartou uma carta e pegou outra aleatória do descarte.`, 'success');
          break;
        }

        case 'cura': {
          if (discardRecoveryId) {
            const discardIndex = discardPile.findIndex((discarded) => discarded.id === discardRecoveryId);
            if (discardIndex >= 0) {
              const [removed] = discardPile.splice(discardIndex, 1);
              caster.cards.push(removed);
            }
          }
          addLog(`${caster.name} curou uma carta das últimas descartadas.`, 'success');
          break;
        }

        case 'visao': {
          const topCards = drawPile.slice(-5).reverse().map((handCard) => ({ ...handCard }));
          towerRevealPendingRef.current = {
            title: 'Topo do monte',
            cards: topCards,
          };
          addLog(`${caster.name} usou Visão para olhar o topo do monte.`, 'success');
          break;
        }

        case 'troca':
          if (finalTarget && ownChosenCard && finalTarget.cards.length > 0) {
            const ownIndex = caster.cards.findIndex((handCard) => handCard.id === ownChosenCard.id);
            const targetIndexForCard = Math.floor(Math.random() * finalTarget.cards.length);
            if (ownIndex >= 0) {
              const [ownCard] = caster.cards.splice(ownIndex, 1);
              const [targetCard] = finalTarget.cards.splice(targetIndexForCard, 1);
              caster.cards.push(targetCard);
              finalTarget.cards.push(ownCard);
              addLog(`${caster.name} trocou uma carta com ${finalTarget.name}.`, 'success');
            }
          }
          break;

        case 'reforco':
          for (let i = 0; i < 3; i++) {
            const drawn = drawFromPile(drawPile, discardPile);
            if (drawn) caster.cards.push(drawn);
          }
          addLog(`${caster.name} usou Reforço e comprou 3 cartas.`, 'success');
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

          addLog(`${caster.name} causou Terremoto: desafios voltaram às mãos e todas as mãos foram embaralhadas.`, 'warning');
          break;
        }

        case 'tempestade': {
          laidDownPhases = returnLaidDownToHands(players, laidDownPhases);
          const hands = players.map((player) => player.cards);
          players.forEach((player, index) => {
            player.cards = hands[(index - 1 + hands.length) % hands.length];
          });
          addLog(
            `${caster.name} invocou Tempestade: desafios baixados voltaram às mãos e todos passaram a mão para a esquerda.`,
            'warning',
          );
          break;
        }

        case 'eclipse':
          addLog(`${caster.name} ativou Eclipse: poderes ficam bloqueados nesta rodada.`, 'warning');
          break;

        case 'colapso':
          players.forEach((player) => {
            for (let i = 0; i < 3; i++) {
              const drawn = drawFromPile(drawPile, discardPile);
              if (drawn) player.cards.push(drawn);
            }
          });
          addLog(`${caster.name} causou Colapso: todos compraram 3 cartas.`, 'warning');
          break;

        case 'tempo_congelado':
          caster.towerExtraTurn = true;
          addLog(`${caster.name} congelou o tempo e terá um turno extra após descartar.`, 'success');
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
            addLog(
              `${caster.name} roubou ${stolenCount} carta(s) de ${finalTarget.name}; ${finalTarget.name} comprará a mesma quantidade no próximo turno.`,
              'warning',
            );
          }
          break;

        case 'reset':
          players.forEach((player) => {
            if (player.phase > 1) {
              player.phase -= 1;
            }
          });
          addLog(
            `${caster.name} usou Reset: jogadores acima do Desafio 1 voltaram um andar (quem estava no Desafio 1 permaneceu).`,
            'warning',
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
          addLog(`${caster.name} lançou Julgamento: quem tinha menos cartas comprou 5.`, 'warning');
          break;
        }

        case 'destino': {
          const opponents = players.filter((player) => player.id !== caster.id);
          if (opponents.length > 0) {
            const randomTarget = opponents[Math.floor(Math.random() * opponents.length)];
            const casterPhase = caster.phase;
            caster.phase = randomTarget.phase;
            randomTarget.phase = casterPhase;
            addLog(
              `${caster.name} trocou de desafio com ${randomTarget.name} aleatoriamente (Destino).`,
              'warning',
            );
          }
          break;
        }

        default:
          addLog(`${caster.name} usou ${card.powerName}.`, 'action');
          break;
      }

      handAfterPowerRef.cards = [...caster.cards];

      if (caster.towerCharacterClass === 'mago') {
        const bonusDraw = drawFromPile(drawPile, discardPile);
        if (bonusDraw) {
          caster.cards.push(bonusDraw);
          addLog(`${caster.name} (Mago) comprou +1 carta ao usar poder.`, 'success');
        }
      }

      return {
        ...prev,
        drawPile,
        discardPile,
        players,
        laidDownPhases,
      };
    });

    towerInfoToastsRef.current.forEach((message) => showToast(message, 'info'));
    if (towerRevealPendingRef.current) {
      setTowerReveal(towerRevealPendingRef.current);
      towerRevealPendingRef.current = null;
    }

    if (towerInspectedCardId === card.id) {
      setTowerInspectedCardId(null);
    }

    const remainingHand = handAfterPowerRef.cards;
    if (remainingHand.length > 0) {
      const nextCard = remainingHand.find((handCard) => handCard.type !== 'power') ?? remainingHand[0];
      setSelectedCards([nextCard]);
      setTowerInspectedCardId(nextCard.id);
    } else {
      clearCardSelection();
    }
  };

  const handleUseTowerPower = async (
    card: Card,
    options?: { copyMode?: boolean; onSuccess?: () => void },
  ) => {
    if (!isTowerMaster || !isMyTurn || turnState !== 'playing' || card.type !== 'power') return;
    if (!options?.copyMode && (towerPrompt || towerHandPick || towerAbsorbOpen)) return;

    if (towerPowersBlocked && card.powerId !== 'eclipse') {
      showToast('Eclipse está ativo: ninguém pode usar poderes nesta rodada.', 'warning');
      return;
    }

    const cost = options?.copyMode ? 0 : (card.powerCost ?? 0);
    if (!options?.copyMode && (activePlayer.energy ?? 3) < cost) {
      showToast(`Energia insuficiente. ${card.powerName} custa ${cost} energia.`, 'warning');
      return;
    }

    const needsTarget = new Set([
      'roubo',
      'quebra_sequencia',
      'destruicao',
      'inversao',
      'congelar',
      'maldicao',
      'bloqueio',
      'espiao',
      'troca',
      'roubo_supremo',
    ]);

    let target: Player | null = null;
    if (needsTarget.has(card.powerId ?? '')) {
      const options = room.players.filter((player) => player.id !== activePlayer.id);
      if (options.length === 0) {
        showToast('Nenhum alvo disponível.', 'warning');
        return;
      }
      target = await openTowerPrompt<Player>({
        kind: 'player',
        title: `Escolha o alvo para ${card.powerName}`,
        subtitle: 'Toque em um jogador para aplicar o efeito.',
        players: options,
        floorLabel,
      });
      if (!target) return;
    }

    let chosenColor: Card['color'] | null = null;
    if (card.powerId === 'cacador') {
      chosenColor = await openTowerPrompt<Card['color']>({
        kind: 'color',
        title: 'Escolha uma cor',
        subtitle: 'Todos descartam uma carta da cor (se possível) e recebem uma carta aleatória do monte.',
      });
      if (!chosenColor) return;
    }

    let ownChosenCard: Card | null = null;
    if (card.powerId === 'troca') {
      ownChosenCard = await pickHandCard(
        'Escolha uma carta sua para trocar',
        activePlayer.cards.filter((handCard) => handCard.id !== card.id),
        'Toque na carta da sua mão que será trocada.',
      );
      if (!ownChosenCard) return;
    }

    let discardRecoveryId: string | null = null;
    let reciclagemDiscardId: string | null = null;

    if (card.powerId === 'reciclagem') {
      const picked = await pickHandCard(
        'Reciclagem — escolha uma carta para descartar',
        activePlayer.cards.filter((handCard) => handCard.id !== card.id),
        'Toque na carta da mão que será descartada.',
      );
      if (!picked) return;
      reciclagemDiscardId = picked.id;
    }

    if (card.powerId === 'cura') {
      const candidates = room.discardPile.slice(-5).filter((discarded) => discarded.id !== card.id);
      if (candidates.length > 0) {
        const picked = await openTowerPrompt<Card>({
          kind: 'discard',
          title: 'Cura — escolha uma carta do descarte',
          subtitle: 'Últimas 5 cartas descartadas. Toque para recuperar.',
          cards: candidates,
        });
        if (!picked) return;
        discardRecoveryId = picked.id;
      } else {
        showToast('Não há cartas recentes no descarte para curar.', 'warning');
        return;
      }
    }

    let segundaChanceDiscardIds: string[] = [];
    if (card.powerId === 'segunda_chance') {
      const simulatedDrawPile = [...room.drawPile];
      const simulatedDiscardPile = [...room.discardPile];
      const handForPrompt = activePlayer.cards.filter((handCard) => handCard.id !== card.id);
      for (let i = 0; i < 2; i++) {
        const drawn = drawFromPile(simulatedDrawPile, simulatedDiscardPile);
        if (drawn) handForPrompt.push(drawn);
      }
      for (let i = 0; i < 2 && handForPrompt.length > 0; i++) {
        const remaining = handForPrompt.filter((handCard) => !segundaChanceDiscardIds.includes(handCard.id));
        const picked = await pickHandCard(
          `Segunda Chance — ${i + 1}ª carta para descartar`,
          remaining,
          'Toque na carta da sua mão que será descartada.',
        );
        if (!picked) return;
        segundaChanceDiscardIds.push(picked.id);
      }
    }

    if (isOnline) {
      sendOnlineAction(
        {
          type: 'use_tower_power',
          cardId: options?.copyMode ? undefined : card.id,
          copyMode: options?.copyMode ?? false,
          copiedPowerId: options?.copyMode
            ? room.lastTowerPowerPlayed?.powerId ?? lastTowerPowerPlayedRef.current?.powerId
            : undefined,
          targetPlayerId: target?.id,
          chosenColor: chosenColor ?? undefined,
          ownCardId: ownChosenCard?.id,
          discardRecoveryId: discardRecoveryId ?? undefined,
          reciclagemDiscardId: reciclagemDiscardId ?? undefined,
          segundaChanceDiscardIds,
        },
        options?.onSuccess,
      );
      return;
    }

    applyTowerPower(card, {
      target,
      chosenColor,
      ownChosenCard,
      discardRecoveryId,
      reciclagemDiscardId,
      segundaChanceDiscardIds,
    }, options);
    options?.onSuccess?.();
  };

  const handleLegendaryClick = () => {
    if (!legendaryInfo || myPlayer.towerLegendaryUsedThisRound) return;
    playSound('click');
    setTowerLegendarySelected(true);
    setTowerClassSelected(false);
    setTowerInspectedCardId(null);
    setSelectedCards([]);
  };

  const handleClassClick = () => {
    if (!characterClassInfo || myPlayer.towerClassAbilityUsedThisRound) return;
    playSound('click');
    setTowerClassSelected(true);
    setTowerLegendarySelected(false);
    setTowerInspectedCardId(null);
    setSelectedCards([]);
  };

  const markClassAbilityUsed = () => {
    const myIndex = room.players.findIndex((player) => player.id === myPlayer.id);
    if (myIndex < 0) return;
    setRoom((prev) => ({
      ...prev,
      players: prev.players.map((player, index) =>
        index === myIndex ? { ...player, towerClassAbilityUsedThisRound: true } : player,
      ),
    }));
    setTowerClassSelected(false);
  };

  const handleUseClassAbility = async () => {
    if (!canActivateClassAbility || !myPlayer.towerCharacterClass) return;

    const classId = myPlayer.towerCharacterClass;
    const myIndex = room.players.findIndex((player) => player.id === myPlayer.id);
    if (myIndex < 0) return;

    playSound('laydown');

    if (classId === 'mago') {
      const copied = isOnline ? room.lastTowerPowerPlayed ?? null : lastTowerPowerPlayedRef.current;
      if (!copied?.powerId) {
        showToast('Nenhum poder foi jogado nesta rodada para copiar.', 'warning');
        return;
      }
      if (isOnline) {
        sendOnlineAction({ type: 'use_class_ability' }, () => setTowerClassSelected(false));
        return;
      }
      await handleUseTowerPower(copied, {
        copyMode: true,
        onSuccess: () => {
          markClassAbilityUsed();
          addLog(`${myPlayer.name} (Mago) copiou ${copied.powerName}.`, 'success');
        },
      });
      return;
    }

    if (classId === 'guerreiro') {
      const opponentLayouts = room.laidDownPhases.filter((layout) => {
        if (layout.playerId === myPlayer.id || layout.groups.flat().length === 0) return false;
        const victim = room.players.find((player) => player.id === layout.playerId);
        return victim && !victim.towerAttackImmune;
      });
      if (opponentLayouts.length === 0) {
        showToast('Nenhum adversário vulnerável com cartas baixadas.', 'warning');
        return;
      }
      if (isOnline) {
        sendOnlineAction({ type: 'use_class_ability' }, () => setTowerClassSelected(false));
        return;
      }
      const victimLayout = opponentLayouts[Math.floor(Math.random() * opponentLayouts.length)];
      const laidCards = victimLayout.groups.flat();
      const destroyed = laidCards[Math.floor(Math.random() * laidCards.length)];
      const victimId = victimLayout.playerId;
      const victimName = victimLayout.playerName;

      setRoom((prev) => {
        const discardPile = [...prev.discardPile, destroyed];
        const players = prev.players.map((player) => ({ ...player, cards: [...player.cards] }));
        const victim = players.find((player) => player.id === victimId);
        const fullLayout = prev.laidDownPhases.find((layout) => layout.playerId === victimId);

        if (victim && fullLayout) {
          const returned = fullLayout.groups.flat().filter((card) => card.id !== destroyed.id);
          victim.cards.push(...returned);
          victim.hasLaidDownThisRound = false;
          victim.towerBonusDrawNextTurn = (victim.towerBonusDrawNextTurn ?? 0) + 1;
        }

        const laidDownPhases = prev.laidDownPhases.filter((layout) => layout.playerId !== victimId);
        players[myIndex].towerClassAbilityUsedThisRound = true;

        addLog(
          `${myPlayer.name} (Guerreiro) destruiu ${describeCard(destroyed)} de ${victimName}: desafio baixado voltou para a mão.`,
          'warning',
        );
        addLog(`${victimName} receberá +1 carta no próximo turno.`, 'info');
        return { ...prev, discardPile, laidDownPhases, players };
      });
      setTowerClassSelected(false);
      return;
    }

    if (classId === 'ladino') {
      const targets = room.players.filter(
        (player) => player.id !== myPlayer.id && player.cards.length > 0 && !player.towerAttackImmune,
      );
      if (targets.length === 0) {
        showToast('Nenhum adversário vulnerável com cartas na mão.', 'warning');
        return;
      }
      if (isOnline) {
        sendOnlineAction({ type: 'use_class_ability' }, () => setTowerClassSelected(false));
        return;
      }
      const victim = targets[Math.floor(Math.random() * targets.length)];

      setRoom((prev) => {
        const drawPile = [...prev.drawPile];
        const discardPile = [...prev.discardPile];
        const players = prev.players.map((player) => ({ ...player, cards: [...player.cards] }));
        const caster = players[myIndex];
        const victimIndex = players.findIndex((player) => player.id === victim.id);
        if (victimIndex < 0) return prev;
        const victimPlayer = players[victimIndex];

        const stealCount = Math.min(2, victimPlayer.cards.length);
        const stolen: Card[] = [];
        for (let i = 0; i < stealCount; i++) {
          const pickIndex = Math.floor(Math.random() * victimPlayer.cards.length);
          const [stolenCard] = victimPlayer.cards.splice(pickIndex, 1);
          if (stolenCard) stolen.push(stolenCard);
        }
        caster.cards.push(...stolen);

        let drawnCount = 0;
        for (let i = 0; i < 2; i++) {
          const drawn = drawFromPile(drawPile, discardPile);
          if (drawn) {
            victimPlayer.cards.push(drawn);
            drawnCount += 1;
          }
        }

        caster.towerClassAbilityUsedThisRound = true;
        addLog(
          `${caster.name} (Ladino) roubou ${stolen.length} carta(s) de ${victimPlayer.name}; ${victimPlayer.name} comprou ${drawnCount} do monte.`,
          'warning',
        );
        return { ...prev, drawPile, discardPile, players };
      });
      setTowerClassSelected(false);
      return;
    }

    if (classId === 'guardiao') {
      if (isOnline) {
        sendOnlineAction({ type: 'use_class_ability' }, () => setTowerClassSelected(false));
        return;
      }
      setRoom((prev) => ({
        ...prev,
        players: prev.players.map((player, index) =>
          index === myIndex
            ? { ...player, towerAttackImmune: true, towerClassAbilityUsedThisRound: true }
            : player,
        ),
      }));
      addLog(`${myPlayer.name} (Guardião) ficou imune a ataques até o próximo turno.`, 'success');
      setTowerClassSelected(false);
      return;
    }

    if (classId === 'alquimista') {
      const picked = await pickHandCard(
        'Alquimista — transforme em Coringa',
        myPlayer.cards,
        'A carta vira Coringa até o fim da rodada.',
      );
      if (!picked) return;
      if (picked.type === 'wild') {
        showToast('Esta carta já é um Coringa.', 'warning');
        return;
      }

      if (isOnline) {
        sendOnlineAction(
          { type: 'use_class_ability', alchemistCardId: picked.id },
          () => setTowerClassSelected(false),
        );
        return;
      }

      setRoom((prev) => ({
        ...prev,
        players: prev.players.map((player, index) => {
          if (index !== myIndex) return player;
          return {
            ...player,
            towerClassAbilityUsedThisRound: true,
            cards: player.cards.map((handCard) =>
              handCard.id === picked.id
                ? { ...handCard, type: 'wild' as const, value: 0, color: 'wild' as const }
                : handCard,
            ),
          };
        }),
      }));
      addLog(
        `${myPlayer.name} (Alquimista) transformou ${describeCard(picked)} em Coringa até o fim da rodada.`,
        'success',
      );
      setTowerClassSelected(false);
    }
  };

  const handleAbsorbConfirm = (powerCardIds: string[]) => {
    if (!powerCardIds.length) return;
    if (!isTowerMaster || !isMyTurn || turnState !== 'playing' || !room.hasDrawnThisTurn) return;

    const energyBefore = myPlayer.energy ?? 3;
    const actualGain = absorbEnergyGain(energyBefore, powerCardIds.length);

    playSound('click');
    setTowerAbsorbOpen(false);

    if (isOnline) {
      sendOnlineAction({ type: 'absorb_powers', powerCardIds });
      return;
    }

    const idSet = new Set(powerCardIds);
    setRoom((prev) => {
      const activeIndex = prev.currentTurnIndex;
      const players = prev.players.map((player) => ({ ...player, cards: [...player.cards] }));
      const caster = players[activeIndex];
      const cardsToAbsorb = caster.cards.filter((card) => idSet.has(card.id));
      caster.cards = caster.cards.filter((card) => !idSet.has(card.id));
      caster.energy = Math.min(6, (caster.energy ?? 3) + cardsToAbsorb.length);
      return {
        ...prev,
        players,
        discardPile: [...prev.discardPile, ...cardsToAbsorb],
      };
    });
    addLog(
      `${myPlayer.name} absorveu ${powerCardIds.length} carta(s) de poder e ganhou +${actualGain} energia.`,
      'success',
    );
  };

  const handleUseLegendary = async () => {
    if (!canUseLegendary || !myPlayer.towerLegendaryId) return;

    const legendaryId = myPlayer.towerLegendaryId;
    const myIndex = room.players.findIndex((player) => player.id === myPlayer.id);
    if (myIndex < 0) return;

    playSound('laydown');

    if (legendaryId === 'ladrao') {
      if (isOnline) {
        sendOnlineAction({ type: 'use_legendary' }, () => setTowerLegendarySelected(false));
        return;
      }
      setRoom((prev) => {
        const drawPile = [...prev.drawPile];
        const discardPile = [...prev.discardPile];
        const players = prev.players.map((player) => ({ ...player, cards: [...player.cards] }));
        const caster = players[myIndex];
        let stolenTotal = 0;

        players.forEach((player, index) => {
          if (index === myIndex) return;
          if (player.cards.length === 0) return;
          const pickIndex = Math.floor(Math.random() * player.cards.length);
          const [stolen] = player.cards.splice(pickIndex, 1);
          if (stolen) {
            caster.cards.push(stolen);
            stolenTotal += 1;
          }
        });

        players.forEach((player) => {
          const drawn = drawFromPile(drawPile, discardPile);
          if (drawn) player.cards.push(drawn);
        });

        caster.towerLegendaryUsedThisRound = true;
        addLog(
          `${caster.name} usou Ladrão: roubou ${stolenTotal} carta(s) e todos compraram 1 do monte.`,
          'warning',
        );
        return { ...prev, drawPile, discardPile, players };
      });
      setTowerLegendarySelected(false);
      return;
    }

    if (legendaryId === 'general') {
      const peek = room.drawPile.slice(-3);
      if (peek.length === 0) {
        showToast('O monte está vazio.', 'warning');
        return;
      }

      const pickCount = Math.min(2, peek.length);
      const chosen: Card[] = [];

      for (let i = 0; i < pickCount; i++) {
        const options = peek.filter((card) => !chosen.some((picked) => picked.id === card.id));
        const picked = await openTowerPrompt<Card>({
          kind: 'discard',
          title: `General — escolha a ${i + 1}ª carta`,
          subtitle: `Próximas ${peek.length} carta(s) do monte. Escolha ${pickCount} para sua mão.`,
          cards: options,
        });
        if (!picked) return;
        chosen.push(picked);
      }

      if (isOnline) {
        sendOnlineAction(
          { type: 'use_legendary', generalCardIds: chosen.map((card) => card.id) },
          () => setTowerLegendarySelected(false),
        );
        return;
      }

      setRoom((prev) => {
        const drawPile = [...prev.drawPile];
        const players = prev.players.map((player) => ({ ...player, cards: [...player.cards] }));
        const caster = players[myIndex];

        chosen.forEach((card) => {
          const pileIndex = drawPile.findIndex((pileCard) => pileCard.id === card.id);
          if (pileIndex >= 0) drawPile.splice(pileIndex, 1);
          caster.cards.push(card);
        });

        caster.towerLegendaryUsedThisRound = true;
        addLog(`${caster.name} usou General e escolheu ${chosen.length} carta(s) do monte.`, 'success');
        return { ...prev, drawPile, players };
      });
      setTowerLegendarySelected(false);
      return;
    }

    if (legendaryId === 'mago') {
      const copied = isOnline ? room.lastTowerPowerPlayed ?? null : lastTowerPowerPlayedRef.current;
      if (!copied?.powerId) {
        showToast('Nenhum poder foi jogado nesta rodada para copiar.', 'warning');
        return;
      }
      if (isOnline) {
        sendOnlineAction({ type: 'use_legendary' }, () => setTowerLegendarySelected(false));
        return;
      }
      await handleUseTowerPower(copied, {
        copyMode: true,
        onSuccess: () => {
          setRoom((prev) => ({
            ...prev,
            players: prev.players.map((player, index) =>
              index === prev.currentTurnIndex
                ? { ...player, towerLegendaryUsedThisRound: true }
                : player,
            ),
          }));
          addLog(`${activePlayer.name} usou Mago lendário e copiou ${copied.powerName}.`, 'success');
          setTowerLegendarySelected(false);
        },
      });
      return;
    }

    if (legendaryId === 'mestre_da_ordem') {
      if (myPlayer.hasLaidDownThisRound) {
        showToast(`Você já baixou o ${floorWordLower} nesta rodada.`, 'warning');
        return;
      }
      if (myPlayer.towerCannotLayDown) {
        showToast(`Você está bloqueado e não pode baixar ${floorWordLower}.`, 'warning');
        return;
      }
      if (isMyTurn && !room.hasDrawnThisTurn) {
        showToast('Compre uma carta antes de usar a lendária.', 'warning');
        return;
      }

      const groups = botTryToFormPhase(myPlayer);
      const phaseDef = STANDARD_PHASES.find((phase) => phase.id === myPlayer.phase);
      if (!groups || !phaseDef || !validatePhase(phaseDef.type, groups).isValid) {
        showToast('Você não tem as cartas na mão para baixar o desafio atual.', 'warning');
        return;
      }

      if (isOnline) {
        sendOnlineAction({ type: 'use_legendary' }, () => setTowerLegendarySelected(false));
        return;
      }

      let playersAfterLayDown: Player[] = [];
      let laidDownAfterLayDown: LaidDownPhase[] = [];

      setRoom((prev) => {
        const usedIds = new Set(groups.flat().map((card) => card.id));
        const updatedPlayers = prev.players.map((player, index) => {
          if (index !== myIndex) return player;
          return {
            ...player,
            cards: player.cards.filter((card) => !usedIds.has(card.id)),
            hasLaidDownThisRound: true,
            towerLegendaryUsedThisRound: true,
          };
        });

        const newLaidDown: LaidDownPhase = {
          playerId: myPlayer.id,
          playerName: myPlayer.name,
          playerColor: myPlayer.color || '#a855f7',
          phaseId: myPlayer.phase,
          groups,
        };
        const newLaidDownPhases = [...prev.laidDownPhases, newLaidDown];
        playersAfterLayDown = updatedPlayers;
        laidDownAfterLayDown = newLaidDownPhases;

        return { ...prev, players: updatedPlayers, laidDownPhases: newLaidDownPhases };
      });

      addLog(`${myPlayer.name} usou Mestre da Ordem e baixou o ${floorLabel(myPlayer.phase)} automaticamente!`, 'success');

      const endResult = evaluateRoundEnd(playersAfterLayDown, laidDownAfterLayDown, {
        drawPile: room.drawPile,
        discardPile: room.discardPile,
      });
      if (endResult) {
        handleRoundEnd(endResult.winner, endResult.allAdvance);
      }

      setTowerLegendarySelected(false);
      return;
    }

    if (legendaryId === 'guardiao') {
      if (isOnline) {
        sendOnlineAction({ type: 'use_legendary' }, () => setTowerLegendarySelected(false));
        return;
      }
      setRoom((prev) => {
        const players = prev.players.map((player) => ({ ...player, cards: [...player.cards] }));
        const caster = players[myIndex];
        caster.towerAttackImmune = true;
        caster.towerLegendaryUsedThisRound = true;
        addLog(`${caster.name} usou Guardião lendário: imune a todos os ataques até o próximo turno.`, 'success');
        return { ...prev, players };
      });
      setTowerLegendarySelected(false);
      return;
    }
  };

  // ----------------------------------------------------
  // CORE CARD ACTIONS (DRAW, DISCARD, LAY DOWN, HIT)
  // ----------------------------------------------------

  // Draw card from draw pile or discard pile
  const handleDrawCard = (source: 'draw' | 'discard') => {
    if (!isMyTurn || turnState !== 'drawing' || activePlayer?.isSkipped || isActionPending) return;

    if (isTowerMaster && activePlayer?.towerCannotDraw) {
      showToast('Você está congelado e não pode comprar cartas neste turno.', 'warning');
      return;
    }

    if (isOnline) {
      playSound('draw');
      sendOnlineAction({ type: 'draw', source }, () => {
        setTurnState('playing');
      });
      return;
    }

    playSound('draw');

    setRoom(prev => {
      const drawPile = [...prev.drawPile];
      const discardPile = [...prev.discardPile];
      const updatedPlayers = [...prev.players];
      const playerHand = [...updatedPlayers[prev.currentTurnIndex].cards];
      let drawnCard: Card | undefined;

      if (source === 'draw') {
        const recycled = recycleDiscardIntoDrawPile(drawPile, discardPile);
        if (recycled) {
          addLog("O monte de compras esvaziou! Reciclando descarte...", 'warning');
        }
        drawnCard = drawPile.pop();
        addLog(`${avatarDisplayText(activePlayer.avatar)} ${activePlayer.name} comprou do monte.`, 'action');
      } else {
        drawnCard = discardPile.pop();
        addLog(`${avatarDisplayText(activePlayer.avatar)} ${activePlayer.name} comprou o descarte (${drawnCard?.type === 'wild' ? 'Curinga' : drawnCard?.type === 'skip' ? 'Skip' : drawnCard?.value + ' ' + drawnCard?.color}).`, 'action');
      }

      if (drawnCard) {
        playerHand.push(drawnCard);
      }

      updatedPlayers[prev.currentTurnIndex] = {
        ...updatedPlayers[prev.currentTurnIndex],
        cards: playerHand
      };

      return {
        ...prev,
        drawPile,
        discardPile,
        players: updatedPlayers
      };
    });

    setTurnState('playing');
    clearCardSelection();
  };

  // Discard card to end turn
  const handleDiscard = (card: Card) => {
    if (!isMyTurn || turnState !== 'playing') return;

    // Is it a Skip card?
    if (card.type === 'skip') {
      // Prompt user to select who to skip
      setSkipCardPending(card);
      setShowSkipSelector(true);
      return;
    }

    executeDiscard(card, null);
  };

  const executeDiscard = (card: Card, skipPlayerId: string | null) => {
    if (isOnline) {
      if (isActionPending) return;
      playSound('discard');
      sendOnlineAction({
        type: 'discard',
        cardId: card.id,
        skipPlayerId: skipPlayerId || undefined,
      }, () => {
        setIsBuildingPhase(false);
        setBuildGroup1([]);
        setBuildGroup2([]);
        clearCardSelection();
        setSkipCardPending(null);
        setShowSkipSelector(false);
        setTurnState('idle');
      });
      return;
    }

    playSound('discard');
    
    // Clear selections and builder
    setIsBuildingPhase(false);
    setBuildGroup1([]);
    setBuildGroup2([]);
    clearCardSelection();

    let roundEndResult: ReturnType<typeof evaluateRoundEnd> = null;
    let consumedExtraTurn = false;

    setRoom(prev => {
      const updatedPlayers = prev.players.map((p, idx) => {
        if (idx === prev.currentTurnIndex) {
          const newHand = p.cards.filter(c => c.id !== card.id);
          return {
            ...p,
            cards: newHand,
            towerCannotLayDown: false,
            towerCannotDraw: false,
          };
        }
        
        if (skipPlayerId && p.id === skipPlayerId) {
          return { ...p, isSkipped: true };
        }
        return p;
      });

      const updatedDiscard = [...prev.discardPile, card];

      const endResult = evaluateRoundEnd(updatedPlayers, prev.laidDownPhases, {
        drawPile: prev.drawPile,
        discardPile: updatedDiscard,
      });

      if (endResult) {
        roundEndResult = endResult;
        return {
          ...prev,
          players: updatedPlayers,
          discardPile: updatedDiscard,
        };
      }

      if (updatedPlayers[prev.currentTurnIndex]?.towerExtraTurn) {
        consumedExtraTurn = true;
        updatedPlayers[prev.currentTurnIndex] = {
          ...updatedPlayers[prev.currentTurnIndex],
          towerExtraTurn: false,
        };
        return {
          ...prev,
          players: updatedPlayers,
          discardPile: updatedDiscard,
          currentTurnIndex: prev.currentTurnIndex,
        };
      }

      const advanced = advanceToNextPlayer(updatedPlayers, prev.currentTurnIndex);
      advanced.skippedPlayers.forEach((skipped) => {
        addLog(`${avatarDisplayText(skipped.avatar)} ${skipped.name} foi pulado.`, 'warning');
      });

      return {
        ...prev,
        players: advanced.players,
        discardPile: updatedDiscard,
        currentTurnIndex: advanced.currentTurnIndex,
      };
    });

    if (skipPlayerId) {
      const skippedUser = room.players.find(p => p.id === skipPlayerId);
      addLog(`${avatarDisplayText(activePlayer.avatar)} ${activePlayer.name} descartou Skip e pulou ${avatarDisplayText(skippedUser?.avatar ?? '')} ${skippedUser?.name}.`, 'warning');
      playSound('skip');
    } else {
      const cardDesc = card.type === 'power'
        ? card.powerName ?? 'Poder'
        : card.type === 'wild'
          ? 'Curinga'
          : `${card.value} (${card.color})`;
      addLog(`${avatarDisplayText(activePlayer.avatar)} ${activePlayer.name} descartou ${cardDesc}.`, 'action');
    }

    if (skipCardPending) {
      setSkipCardPending(null);
      setShowSkipSelector(false);
    }

    const finalRoundEndResult = roundEndResult as NonNullable<ReturnType<typeof evaluateRoundEnd>> | null;
    if (finalRoundEndResult) {
      handleRoundEnd(finalRoundEndResult.winner, finalRoundEndResult.allAdvance);
    } else {
      if (consumedExtraTurn) {
        addLog(`${activePlayer.name} ganhou o turno extra de Tempo Congelado.`, 'success');
        if (!activePlayer.isBot) {
          playSound('turn');
        }
        setTurnState('drawing');
      } else {
        setTurnState('idle');
      }
    }
  };

  // Triggered when current active player changes
  useEffect(() => {
    if (room.status !== 'playing') return;
    if (isOnline) return;

    const endResult = evaluateRoundEnd(room.players, room.laidDownPhases, {
      drawPile: room.drawPile,
      discardPile: room.discardPile
    });
    if (endResult) {
      handleRoundEnd(endResult.winner, endResult.allAdvance);
      return;
    }

    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer) return;

    if (currentPlayer.isSkipped) {
      const advanced = ensureActivePlayerNotSkipped(room.players, room.currentTurnIndex);
      advanced.skippedPlayers.forEach((skipped) => {
        addLog(`${avatarDisplayText(skipped.avatar)} ${skipped.name} foi pulado.`, 'warning');
      });
      setRoom((prev) => ({
        ...prev,
        players: advanced.players,
        currentTurnIndex: advanced.currentTurnIndex,
      }));
      return;
    }

    if (room.settings.gameMode === 'pass_and_play' && !isOnline) {
      // In local multiplayer, show the overlay transition screen
      setTransitionPlayer(currentPlayer);
      setShowTransition(true);
    } else {
      // VS Bots mode (not online)
      if (!currentPlayer.isBot) {
        alertPlayerTurn(
          `local-${room.roundNumber}-${room.currentTurnIndex}-${currentPlayer.id}`,
        );
        setTurnState(
          isTowerMaster && currentPlayer.towerCannotDraw ? 'playing' : 'drawing',
        );
      } else {
        setTurnState('idle');
        // Let the bot play automatically
        const timer = setTimeout(() => {
          executeBotTurn(currentPlayer);
        }, room.settings.botDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [room.currentTurnIndex, room.roundNumber]);

  // Handle human confirming transition
  const handleTransitionConfirm = () => {
    if (activePlayer?.isSkipped) return;
    setShowTransition(false);
    alertPlayerTurn(
      `local-transition-${room.roundNumber}-${room.currentTurnIndex}-${activePlayer.id}`,
    );
    setTurnState(
      isTowerMaster && activePlayer?.towerCannotDraw ? 'playing' : 'drawing',
    );
    addLog(`Vez de ${activePlayer.name}!`, 'action');
  };

  // ----------------------------------------------------
  // LAY DOWN PHASE BUILDER INTERACTIONS
  // ----------------------------------------------------
  const handleToggleBuilder = () => {
    playSound('click');
    setIsBuildingPhase(prev => {
      clearCardSelection();
      if (prev) {
        setBuildGroup1([]);
        setBuildGroup2([]);
      }
      return !prev;
    });
  };

  const addCardsToBuildGroup = (cards: Card[], groupNum: 1 | 2) => {
    const phaseCards = cards.filter((card) => card.type !== 'power');
    if (phaseCards.length === 0) return;
    playSound('click');
    const incomingIds = new Set(phaseCards.map((c) => c.id));

    if (groupNum === 1) {
      setBuildGroup2((prev) => prev.filter((c) => !incomingIds.has(c.id)));
      setBuildGroup1((prev) => {
        const existing = new Set(prev.map((c) => c.id));
        return [...prev, ...phaseCards.filter((c) => !existing.has(c.id))];
      });
    } else {
      setBuildGroup1((prev) => prev.filter((c) => !incomingIds.has(c.id)));
      setBuildGroup2((prev) => {
        const existing = new Set(prev.map((c) => c.id));
        return [...prev, ...phaseCards.filter((c) => !existing.has(c.id))];
      });
    }
    clearCardSelection();
  };

  const handleHandCardClick = (card: Card) => {
    if (towerHandPick) {
      if (towerHandPick.eligibleIds.has(card.id)) {
        playSound('click');
        resolveHandPick(card);
      }
      return;
    }

    if (!isMyTurn) return;
    playSound('click');

    if (isTowerMaster) {
      setTowerLegendarySelected(false);
      setTowerClassSelected(false);
      setTowerInspectedCardId(card.id);
    }

    if (isBuildingPhase) {
      if (card.type === 'power') return;
      setSelectedCards((prev) => {
        const exists = prev.some((c) => c.id === card.id);
        if (exists) return prev.filter((c) => c.id !== card.id);
        return [...prev, card];
      });
      return;
    }

    setSelectedCards((prev) => {
      const exists = prev.some((c) => c.id === card.id);
      return exists ? [] : [card];
    });
  };

  const removeCardFromBuildGroup = (cardId: string, groupNum: 1 | 2) => {
    playSound('click');
    if (groupNum === 1) {
      setBuildGroup1(prev => prev.filter(c => c.id !== cardId));
    } else {
      setBuildGroup2(prev => prev.filter(c => c.id !== cardId));
    }
  };

  // Lay Down Phase Action
  const handleLayDownPhase = () => {
    if (isTowerMaster && activePlayer?.towerCannotLayDown) {
      showToast(`Você está bloqueado e não pode baixar ${floorWordLower} neste turno.`, 'warning');
      return;
    }

    const check = checkBuilderValidity();
    if (!check.isValid) {
      showToast(check.error || 'Combinação inválida!', 'error');
      return;
    }

    playSound('laydown');

    if (isOnline) {
      sendOnlineAction({
        type: 'lay_down',
        group1CardIds: buildGroup1.map((c) => c.id),
        group2CardIds: buildGroup2.map((c) => c.id),
      }, () => {
        setIsBuildingPhase(false);
        setBuildGroup1([]);
        setBuildGroup2([]);
        clearCardSelection();
      });
      return;
    }

    const groups = [buildGroup1, buildGroup2].filter(g => g.length > 0);

    let playersAfterLayDown: Player[] = [];
    let laidDownAfterLayDown: LaidDownPhase[] = [];

    setRoom(prev => {
      // 1. Mark player as laid down
      const updatedPlayers = prev.players.map((p, idx) => {
        if (idx === prev.currentTurnIndex) {
          // Remove used cards from hand
          const allUsedIds = [...buildGroup1, ...buildGroup2].map(c => c.id);
          const remainingHand = p.cards.filter(c => !allUsedIds.includes(c.id));
          return {
            ...p,
            cards: remainingHand,
            hasLaidDownThisRound: true
          };
        }
        return p;
      });

      // 2. Add to table laidDownPhases list
      const newLaidDown: LaidDownPhase = {
        playerId: activePlayer.id,
        playerName: activePlayer.name,
        playerColor: activePlayer.color || '#a855f7',
        phaseId: activePlayer.phase,
        groups
      };

      const newLaidDownPhases = [...prev.laidDownPhases, newLaidDown];
      playersAfterLayDown = updatedPlayers;
      laidDownAfterLayDown = newLaidDownPhases;

      return {
        ...prev,
        players: updatedPlayers,
        laidDownPhases: newLaidDownPhases
      };
    });

    addLog(`${avatarDisplayText(activePlayer.avatar)} ${activePlayer.name} baixou o ${floorLabel(activePlayer.phase)}.`, 'success');

    const endResult = evaluateRoundEnd(playersAfterLayDown, laidDownAfterLayDown, {
      drawPile: room.drawPile,
      discardPile: room.discardPile
    });
    if (endResult) {
      handleRoundEnd(endResult.winner, endResult.allAdvance);
      return;
    }

    // Reset Builder
    setIsBuildingPhase(false);
    setBuildGroup1([]);
    setBuildGroup2([]);
    clearCardSelection();

    // Bot banter
    if (room.settings.gameMode === 'bots') {
      triggerBotChatReaction("baixou");
    }
  };

  // ----------------------------------------------------
  // HIT ACTIONS
  // ----------------------------------------------------
  const handleHitCard = (targetPlayerId: string, groupIndex: number) => {
    if (!isMyTurn || turnState !== 'playing' || !selectedHitCard) return;
    if (!activePlayer.hasLaidDownThisRound) {
      showToast(`Você precisa baixar o seu ${floorWordLower} antes de bater nas mesas dos adversários!`, 'warning');
      return;
    }

    // Find the layout group
    const layout = room.laidDownPhases.find(p => p.playerId === targetPlayerId);
    if (!layout) return;

    const group = layout.groups[groupIndex];
    const phaseDef = STANDARD_PHASES.find(p => p.id === layout.phaseId);
    if (!phaseDef) return;

    const categories = identifyGroupTypes(phaseDef.type, layout.groups);
    const category = categories[groupIndex] || 'Grupo';

    // Validate if hit is allowed
    if (!isValidHit(selectedHitCard, group, category)) {
      showToast(`Esta carta não se encaixa neste grupo (${category}).`, 'warning');
      return;
    }

    // Apply hit!
    playSound('draw');

    if (isOnline) {
      sendOnlineAction({
        type: 'hit',
        cardId: selectedHitCard.id,
        targetPlayerId,
        groupIndex,
      }, () => {
        clearCardSelection();
      });
      return;
    }

    let playersAfterHit: Player[] = [];
    let laidDownAfterHit: LaidDownPhase[] = [];

    setRoom(prev => {
      // 1. Remove card from player hand
      const updatedPlayers = prev.players.map((p, idx) => {
        if (idx === prev.currentTurnIndex) {
          const remHand = p.cards.filter(c => c.id !== selectedHitCard.id);
          return { ...p, cards: remHand };
        }
        return p;
      });

      // 2. Add card to target group in laidDownPhases
      const updatedLaidDown = prev.laidDownPhases.map(layoutItem => {
        if (layoutItem.playerId === targetPlayerId) {
          const updatedGroups = layoutItem.groups.map((grp, gIdx) => {
            if (gIdx === groupIndex) {
              return [...grp, selectedHitCard];
            }
            return grp;
          });
          return { ...layoutItem, groups: updatedGroups };
        }
        return layoutItem;
      });

      playersAfterHit = updatedPlayers;
      laidDownAfterHit = updatedLaidDown;

      return {
        ...prev,
        players: updatedPlayers,
        laidDownPhases: updatedLaidDown
      };
    });

    const cardDesc = selectedHitCard.type === 'wild' ? 'Curinga' : `${selectedHitCard.value} (${selectedHitCard.color})`;
    addLog(`${avatarDisplayText(activePlayer.avatar)} ${activePlayer.name} bateu com ${cardDesc} na fase de ${layout.playerName}!`, 'success');
    clearCardSelection();

    const endResult = evaluateRoundEnd(playersAfterHit, laidDownAfterHit, {
      drawPile: room.drawPile,
      discardPile: room.discardPile
    });
    if (endResult) {
      handleRoundEnd(endResult.winner, endResult.allAdvance);
    }
  };

  // ----------------------------------------------------
  // ROUND END & SCORING CALCULATIONS
  // ----------------------------------------------------
  const handleRoundEnd = (roundWinner: Player | null, allAdvance: boolean) => {
    if (roundEndHandledRef.current) return;
    roundEndHandledRef.current = true;

    playSound('win');

    if (allAdvance) {
      setRoundEndReason('all_laid_down');
      addLog('🎉 TODOS BAIARAM SUAS FASES! A RODADA FOI ENCERRADA! 🎉', 'success');
    } else if (roundWinner) {
      setRoundEndReason('go_out');
      addLog(`🎉 ${avatarDisplayText(roundWinner.avatar)} ${roundWinner.name} BATEU E FECHOU A RODADA! 🎉`, 'success');

      // Trigger Chat reaction
      if (room.settings.gameMode === 'bots') {
        const luckyBot = room.players.find(p => p.isBot && p.id !== roundWinner.id);
        if (luckyBot && Math.random() < 0.7) {
          setTimeout(() => {
            addChatMessage(luckyBot.name, luckyBot.avatar, luckyBot.color || '#94a3b8', getRandomBotPhrase());
          }, 800);
        }
      }
    }

    // Calculate scores and advance phases
    setRoom(prev => {
      const scoreReport = prev.players.map(p => {
        const addedScore = calculateHandScore(p.cards);
        const finalScore = p.score + addedScore;
        
        let nextPhase = p.phase;
        if (allAdvance || p.hasLaidDownThisRound) {
          nextPhase = p.phase + 1;
        }

        return {
          ...p,
          score: finalScore,
          phase: nextPhase,
          cards: [], // Clear cards
          hasLaidDownThisRound: false,
          isSkipped: false
        };
      });

      // Check if anyone completed Phase 10 (which means they would have been on Phase 10 AND laid down, advancing them to "Phase 11" technically)
      const finishedPlayers = scoreReport.filter(p => p.phase > 10);
      
      let nextStatus: GameRoom['status'] = 'round_end';
      let overallWinnerId: string | null = null;

      if (finishedPlayers.length > 0) {
        nextStatus = 'game_over';
        // Winner is the one with the lowest score among those who finished
        let lowestScore = Infinity;
        let winner: Player | null = null;
        
        finishedPlayers.forEach(p => {
          if (p.score < lowestScore) {
            lowestScore = p.score;
            winner = p;
          }
        });

        overallWinnerId = winner ? (winner as Player).id : finishedPlayers[0].id;
      }

      return {
        ...prev,
        status: nextStatus,
        players: scoreReport,
        winnerId: overallWinnerId
      };
    });
  };

  // Safety net: detect round-end conditions (local modes only)
  useEffect(() => {
    if (isOnline || room.status !== 'playing') return;
    const endResult = evaluateRoundEnd(room.players, room.laidDownPhases, {
      drawPile: room.drawPile,
      discardPile: room.discardPile
    });
    if (endResult) {
      handleRoundEnd(endResult.winner, endResult.allAdvance);
    }
  }, [room.players, room.laidDownPhases, room.status, room.drawPile.length, room.discardPile.length]);

  // Auto-start next round after showing results
  useEffect(() => {
    if (room.status !== 'round_end') {
      setAutoStartCountdown(null);
      return;
    }

    setAutoStartCountdown(5);
    const interval = setInterval(() => {
      setAutoStartCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
    }, 1000);

    const timer = setTimeout(() => {
      if (isOnline) {
        if (!onlineSession?.isHost) return;
        sendOnlineAction({ type: 'next_round' }, () => {
          roundEndHandledRef.current = false;
          setAutoStartCountdown(null);
        });
      } else {
        handleNextRound();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [room.status, room.roundNumber, isOnline, onlineSession?.isHost]);

  // Continue to Next Round Trigger
  const handleNextRound = () => {
    playSound('click');
    if (isOnline) {
      if (!onlineSession?.isHost) {
        showToast('Apenas o host pode iniciar a próxima rodada.', 'warning');
        return;
      }
      sendOnlineAction({ type: 'next_round' }, () => {
        roundEndHandledRef.current = false;
        setAutoStartCountdown(null);
      });
      return;
    }

    roundEndHandledRef.current = false;
    setAutoStartCountdown(null);
    setRoom(prev => {
      const nextRoom = {
        ...prev,
        status: 'playing' as const,
        roundNumber: prev.roundNumber + 1
      };
      
      // We wrap the callback to run asynchronously
      setTimeout(() => {
        startNewRound(nextRoom);
      }, 100);

      return nextRoom;
    });
  };

  // Reset entirely
  const handleResetGame = () => {
    playSound('click');
    const resetPlayers = room.players.map(p => ({
      ...p,
      score: 0,
      phase: 1,
      cards: [],
      hasLaidDownThisRound: false,
      isSkipped: false
    }));

    const freshRoom = {
      ...room,
      players: resetPlayers,
      roundNumber: 1,
      status: 'playing' as const,
      winnerId: null,
      laidDownPhases: []
    };

    setLogs([]);
    setChatMessages([]);
    addChatMessage('Sistema', 'system', '#78716c', 'O jogo foi reiniciado.', true);
    startNewRound(freshRoom);
  };

  // ----------------------------------------------------
  // BOT AUTOMATED BRAIN LOOP
  // ----------------------------------------------------
  const executeBotTurn = (bot: Player) => {
    if (room.status !== 'playing') return;

    const preTurnEnd = evaluateRoundEnd(room.players, room.laidDownPhases, {
      drawPile: room.drawPile,
      discardPile: room.discardPile
    });
    if (preTurnEnd) {
      handleRoundEnd(preTurnEnd.winner, preTurnEnd.allAdvance);
      return;
    }

    addLog(`Pensando: Turno de ${bot.name} (IA)...`, 'info');

    const botIsFrozen = isTowerMaster && bot.towerCannotDraw;

    // 1. CHOOSE TO DRAW
    const topDiscard = room.discardPile[room.discardPile.length - 1];
    const shouldDrawDiscard = !botIsFrozen && topDiscard && botShouldDrawFromDiscard(bot, topDiscard);
    
    let currentBotState = { ...bot };

    if (botIsFrozen) {
      addLog(`${bot.name} está congelado e não pode comprar cartas neste turno.`, 'warning');
    } else {
      playSound('draw');

      setRoom(prev => {
        const drawPile = [...prev.drawPile];
        const discardPile = [...prev.discardPile];
        const updatedPlayers = [...prev.players];
        const pIdx = prev.currentTurnIndex;
        const botHand = [...updatedPlayers[pIdx].cards];
        let drawn: Card | undefined;

        if (shouldDrawDiscard && topDiscard) {
          drawn = discardPile.pop();
          addLog(`${bot.name} comprou o descarte.`, 'action');
        } else {
          const recycled = recycleDiscardIntoDrawPile(drawPile, discardPile);
          if (recycled) {
            addLog("O monte de compras esvaziou! Reciclando descarte...", 'warning');
          }
          drawn = drawPile.pop();
          addLog(`${bot.name} comprou do monte.`, 'action');
        }

        if (drawn) {
          botHand.push(drawn);
        }

        currentBotState = { ...updatedPlayers[pIdx], cards: botHand };
        updatedPlayers[pIdx] = currentBotState;

        return {
          ...prev,
          drawPile,
          discardPile,
          players: updatedPlayers
        };
      });
    }

    // Chat random chance
    if (Math.random() < 0.15) {
      setTimeout(() => {
        addChatMessage(bot.name, bot.avatar, bot.color || '#94a3b8', getRandomBotPhrase());
      }, 400);
    }

    // Delay for thinking after drawing
    setTimeout(() => {
      // 2. TRY TO LAY DOWN PHASE
      let didLayDown = false;
      let botGroups: Card[][] | null = null;

      if (!currentBotState.hasLaidDownThisRound) {
        botGroups = botTryToFormPhase(currentBotState);
        if (botGroups) {
          didLayDown = true;
          playSound('laydown');
          addLog(`${bot.name} baixou a fase ${bot.phase}.`, 'success');

          // Trigger chat reaction
          if (Math.random() < 0.3) {
            setTimeout(() => {
              addChatMessage(bot.name, bot.avatar, bot.color || '#94a3b8', "Baixei minha fase! Desafio lançado! 😎");
            }, 600);
          }
        }
      }

      // 3. TRY TO HIT
      let botHitsList: ReturnType<typeof botFindHits> = [];
      let playersAfterAction: Player[] = [];
      let laidDownAfterAction: LaidDownPhase[] = [];

      setRoom(prev => {
        const updatedPlayers = [...prev.players];
        const pIdx = prev.currentTurnIndex;
        let activeBot = { ...updatedPlayers[pIdx] };

        // If bot laid down phase, extract cards
        let updatedLaidDown = [...prev.laidDownPhases];
        if (didLayDown && botGroups) {
          const usedIds = botGroups.flat().map(c => c.id);
          activeBot.cards = activeBot.cards.filter(c => !usedIds.includes(c.id));
          activeBot.hasLaidDownThisRound = true;

          updatedLaidDown.push({
            playerId: activeBot.id,
            playerName: activeBot.name,
            playerColor: activeBot.color || '#a855f7',
            phaseId: activeBot.phase,
            groups: botGroups
          });
        }

        // Search for hit opportunities
        botHitsList = botFindHits(activeBot, updatedLaidDown);
        if (botHitsList.length > 0) {
          botHitsList.forEach(hit => {
            const cardToPlay = activeBot.cards.find(c => c.id === hit.cardId);
            if (cardToPlay) {
              // Add to layout
              updatedLaidDown = updatedLaidDown.map(item => {
                if (item.playerId === hit.targetPlayerId) {
                  const groups = item.groups.map((grp, gIdx) => {
                    if (gIdx === hit.groupIndex) return [...grp, cardToPlay];
                    return grp;
                  });
                  return { ...item, groups };
                }
                return item;
              });

              // Remove from hand
              activeBot.cards = activeBot.cards.filter(c => c.id !== hit.cardId);
              
              const targetPlName = prev.players.find(p => p.id === hit.targetPlayerId)?.name || 'mesa';
              addLog(`${activeBot.name} bateu em ${targetPlName}.`, 'success');
            }
          });
        }

        currentBotState = activeBot;
        updatedPlayers[pIdx] = activeBot;
        playersAfterAction = updatedPlayers;
        laidDownAfterAction = updatedLaidDown;

        return {
          ...prev,
          players: updatedPlayers,
          laidDownPhases: updatedLaidDown
        };
      });

      const endResult = evaluateRoundEnd(playersAfterAction, laidDownAfterAction, {
        drawPile: room.drawPile,
        discardPile: room.discardPile
      });
      if (endResult) {
        handleRoundEnd(endResult.winner, endResult.allAdvance);
        return;
      }

      // 4. CHOOSE DISCARD
      setTimeout(() => {
        const discardCard = botChooseDiscard(currentBotState);
        
        // Execute discard
        let isSkipCard = discardCard.type === 'skip';
        let skippedPlayerId: string | null = null;

        if (isSkipCard) {
          // Find an active human player or opponent bot to skip
          // Sort players to target the opponent with the lowest score, or highest phase
          const opponents = room.players.filter(p => p.id !== bot.id && !p.isSkipped);
          if (opponents.length > 0) {
            // Sort: highest phase first, then lowest score
            const sortedOpponents = [...opponents].sort((a, b) => {
              if (b.phase !== a.phase) return b.phase - a.phase;
              return a.score - b.score;
            });
            skippedPlayerId = sortedOpponents[0].id;
          }
        }

        executeDiscard(discardCard, skippedPlayerId);

      }, room.settings.botDelay * 0.8);

    }, room.settings.botDelay * 0.8);
  };

  // Trigger chat reactions from bots when someone lays down
  const triggerBotChatReaction = (triggerType: 'baixou' | 'curinga') => {
    const activeBots = room.players.filter(p => p.isBot);
    if (activeBots.length === 0) return;

    const chosenBot = activeBots[Math.floor(Math.random() * activeBots.length)];
    const messages = triggerType === 'baixou' 
      ? ["Boa! Já baixou a fase? Tenho que correr!", "Não vale! Que sorte a sua! 😵", "Vou ter que te mandar um Skip logo logo..."]
      : ["Que roubo, esse curinga era meu!", "Aí sim! Parabéns pelo descarte"];
    
    setTimeout(() => {
      addChatMessage(chosenBot.name, chosenBot.avatar, chosenBot.color || '#94a3b8', messages[Math.floor(Math.random() * messages.length)]);
    }, 1500);
  };

  // ----------------------------------------------------
  // HUMAN CHAT CONTROL
  // ----------------------------------------------------
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const senderName = playerProfile.name;
    const senderAvatar = playerProfile.avatar;
    const senderColor = playerProfile.color;

    addChatMessage(senderName, senderAvatar, senderColor, newMessage.trim());
    setNewMessage('');

    // Simulated Bot reactions to chat
    if (room.settings.gameMode === 'bots') {
      const bots = room.players.filter(p => p.isBot);
      if (bots.length > 0 && Math.random() < 0.5) {
        const responder = bots[Math.floor(Math.random() * bots.length)];
        const responses = [
          "Bela mensagem! Vamos ver quem ganha.",
          "Estou concentrado nas minhas trincas aqui... 🤫",
          "Sem papo furado, joga a carta aí!",
          "Haha, boa! 😂",
          "Meu algoritmo diz que eu vou vencer essa rodada.",
          "Alguém descarta um número 12 por favor?",
          "Quem tá na liderança aí?"
        ];
        setTimeout(() => {
          addChatMessage(responder.name, responder.avatar, responder.color || '#94a3b8', responses[Math.floor(Math.random() * responses.length)]);
        }, 1200 + Math.random() * 1000);
      }
    }
  };

  const handleSendPresetMessage = (text: string) => {
    playSound('click');
    const senderName = playerProfile.name;
    const senderAvatar = playerProfile.avatar;
    const senderColor = playerProfile.color;

    addChatMessage(senderName, senderAvatar, senderColor, text);

    if (room.settings.gameMode === 'bots') {
      const bots = room.players.filter(p => p.isBot);
      if (bots.length > 0 && Math.random() < 0.6) {
        const responder = bots[Math.floor(Math.random() * bots.length)];
        setTimeout(() => {
          addChatMessage(responder.name, responder.avatar, responder.color || '#94a3b8', 'Verdade!');
        }, 1000);
      }
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 md:px-4 py-4 select-none">
      
      {/* 1. Header Toolbar */}
      <header className="panel p-4 mb-5 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-surface-raised border border-default px-3 py-1.5 rounded-lg text-secondary font-semibold text-sm">
            {gameTitle}
          </div>
          <div className="bg-accent-soft/40 border border-accent px-3 py-1.5 rounded-lg text-accent font-semibold text-sm">
            Rodada {room.roundNumber}
          </div>
          <div className="text-muted text-xs">
            Sala <span className="text-secondary font-mono tracking-wide">{room.code}</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-3 text-xs bg-app px-3 py-1.5 rounded-lg border border-default">
          <span className="text-muted font-medium">{isTowerMaster ? 'Desafios:' : 'Fases:'}</span>
          <div className="flex gap-2">
            {room.players.map(p => (
              <div key={p.id} className="flex items-center gap-1 border-r border-default pr-2 last:border-0">
                <PlayerAvatar avatar={p.avatar} color={p.color} size={22} isBot={p.isBot} />
                <span className="text-[10px] text-muted truncate max-w-[60px]">{p.name}</span>
                <span className="text-xs font-semibold text-accent">{isTowerMaster ? `D${p.phase}` : `F${p.phase}`}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 hover:bg-surface-raised rounded-lg text-muted hover:text-secondary"
            title={soundEnabled ? 'Mutar' : 'Ativar som'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-accent" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            onClick={() => { playSound('click'); setIsRulesOpen(true); }}
            className="px-3 py-1.5 bg-surface-raised hover:bg-surface-muted rounded-lg text-xs font-medium text-secondary flex items-center gap-1.5 border border-default"
          >
            <Book className="w-4 h-4 text-accent" />
            <span>Regras</span>
          </button>
          <button
            onClick={() => { if (confirm('Sair da partida?')) onExit(); }}
            className="px-3 py-1.5 bg-surface hover:bg-danger-muted border border-default hover:border-danger rounded-lg text-xs font-medium text-danger"
          >
            Sair
          </button>
        </div>
      </header>

      {/* 2. Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 1 mobile / direita desktop — Placar de Líderes */}
        <div className="order-1 lg:col-span-4 lg:col-start-9 lg:row-start-1">
          <div className="bg-surface border border-default rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-secondary flex items-center space-x-1.5">
              <Trophy className="w-4 h-4 text-accent" />
              <span>Placar de Líderes</span>
            </h3>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {[...room.players].sort((a, b) => b.phase - a.phase || a.score - b.score).map((player, idx) => {
                const isActive = room.players[room.currentTurnIndex]?.id === player.id;

                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-accent-soft/30 border-accent shadow-md'
                        : 'bg-surface-muted/60 border-default hover:bg-surface-muted'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="text-xs font-bold text-muted w-4 font-mono">
                        {idx + 1}º
                      </span>
                      <span className="relative">
                        <PlayerAvatar avatar={player.avatar} color={player.color} size={32} isBot={player.isBot} />
                        {player.isSkipped && (
                          <span className="absolute -bottom-1 -right-1 bg-rose-700 border border-default rounded-full w-3.5 h-3.5 flex items-center justify-center" title="Pulado">
                            <Ban className="w-2 h-2 text-white" />
                          </span>
                        )}
                        {player.hasLaidDownThisRound && (
                          <span className="absolute -top-1 -right-1 bg-accent border border-default rounded-full w-3.5 h-3.5 flex items-center justify-center" title={isTowerMaster ? 'Baixou desafio' : 'Baixou fase'}>
                            <Check className="w-2 h-2 text-white" />
                          </span>
                        )}
                      </span>
                      <div className="min-w-0 leading-tight">
                        <div className="text-xs font-extrabold truncate text-secondary" style={{ color: player.color }}>
                          {player.name} {player.isBot && <span className="text-[9px] bg-surface-raised text-muted font-normal px-1 rounded">IA</span>}
                        </div>
                        <div className="text-[10px] text-muted font-semibold uppercase">
                          {player.cards.length} cartas em mãos
                        </div>
                        {isTowerMaster && player.towerCharacterClass && (
                          <TowerCharacterBadge classId={player.towerCharacterClass} compact />
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-accent">{isTowerMaster ? 'DESAFIO' : 'FASE'} {player.phase}</div>
                      <div className="text-[10px] font-semibold text-muted font-mono">{player.score} pts</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2 mobile / esquerda desktop (topo) — Mesa: Fases Baixadas */}
        <div className="order-2 lg:col-span-8 lg:col-start-1 lg:row-start-1">
          <div className="bg-surface border border-default rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-secondary flex items-center justify-between">
              <span>{isTowerMaster ? 'Mesa: Desafios Baixados' : 'Mesa: Fases Baixadas'}</span>
              <span className="text-xs text-muted font-normal normal-case">Clique em uma carta na sua mão e depois clique no botão "Bater" do grupo correspondente.</span>
            </h3>

            {room.laidDownPhases.length === 0 ? (
              <div className="bg-surface-muted rounded-xl p-8 border border-dashed border-default text-center text-muted">
                <p className="text-sm">Nenhum jogador baixou seu {floorWordLower} nesta rodada ainda.</p>
                <p className="text-xs mt-1 text-muted">Seja o primeiro a baixar para começar a bater!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {room.laidDownPhases.map((layout) => {
                  const phaseDef = STANDARD_PHASES.find(p => p.id === layout.phaseId);
                  const groupNames = phaseDef ? identifyGroupTypes(phaseDef.type, layout.groups) : [];

                  return (
                    <div 
                      key={layout.playerId} 
                      className="bg-surface-muted border border-default rounded-xl p-4 space-y-3 shadow-inner"
                      style={{ borderLeft: `4px solid ${layout.playerColor}` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <PlayerAvatar
                            avatar={room.players.find(pl => pl.id === layout.playerId)?.avatar ?? 'crown'}
                            color={layout.playerColor}
                            size={24}
                          />
                          <span className="font-bold text-xs text-secondary">{layout.playerName}</span>
                        </div>
                        <span className="text-[10px] font-black bg-accent-soft/30 border border-accent/30 text-accent px-2 py-0.5 rounded-full">
                          {floorLabel(layout.phaseId)} completo!
                        </span>
                      </div>

                      {/* Display Groups */}
                      <div className="space-y-3">
                        {layout.groups.map((grp, grpIdx) => (
                          <div key={grpIdx} className="bg-surface/60 p-2 rounded-lg border border-default/40 space-y-2">
                            <div className="flex justify-between items-center text-[10px] uppercase font-extrabold text-muted">
                              <span>{groupNames[grpIdx] || `Grupo ${grpIdx + 1}`}</span>
                              <span>{grp.length} cartas</span>
                            </div>

                            {/* Cards list horizontal scrolling */}
                            <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-thin">
                              {grp.map((card) => {
                                const isW = card.type === 'wild';
                                return (
                                  <div
                                    key={card.id}
                                    className="w-8 h-12 shrink-0 rounded-md border border-default/80 bg-surface-muted flex flex-col justify-between p-1 shadow-md"
                                  >
                                    <span className="text-[9px] font-black font-mono leading-none" style={{ color: isW ? '#10b981' : card.color }}>
                                      {isW ? 'W' : card.value}
                                    </span>
                                    <span className="text-[10px] font-black text-center" style={{ color: isW ? '#10b981' : card.color }}>
                                      {isW ? 'W' : card.value}
                                    </span>
                                  </div>
                                );
                              })}

                              {/* Hit button overlay if a card is selected */}
                              {isMyTurn && turnState === 'playing' && selectedHitCard && activePlayer.hasLaidDownThisRound && !isBuildingPhase && (
                                <button
                                  onClick={() => handleHitCard(layout.playerId, grpIdx)}
                                  className="w-10 h-12 btn-primary border border-accent text-on-accent rounded-md shrink-0 flex flex-col items-center justify-center font-bold text-[9px] cursor-pointer shadow-lg transition-transform hover:scale-105 active:scale-95 animate-pulse"
                                >
                                  <CornerRightDown className="w-3.5 h-3.5" />
                                  <span>BATER</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* 3 mobile / esquerda desktop (baixo) — Compra e Monte de Descarte */}
        <div className="order-3 lg:col-span-8 lg:col-start-1 lg:row-start-2">
          <div className="panel-felt p-6 relative overflow-hidden">
            <div className="relative flex flex-col md:flex-row items-center justify-around gap-6">

              {/* Draw Pile Stack */}
              <div className="flex flex-col items-center space-y-2">
                <span className="text-xs uppercase font-medium tracking-wide felt-label">Compra</span>

                <button
                  onClick={() => handleDrawCard('draw')}
                  disabled={!isMyTurn || turnState !== 'drawing' || isActionPending}
                  className={`playing-card playing-card--discard playing-card--deck-back transition-all ${
                    isMyTurn && turnState === 'drawing' && !isActionPending
                      ? 'playing-card--selected border-accent hover:scale-105 active:scale-95 cursor-pointer'
                      : 'cursor-not-allowed opacity-80'
                  }`}
                  aria-label="Comprar do monte"
                >
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-surface-raised/95 text-secondary font-mono text-[10px] px-2 py-0.5 rounded-full z-10 shadow-sm">
                    {room.drawPile.length} restando
                  </span>
                </button>
              </div>

              {/* Discard Pile Stack */}
              <div className="flex flex-col items-center space-y-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-muted">Monte de Descarte</span>

                {room.discardPile.length > 0 ? (
                  (() => {
                    const topDiscard = room.discardPile[room.discardPile.length - 1];
                    const isSkip = topDiscard.type === 'skip';
                    const isPower = isTowerPowerCard(topDiscard);

                    return (
                      <button
                        onClick={() => handleDrawCard('discard')}
                        disabled={!isMyTurn || turnState !== 'drawing' || isSkip || isActionPending}
                        className={`playing-card playing-card--discard flex flex-col justify-between text-left transition-all ${getPlayingCardShellClass(topDiscard)} ${
                          isMyTurn && turnState === 'drawing' && !isSkip && !isActionPending
                            ? 'playing-card--selected border-success hover:scale-105 active:scale-95 cursor-pointer'
                            : 'cursor-not-allowed opacity-80'
                        }`}
                      >
                        {isPower ? (
                          <TowerPowerCardFace card={topDiscard} />
                        ) : (
                          <StandardPlayingCardFace card={topDiscard} centerSize="discard" />
                        )}
                      </button>
                    );
                  })()
                ) : (
                  <div className="w-28 h-40 rounded-2xl border-4 border-dashed border-default flex items-center justify-center text-muted bg-surface-muted">
                    <span className="text-xs uppercase font-bold text-center p-2">Sem descarte</span>
                  </div>
                )}
              </div>

              {/* Action State Prompt Card */}
              <div className="flex-1 max-w-sm bg-surface-muted/80 p-4 rounded-lg border border-default/50 flex flex-col justify-center space-y-2">
                <div className="flex items-center gap-2 text-accent">
                  <Hand className="w-4 h-4 shrink-0" />
                  <span className="text-xs uppercase font-medium tracking-wide">Turno</span>
                </div>

                <div className="text-sm font-medium text-primary flex items-center gap-2">
                  <PlayerAvatar avatar={activePlayer.avatar} color={activePlayer.color} size={28} isBot={activePlayer.isBot} />
                  <span style={{ color: activePlayer.color }}>{activePlayer.name}</span>
                </div>

                <p className="text-xs text-muted leading-relaxed">
                  {turnState === 'drawing' && 'Compre do monte ou do descarte.'}
                  {turnState === 'playing' && `Baixe seu ${floorWordLower}, bata cartas ou descarte para passar o turno.`}
                  {turnState === 'idle' && `Aguardando ${activePlayer.name}...`}
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* 5 mobile / direita desktop (baixo) — Logs e Bate-papo */}
        <div className="order-5 lg:col-span-4 lg:col-start-9 lg:row-start-2">
          <div className="bg-surface border border-default rounded-2xl h-80 flex flex-col shadow-xl overflow-hidden">
            {/* Tabs header */}
            <div className="flex border-b border-default bg-surface-muted p-1">
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex-1 py-2 font-bold text-xs rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  activeTab === 'logs'
                    ? 'bg-surface text-accent'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>Logs do Jogo</span>
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2 font-bold text-xs rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  activeTab === 'chat'
                    ? 'bg-surface text-accent'
                    : 'text-muted hover:text-secondary'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Bate-papo</span>
              </button>
            </div>

            {/* Content Feed */}
            <div className="flex-1 p-3 overflow-y-auto bg-surface-muted/30 text-xs">
              {activeTab === 'logs' ? (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="leading-normal flex space-x-2">
                      <span className="text-[10px] font-semibold font-mono text-muted shrink-0">{log.timestamp}</span>
                      <p className={`
                        ${log.type === 'success' ? 'text-success font-medium' : ''}
                        ${log.type === 'warning' ? 'text-danger font-medium' : ''}
                        ${log.type === 'phase' ? 'text-accent font-semibold uppercase bg-accent-soft/30 px-1.5 py-0.5 rounded border border-accent/30 w-full' : ''}
                        ${log.type === 'action' ? 'text-secondary' : ''}
                        ${log.type === 'info' ? 'text-muted font-normal' : ''}
                      `}>
                        {log.message}
                      </p>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              ) : (
                <div className="space-y-3.5">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-muted py-8 text-xs italic">
                      Nenhuma mensagem enviada. Comece mandando um "Oi"!
                    </div>
                  )}
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col space-y-0.5 ${msg.isSystem ? 'text-center' : ''}`}>
                      {msg.isSystem ? (
                        <div className="bg-surface/60 text-muted text-[10px] py-1 px-2.5 rounded-lg border border-default/80 inline-block mx-auto max-w-[85%]">
                          {msg.message}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 text-[10px] font-medium">
                            <PlayerAvatar avatar={msg.senderAvatar} color={msg.senderColor} size={18} isSystem={msg.isSystem} />
                            <span style={{ color: msg.senderColor }}>{msg.senderName}</span>
                            <span className="text-[9px] font-semibold text-muted font-mono">{msg.timestamp}</span>
                          </div>
                          <div className="bg-surface border border-default/60 p-2 rounded-lg text-secondary wrap-break-word max-w-[95%]">
                            {msg.message}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Chat Input or Preset Quick Words */}
            {activeTab === 'chat' && (
              <div className="p-2 border-t border-default bg-surface-muted flex flex-col space-y-2">
                
                {/* Preset words */}
                <div className="flex gap-1 overflow-x-auto py-0.5 scrollbar-none">
                  {['Eita!', 'Curinga!', 'Boa jogada', 'Quase lá', 'Não me pulem', 'Que azar'].map((word) => (
                    <button
                      key={word}
                      type="button"
                      onClick={() => handleSendPresetMessage(word)}
                      className="px-2 py-1 bg-surface hover:bg-surface-raised border border-default text-[10px] text-secondary font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      {word}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendChatMessage} className="flex space-x-1.5">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite no chat..."
                    className="flex-1 bg-surface border border-default rounded-xl px-3 py-2 text-xs text-secondary outline-none focus:border-accent"
                    maxLength={100}
                  />
                  <button
                    type="submit"
                    className="p-2 btn-primary hover:opacity-90 text-white rounded-lg cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>

        </div>

        {/* 4 mobile / linha completa desktop — Sua Mão */}
        <footer className="order-4 lg:col-span-12 lg:row-start-3 bg-surface border border-default rounded-xl p-4 md:p-5 shadow-lg relative space-y-4">

        {isMyTurn && turnState === 'playing' && isBuildingPhase && (
        <div className="panel border-accent/50 p-5 mb-4 relative">
          <div className="absolute top-2 right-2 text-[10px] bg-accent-soft/50 text-accent font-medium px-2 py-0.5 rounded uppercase">
            Organizador de {floorWord} {activePlayer.phase}
          </div>

          <div className="space-y-4">
            <div className="leading-tight">
              <h4 className="text-sm font-black text-secondary">
                {floorLabel(activePlayer.phase)}: {STANDARD_PHASES.find(p => p.id === activePlayer.phase)?.description}
              </h4>
              <p className="text-xs text-muted">
                {STANDARD_PHASES.find(p => p.id === activePlayer.phase)?.description}
              </p>
            </div>

            {/* Two Building groups */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Build group 1 */}
              <div className="bg-surface-muted p-3 rounded-xl border border-default space-y-2">
                <div className="flex justify-between items-center text-xs font-extrabold text-muted">
                  <span>Grupo 1</span>
                  <span className="text-[10px] font-normal text-muted">Mínimo necessário</span>
                </div>

                <div className="flex flex-wrap gap-1.5 min-h-16 p-2 bg-surface/60 rounded-lg border border-dashed border-default items-center justify-center">
                  {buildGroup1.length === 0 ? (
                    <span className="text-[10px] text-muted uppercase font-bold">Vazio</span>
                  ) : (
                    buildGroup1.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => removeCardFromBuildGroup(c.id, 1)}
                        className="w-10 h-14 rounded-lg bg-surface-muted border border-default p-1 text-center flex flex-col justify-between hover:border-danger hover:text-danger transition-colors cursor-pointer group"
                        title="Remover"
                      >
                        <span className="text-[9px] font-black font-mono leading-none" style={{ color: c.type === 'wild' ? '#10b981' : c.color }}>
                          {c.type === 'wild' ? 'W' : c.value}
                        </span>
                        <span className="text-[9px] font-black group-hover:hidden" style={{ color: c.type === 'wild' ? '#10b981' : c.color }}>
                          {c.type === 'wild' ? 'W' : c.value}
                        </span>
                        <span className="text-[8px] font-bold text-danger hidden group-hover:block w-full">Sair</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Build group 2 (Only render if Phase requires 2 groups) */}
              {['sets_2_3', 'set_3_run_4', 'set_4_run_4', 'sets_2_4', 'set_5_set_2', 'set_5_set_3'].includes(
                STANDARD_PHASES.find(p => p.id === activePlayer.phase)?.type || ''
              ) && (
                <div className="bg-surface-muted p-3 rounded-xl border border-default space-y-2">
                  <div className="flex justify-between items-center text-xs font-extrabold text-muted">
                    <span>Grupo 2</span>
                    <span className="text-[10px] font-normal text-muted">Mínimo necessário</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 min-h-16 p-2 bg-surface/60 rounded-lg border border-dashed border-default items-center justify-center">
                    {buildGroup2.length === 0 ? (
                      <span className="text-[10px] text-muted uppercase font-bold">Vazio</span>
                    ) : (
                      buildGroup2.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => removeCardFromBuildGroup(c.id, 2)}
                          className="w-10 h-14 rounded-lg bg-surface-muted border border-default p-1 text-center flex flex-col justify-between hover:border-danger hover:text-danger transition-colors cursor-pointer group"
                          title="Remover"
                        >
                          <span className="text-[9px] font-black font-mono leading-none" style={{ color: c.type === 'wild' ? '#10b981' : c.color }}>
                            {c.type === 'wild' ? 'W' : c.value}
                          </span>
                          <span className="text-[9px] font-black group-hover:hidden" style={{ color: c.type === 'wild' ? '#10b981' : c.color }}>
                            {c.type === 'wild' ? 'W' : c.value}
                          </span>
                          <span className="text-[8px] font-bold text-danger hidden group-hover:block w-full">Sair</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Validation feedback & laydown trigger */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-default pt-3">
              <div className="flex items-center space-x-2 text-xs">
                {(() => {
                  const check = checkBuilderValidity();
                  return check.isValid ? (
                    <div className="flex items-center space-x-1.5 text-success font-extrabold uppercase bg-success-muted/30 px-3 py-1 rounded-full border border-success/30">
                      <Check className="w-3.5 h-3.5" />
                      <span>Combinação Válida!</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 text-accent font-bold bg-accent-soft/20 px-3 py-1 rounded-full border border-accent/20">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{check.error || "Organizando cartas..."}</span>
                    </div>
                  );
                })()}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    playSound('click');
                    setBuildGroup1([]);
                    setBuildGroup2([]);
                  }}
                  className="px-4 py-2 bg-surface-raised hover:bg-surface-muted text-secondary rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Limpar Grupos
                </button>

                <button
                  onClick={handleLayDownPhase}
                  disabled={!checkBuilderValidity().isValid}
                  className={`flex-1 sm:flex-initial px-6 py-2 rounded-lg text-xs font-semibold uppercase flex items-center justify-center gap-1.5 cursor-pointer ${
                    checkBuilderValidity().isValid
                      ? 'btn-primary'
                      : 'bg-surface-raised text-muted border border-default cursor-not-allowed'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Baixar {floorWordLower} {activePlayer.phase}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
        )}

        {/* Sorting and State Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-default/80 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-bold tracking-wide text-muted">Sua Mão</span>
              <span className="text-[11px] font-semibold bg-surface text-accent/90 border border-default px-2.5 py-0.5 rounded-full">
                {myPlayer.cards.filter((c) => !c.id.startsWith('hidden-')).length} cartas
              </span>
              {isTowerMaster && (
                <span className="text-[11px] font-semibold bg-accent-soft text-accent border border-accent px-2.5 py-0.5 rounded-full">
                  Energia {myPlayer.energy ?? 3}/6
                </span>
              )}
            </div>

            {isMyTurn && turnState === 'playing' && !myPlayer.hasLaidDownThisRound && (
              <button
                onClick={handleToggleBuilder}
                className={`px-3 py-1 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                  isBuildingPhase
                    ? 'bg-danger-muted border-danger text-danger'
                    : 'btn-primary hover:opacity-90 border-accent text-on-accent'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>{isBuildingPhase ? 'Fechar organizador' : `Organizar ${floorWordLower} ${myPlayer.phase}`}</span>
              </button>
            )}
          </div>

          {/* Sorters */}
          {isMyTurn && (
            <div className="flex flex-wrap gap-2 justify-end">
              {turnState === 'playing' && !isBuildingPhase && canActivateClassAbility && (
                <button
                  type="button"
                  onClick={() => void handleUseClassAbility()}
                  className="px-3 py-1 btn-primary font-semibold text-[10px] rounded-md cursor-pointer flex items-center gap-1"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Usar Classe (1/1)</span>
                </button>
              )}

              {turnState === 'playing' && !isBuildingPhase && canOpenAbsorb && (
                <button
                  type="button"
                  onClick={() => {
                    playSound('click');
                    setTowerAbsorbOpen(true);
                  }}
                  className="px-3 py-1 bg-surface-muted hover:bg-surface-raised text-accent font-semibold text-[10px] rounded-md border border-accent/40 cursor-pointer flex items-center gap-1"
                >
                  <BatteryCharging className="w-3 h-3" />
                  <span>Absorver</span>
                </button>
              )}

              {turnState === 'playing' && primarySelectedCard && !isBuildingPhase && (
                <>
                  {isTowerMaster && primarySelectedCard.type === 'power' && !towerPrompt && !towerHandPick && (
                    <button
                      onClick={() => void handleUseTowerPower(primarySelectedCard)}
                      disabled={towerPowersBlocked && primarySelectedCard.powerId !== 'eclipse'}
                      className="px-3 py-1 btn-primary font-semibold text-[10px] rounded-md cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>Usar Poder ({primarySelectedCard.powerCost ?? 0}E)</span>
                    </button>
                  )}

                  {canUseLegendary && !towerLegendarySelected && (
                    <button
                      type="button"
                      onClick={() => void handleUseLegendary()}
                      className="px-3 py-1 btn-primary font-semibold text-[10px] rounded-md cursor-pointer flex items-center gap-1"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>Usar Lendária</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDiscard(primarySelectedCard)}
                    className="px-3 py-1 btn-danger font-semibold text-[10px] rounded-md cursor-pointer flex items-center gap-1"
                  >
                    {primarySelectedCard.type === 'skip' ? (
                      <><Ban className="w-3 h-3" /> Pular</>
                    ) : (
                      <><Trash2 className="w-3 h-3" /> Descartar</>
                    )}
                  </button>
                </>
              )}

              {isBuildingPhase && selectedCards.length > 0 && (
                <>
                  <button
                    onClick={() => addCardsToBuildGroup(selectedCards, 1)}
                    className="px-3 py-1 btn-primary font-semibold text-[10px] rounded-md cursor-pointer"
                  >
                    {selectedCards.length > 1
                      ? `Grupo 1 (${selectedCards.length})`
                      : 'Grupo 1'}
                  </button>

                  {['sets_2_3', 'set_3_run_4', 'set_4_run_4', 'sets_2_4', 'set_5_set_2', 'set_5_set_3'].includes(
                    STANDARD_PHASES.find(p => p.id === myPlayer.phase)?.type || ''
                  ) && (
                    <button
                      onClick={() => addCardsToBuildGroup(selectedCards, 2)}
                      className="px-3 py-1 bg-surface-muted hover:bg-surface-raised text-primary font-semibold text-[10px] rounded-md border border-default cursor-pointer"
                    >
                      {selectedCards.length > 1
                        ? `Grupo 2 (${selectedCards.length})`
                        : 'Grupo 2'}
                    </button>
                  )}
                </>
              )}

              <button
                onClick={() => sortHand('value')}
                className={`px-3 py-1 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer flex items-center space-x-1 ${
                  handSortMode === 'value'
                    ? 'bg-accent-soft border-accent text-accent'
                    : 'bg-surface hover:bg-surface-raised text-secondary hover:text-primary border-default'
                }`}
              >
                <span>123</span>
                <span>Ordenar Valor</span>
              </button>
              <button
                onClick={() => sortHand('color')}
                className={`px-3 py-1 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer flex items-center space-x-1 ${
                  handSortMode === 'color'
                    ? 'bg-accent-soft border-accent text-accent'
                    : 'bg-surface hover:bg-surface-raised text-secondary hover:text-primary border-default'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                <span className="w-2 h-2 rounded-full bg-accent shrink-0 -ml-1" />
                <span>Ordenar Cor</span>
              </button>
            </div>
          )}
        </div>

        {/* Hand Cards Render */}
        {!isOnline && !isMyTurn ? (
          <div className="h-44 bg-surface-muted/60 rounded-xl border border-dashed border-default flex flex-col items-center justify-center text-muted text-sm">
            <User className="w-7 h-7 text-muted mb-2" />
            <p className="font-medium text-xs text-muted">Aguardando sua vez...</p>
            <p className="text-[10px] text-muted mt-1">Suas cartas aparecem aqui no seu turno.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {towerHandPick && (
              <div className="tower-hand-pick-banner">
                <div className="tower-hand-pick-banner__text">
                  <p className="tower-hand-pick-banner__title">{towerHandPick.title}</p>
                  {towerHandPick.subtitle && (
                    <p className="tower-hand-pick-banner__subtitle">{towerHandPick.subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => resolveHandPick(null)}
                  className="tower-hand-pick-banner__cancel"
                >
                  Cancelar
                </button>
              </div>
            )}

          <div className={isTowerMaster ? 'tower-hand-layout' : 'space-y-4'}>
            {isTowerMaster && (
              <aside className="tower-hand-side tower-hand-side--info">
                <p className="tower-hand-side__label">Carta Selecionada</p>
                {inspectedCardInfo ? (
                  <>
                    <h4 className="tower-hand-side__title">{inspectedCardInfo.name}</h4>
                    {towerClassSelected && myPlayer.towerCharacterClass ? (
                      <TowerClassPreview classId={myPlayer.towerCharacterClass} />
                    ) : towerLegendarySelected && myPlayer.towerLegendaryId ? (
                      <TowerLegendaryPreview legendaryId={myPlayer.towerLegendaryId} />
                    ) : inspectedCard ? (
                      <TowerInspectedCardPreview card={inspectedCard} />
                    ) : null}
                    <p className="tower-hand-side__desc">{inspectedCardInfo.description}</p>
                    {canUseClassAbility && (
                      <button
                        type="button"
                        onClick={() => void handleUseClassAbility()}
                        className="mt-2 w-full px-3 py-2 btn-primary font-semibold text-[10px] rounded-md cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Usar Classe (1/1)</span>
                      </button>
                    )}
                    {canUseLegendary && (
                      <button
                        type="button"
                        onClick={() => void handleUseLegendary()}
                        className="mt-2 w-full px-3 py-2 btn-primary font-semibold text-[10px] rounded-md cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Usar Lendária (1/1)</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <h4 className="tower-hand-side__title text-muted">Nenhuma</h4>
                    <p className="tower-hand-side__desc">
                      Toque em uma carta da mão para ver o nome, a imagem e a explicação do efeito.
                    </p>
                  </>
                )}
              </aside>
            )}

            {/* Cards fan layout */}
            <div className={`hand-fan${compactHand ? ' hand-fan--stack' : ''}${isTowerMaster ? ' hand-fan--in-layout' : ''}`}>
              {(() => {
                const rawCards = myPlayer.cards.filter((c) => !c.id.startsWith('hidden-'));
                const visibleCards = handSortMode
                  ? sortHandCards(rawCards, handSortMode)
                  : rawCards;
                const total = visibleCards.length;
                const fanOptions = compactHand ? { mode: 'stack' as const } : undefined;
                const fanWidth = getHandFanSpreadWidth(total, fanOptions);
                return (
              <div
                className="hand-fan__pivot"
                style={{ ['--fan-width' as string]: `${fanWidth}px` }}
              >
              {visibleCards.map((card, index) => {
                const isSelected = selectedCards.some((c) => c.id === card.id);
                const isInGroup1 = buildGroup1.some(c => c.id === card.id);
                const isInGroup2 = buildGroup2.some(c => c.id === card.id);
                const isPower = isTowerPowerCard(card);
                const { translateX, rotate, zIndex } = getHandFanLayout(index, total, fanOptions);
                const selectedDirection = index < (total - 1) / 2 ? -1 : 1;
                const selectedSpreadX = !compactHand && isSelected ? selectedDirection * 18 : 0;
                const selectedLift = isSelected ? (compactHand ? '-2rem' : '-1.75rem') : '0px';

                const isHandPickEligible = towerHandPick?.eligibleIds.has(card.id) ?? false;
                const isHandPickBlocked = !!towerHandPick && !isHandPickEligible;

                return (
                  <button
                    key={card.id}
                    disabled={!towerHandPick && !isMyTurn}
                    onClick={() => handleHandCardClick(card)}
                    className={`hand-fan__card playing-card text-left ${getPlayingCardShellClass(card)} ${isSelected ? 'playing-card--selected' : ''} ${
                      isInGroup1 || isInGroup2 ? 'playing-card--in-group' : ''
                    } ${isHandPickEligible ? 'playing-card--hand-pick' : ''} ${
                      isHandPickBlocked ? 'playing-card--hand-pick-blocked' : ''
                    }`}
                    style={{
                      zIndex,
                      ['--fan-x' as string]: `${translateX + selectedSpreadX}px`,
                      ['--fan-rot' as string]: `${rotate}deg`,
                      ['--fan-y' as string]: selectedLift,
                    }}
                  >
                    {isPower ? (
                      <TowerPowerCardFace card={card} />
                    ) : (
                      <StandardPlayingCardFace
                        card={card}
                        bottomExtra={
                          <>
                            {isInGroup1 && (
                              <span className="text-[10px] bg-accent-soft/40 border border-accent/50 text-accent px-1 rounded uppercase font-bold">G1</span>
                            )}
                            {isInGroup2 && (
                              <span className="text-[10px] bg-accent-soft/40 border border-accent/50 text-accent px-1 rounded uppercase font-bold">G2</span>
                            )}
                            {!isInGroup1 && !isInGroup2 && <span />}
                          </>
                        }
                      />
                    )}
                  </button>
                );
              })}
              </div>
                );
              })()}
            </div>

            {isTowerMaster && (characterClassInfo || legendaryInfo) && (
              <aside className="tower-hand-side tower-hand-side--abilities">
                {characterClassInfo && (
                  <div className="tower-ability-slot">
                    <p className="tower-hand-side__label">Classe</p>
                    <button
                      type="button"
                      disabled={myPlayer.towerClassAbilityUsedThisRound}
                      onClick={handleClassClick}
                      className={`tower-legendary-card-btn${towerClassSelected ? ' tower-legendary-card-btn--selected' : ''}${myPlayer.towerClassAbilityUsedThisRound ? ' tower-legendary-card-btn--used' : ''}`}
                    >
                      <div className={`playing-card playing-card--tower playing-card--tower-legendary tower-legendary-card tower-class-card${myPlayer.towerClassAbilityUsedThisRound ? ' tower-legendary-card--used' : ''}`}>
                        <div className="playing-card__power-art">
                          <img src={characterClassInfo.imageSrc} alt="" draggable={false} />
                        </div>
                        <div className="playing-card__power-name">{characterClassInfo.name}</div>
                      </div>
                    </button>
                    <p className="tower-hand-side__usage">
                      {myPlayer.towerClassAbilityUsedThisRound ? '0/1' : '1/1'}
                    </p>
                    <p className="tower-hand-side__usage-hint">
                      {myPlayer.towerClassAbilityUsedThisRound
                        ? 'Usada nesta rodada'
                        : 'Disponível nesta rodada'}
                    </p>
                  </div>
                )}

                {legendaryInfo && (
                  <div className="tower-ability-slot">
                    <p className="tower-hand-side__label">Lendária</p>
                    <button
                      type="button"
                      disabled={myPlayer.towerLegendaryUsedThisRound}
                      onClick={handleLegendaryClick}
                      className={`tower-legendary-card-btn${towerLegendarySelected ? ' tower-legendary-card-btn--selected' : ''}${myPlayer.towerLegendaryUsedThisRound ? ' tower-legendary-card-btn--used' : ''}`}
                    >
                      <div className={`playing-card playing-card--tower playing-card--tower-legendary tower-legendary-card${myPlayer.towerLegendaryUsedThisRound ? ' tower-legendary-card--used' : ''}`}>
                        <div className="playing-card__power-art">
                          <img src={legendaryInfo.imageSrc} alt="" draggable={false} />
                        </div>
                        <div className="playing-card__power-name">{legendaryInfo.name}</div>
                      </div>
                    </button>
                    <p className="tower-hand-side__usage">
                      {myPlayer.towerLegendaryUsedThisRound ? '0/1' : '1/1'}
                    </p>
                    <p className="tower-hand-side__usage-hint">
                      {myPlayer.towerLegendaryUsedThisRound
                        ? 'Usada nesta rodada'
                        : 'Disponível nesta rodada'}
                    </p>
                  </div>
                )}
              </aside>
            )}

          </div>
          </div>
        )}
      </footer>

      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {characterSelectPlayer && (
        <TowerCharacterSelect
          player={characterSelectPlayer}
          onSelect={handleCharacterClassPick}
          subtitle={
            room.settings.gameMode === 'pass_and_play'
              ? 'Passe o dispositivo apenas para este jogador escolher a classe.'
              : undefined
          }
        />
      )}

      {towerPrompt && (
        <TowerPromptModal
          prompt={towerPrompt}
          onSelectPlayer={(player) => resolveTowerPrompt(player)}
          onSelectColor={(color) => resolveTowerPrompt(color)}
          onSelectDiscard={(discardCard) => resolveTowerPrompt(discardCard)}
          onCancel={cancelTowerPrompt}
        />
      )}

      {towerAbsorbOpen && (
        <TowerAbsorbModal
          cards={absorbableHandCards}
          currentEnergy={myPlayer.energy ?? 3}
          onConfirm={handleAbsorbConfirm}
          onCancel={() => setTowerAbsorbOpen(false)}
        />
      )}

      {towerReveal && (
        <TowerRevealModal
          reveal={towerReveal}
          onClose={() => setTowerReveal(null)}
        />
      )}

      {/* SKIP SELECTOR MODAL TARGET */}
      {showSkipSelector && skipCardPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-default rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-danger-muted border border-danger text-danger rounded-full flex items-center justify-center mx-auto">
              <Ban className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-primary">Selecione quem pular</h3>
              <p className="text-xs text-muted">Você descartou um Skip! Escolha um dos adversários para pular o turno na próxima rodada.</p>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {room.players
                .filter(p => p.id !== activePlayer.id) // cannot skip self
                .map((player) => (
                  <button
                    key={player.id}
                    onClick={() => executeDiscard(skipCardPending, player.id)}
                    className="w-full p-3 rounded-xl bg-surface-muted hover:bg-surface-raised text-secondary hover:text-primary flex items-center justify-between border border-default/80 transition-colors cursor-pointer text-xs font-bold"
                  >
                    <div className="flex items-center space-x-2">
                      <PlayerAvatar avatar={player.avatar} color={player.color} size={22} isBot={player.isBot} />
                      <span style={{ color: player.color }}>{player.name}</span>
                      {player.isBot && <span className="text-[10px] text-muted font-normal">(IA)</span>}
                    </div>

                    <div className="text-muted font-mono text-[10px]">
                      {floorLabel(player.phase)} • {player.score} pts
                    </div>
                  </button>
                ))}
            </div>

            <button
              onClick={() => {
                playSound('click');
                setSkipCardPending(null);
                setShowSkipSelector(false);
              }}
              className="w-full py-2 bg-surface-raised hover:bg-surface-muted text-secondary rounded-lg text-xs font-bold cursor-pointer"
            >
              Cancelar Descarte
            </button>
          </div>
        </div>
      )}

      {/* 6. ROUND OVER DISPLAY SCREEN overlay */}
      {room.status === 'round_end' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-surface border border-default rounded-2xl p-6 shadow-2xl space-y-6 my-8">
            
            <div className="text-center space-y-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-accent-soft/30 border border-accent/20 rounded-full text-accent text-xs font-extrabold">
                <Award className="w-4 h-4" />
                <span>RODADA ENCERRADA!</span>
              </div>
              <h2 className="text-3xl font-black text-primary tracking-tight uppercase">
                Resultados da Rodada {room.roundNumber}
              </h2>
              <p className="text-xs text-muted">
                {roundEndReason === 'all_laid_down'
                  ? isTowerMaster
                    ? 'Todos os jogadores baixaram seus desafios — todos avançam para o próximo desafio!'
                    : 'Todos os jogadores baixaram suas fases — todos avançam para a próxima fase!'
                  : isTowerMaster
                    ? 'Um jogador ficou sem cartas — apenas quem baixou o desafio avança.'
                    : 'Um jogador ficou sem cartas — apenas quem baixou a fase avança.'}
              </p>
              {autoStartCountdown !== null && autoStartCountdown > 0 && (
                <p className="text-[11px] text-accent font-semibold">
                  {isOnline && !onlineSession?.isHost
                    ? 'Aguardando o host iniciar a próxima rodada…'
                    : `Nova rodada em ${autoStartCountdown}s…`}
                </p>
              )}
            </div>

            {/* Results Table */}
            <div className="divide-y divide-default bg-surface-muted rounded-xl p-4 border border-default">
              {room.players.map((player) => {
                const hadLaidDown = room.laidDownPhases.some(l => l.playerId === player.id) || player.hasLaidDownThisRound;
                
                return (
                  <div key={player.id} className="py-3 flex flex-wrap gap-4 items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 min-w-[180px]">
                      <PlayerAvatar avatar={player.avatar} color={player.color} size={32} isBot={player.isBot} />
                      <div>
                        <span className="font-extrabold text-secondary block" style={{ color: player.color }}>
                          {player.name}
                        </span>
                        <span className="text-[10px] text-muted">
                          {player.isBot ? 'Jogador Bot (IA)' : 'Jogador Humano'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-8">
                      {/* Phase outcome */}
                      <div className="text-center">
                        <div className="text-[10px] uppercase font-bold text-muted mb-0.5">
                          {isTowerMaster ? 'Status do Desafio' : 'Status da Fase'}
                        </div>
                        {hadLaidDown ? (
                          <span className="text-[10px] bg-success-muted/40 border border-success/30 text-success px-2 py-0.5 rounded-full font-bold">
                            Completo! ➔ Ir para {isTowerMaster ? `D${player.phase}` : `F${player.phase}`}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-danger-muted/40 border border-danger/30 text-danger px-2 py-0.5 rounded-full font-bold">
                            Falhou ➔ Mantém {isTowerMaster ? `D${player.phase}` : `F${player.phase}`}
                          </span>
                        )}
                      </div>

                      {/* Cumulative Score */}
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-muted mb-0.5">Pontuação Total</div>
                        <span className="font-black text-primary font-mono text-sm">{player.score} pts</span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Call to action */}
            <div className="flex gap-3 justify-end">
              {!isOnline && (
                <button
                  onClick={handleResetGame}
                  className="px-4 py-2 bg-surface-raised hover:bg-surface-muted text-secondary font-bold text-xs rounded-xl cursor-pointer"
                >
                  Reiniciar Todo Jogo
                </button>
              )}

              <button
                onClick={handleNextRound}
                disabled={(isOnline && !onlineSession?.isHost) || isActionPending}
                className={`px-8 py-3 rounded-xl font-black text-sm tracking-wide flex items-center space-x-2 transition-transform cursor-pointer ${
                  isOnline && !onlineSession?.isHost
                    ? 'bg-surface-raised text-muted cursor-not-allowed'
                    : 'btn-primary hover:opacity-90'
                }`}
              >
                <span>
                  {isOnline && !onlineSession?.isHost
                    ? 'AGUARDANDO HOST'
                    : `INICIAR RODADA ${room.roundNumber + 1}`}
                </span>
                {(!isOnline || onlineSession?.isHost) && (
                  <ArrowRight className="w-4 h-4 text-on-accent" />
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 7. GAME OVER CELEBRATION MODAL overlay */}
      {room.status === 'game_over' && room.winnerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-md p-4">
          <div className="w-full max-w-md panel p-8 text-center space-y-6 relative overflow-hidden">
            {(() => {
              const champion = room.players.find(p => p.id === room.winnerId);
              if (!champion) return null;

              return (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-full bg-accent-soft border border-accent flex items-center justify-center mx-auto">
                    <Trophy className="w-8 h-8 text-accent" />
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-semibold tracking-wide text-accent">Campeão</p>
                    <h2 className="text-2xl font-bold" style={{ color: champion.color }}>
                      {champion.name}
                    </h2>
                  </div>

                  <div className="inline-flex items-center gap-1 px-4 py-1.5 bg-accent-soft/50 border border-accent text-accent font-medium rounded-full text-xs">
                    <span>{isTowerMaster ? `Desafio 10 — ${champion.score} pts` : `Fase 10 — ${champion.score} pts`}</span>
                  </div>

                  <p className="text-xs text-muted leading-relaxed px-2">
                    {isTowerMaster
                      ? `${champion.name} completou os 10 desafios com a menor pontuação.`
                      : `${champion.name} completou as 10 fases com a menor pontuação.`}
                  </p>
                </div>
              );
            })()}

            {/* Ranked summary list */}
            <div className="bg-surface-muted p-4 rounded-xl border border-default text-xs text-left divide-y divide-default">
              <p className="text-[10px] uppercase font-bold text-muted pb-2">Classificação Final</p>
              {[...room.players].sort((a, b) => b.phase - a.phase || a.score - b.score).map((player, idx) => (
                <div key={player.id} className="py-2 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-muted">{idx + 1}º</span>
                    <PlayerAvatar avatar={player.avatar} color={player.color} size={22} isBot={player.isBot} />
                    <span className="font-bold" style={{ color: player.color }}>{player.name}</span>
                  </div>
                  <div className="text-muted font-mono">{floorLabel(player.phase)} ({player.score} pts)</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onExit}
                className="flex-1 py-3 bg-surface-raised hover:bg-surface-muted text-secondary font-bold text-xs rounded-xl cursor-pointer"
              >
                Voltar ao Menu
              </button>
              
              <button
                onClick={handleResetGame}
                className="flex-1 py-3 btn-primary font-extrabold text-xs tracking-wider cursor-pointer"
              >
                JOGAR NOVAMENTE
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 8. PASS AND PLAY INTERACTIVE TRANSITION OVERLAY */}
      {showTransition && transitionPlayer && (
        <PassAndPlayTransition 
          player={transitionPlayer} 
          onConfirm={handleTransitionConfirm}
          useFloorTerminology={isTowerMaster}
        />
      )}

      {/* 9. RULE BOOK MODAL */}
      <RulesModal 
        isOpen={isRulesOpen} 
        onClose={() => setIsRulesOpen(false)} 
      />

    </div>
  );
};
