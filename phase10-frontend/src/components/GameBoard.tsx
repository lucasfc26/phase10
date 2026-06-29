import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Book, Send, MessageSquare, ListTodo, 
  Check, ArrowRight, CornerRightDown,
  Sparkles, Award, User, AlertCircle, Volume2, VolumeX
} from 'lucide-react';
import { 
  Card, Player, GameRoom, LaidDownPhase, GameLog, ChatMessage, STANDARD_PHASES 
} from '../types';
import { 
  generateDeck, shuffleDeck, calculateHandScore, validatePhase, 
  identifyGroupTypes, isValidHit, botShouldDrawFromDiscard, 
  botTryToFormPhase, botChooseDiscard, botFindHits, getRandomBotPhrase, generateId,
  evaluateRoundEnd, advanceToNextPlayer
} from '../gameEngine';
import { RulesModal } from './RulesModal';
import { PassAndPlayTransition } from './PassAndPlayTransition';
import { RoomSession } from '../services/onlineApi';
import { connectOnlineSocket, emitGameAction, getRoomDeletedMessage } from '../services/onlineSocket';

interface GameBoardProps {
  initialRoom: GameRoom;
  playerProfile: { name: string; avatar: string; color: string };
  onlineSession?: RoomSession | null;
  onExit: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ initialRoom, playerProfile, onlineSession, onExit }) => {
  const [room, setRoom] = useState<GameRoom>(initialRoom);
  const isOnline = !!onlineSession;
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'logs' | 'chat'>('logs');
  
  // Rules modal state
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  
  // Audio state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

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
  const primarySelectedCard = selectedCards.length === 1 ? selectedCards[0] : null;
  const selectedHitCard = selectedCards.length > 0 ? selectedCards[0] : null;

  const clearCardSelection = () => setSelectedCards([]);

  // Skip selector target modal
  const [skipCardPending, setSkipCardPending] = useState<Card | null>(null);
  const [showSkipSelector, setShowSkipSelector] = useState<boolean>(false);

  // How the current round ended (for results screen messaging)
  const [roundEndReason, setRoundEndReason] = useState<'go_out' | 'all_laid_down'>('go_out');
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null);
  const roundEndHandledRef = useRef(false);

  // Sound generator
  const playSound = (type: 'draw' | 'discard' | 'laydown' | 'skip' | 'win' | 'click') => {
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

  // Helper for scroll references
  const logEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
  };

  const handleOnlineActionResult = (result: { ok?: boolean; error?: string; room?: GameRoom }) => {
    if (result?.error) {
      alert(result.error);
      return false;
    }
    if (result?.room) applyOnlineGameState(result.room);
    return true;
  };

  // ----------------------------------------------------
  // GAME STARTER (SETUP PILES, DEAL CARDS)
  // ----------------------------------------------------
  const startNewRound = (currentRoom: GameRoom) => {
    addLog(`--- Rodada ${currentRoom.roundNumber} Iniciando ---`, 'phase');
    
    // Create new clean deck
    const freshDeck = generateDeck();
    const shuffled = shuffleDeck(freshDeck);
    
    // Deal 10 cards to each player
    const updatedPlayers = currentRoom.players.map(player => {
      const hand: Card[] = [];
      for (let i = 0; i < 10; i++) {
        const card = shuffled.pop();
        if (card) hand.push(card);
      }
      return {
        ...player,
        cards: hand.sort((a, b) => a.value - b.value), // sort by value initially
        hasLaidDownThisRound: false,
        isSkipped: false
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

    const nextRoomState: GameRoom = {
      ...currentRoom,
      status: 'playing',
      players: updatedPlayers,
      drawPile: shuffled,
      discardPile,
      laidDownPhases: [],
      currentTurnIndex: 0 // Reset to host
    };

    setRoom(nextRoomState);

    roundEndHandledRef.current = false;

    // Announce current phases
    updatedPlayers.forEach(p => {
      addLog(`${p.avatar} ${p.name} está buscando a Fase ${p.phase}.`, 'info');
    });

    // Setup first turn
    const firstPlayer = updatedPlayers[0];
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
      connectOnlineSocket(onlineSession.sessionToken, {
        onGameState: (state) => applyOnlineGameState(state),
        onGameLog: (log) => {
          setLogs((prev) => [...prev, log]);
        },
        onRoomDeleted: (payload) => {
          alert(getRoomDeletedMessage(payload.reason));
          onExit();
        },
      });
      return;
    }

    roundEndHandledRef.current = false;
    startNewRound(initialRoom);
    addChatMessage('Sistema', '🤖', '#64748b', 'Bem-vindo ao Phase 10! Sala criada com sucesso.', true);
  }, []);

  // ----------------------------------------------------
  // GETTERS & HELPERS
  // ----------------------------------------------------
  const activePlayer = room.players[room.currentTurnIndex];
  const myPlayer =
    (isOnline
      ? room.players.find((p) => p.id === onlineSession?.memberId)
      : activePlayer) || activePlayer;
  
  const isMyTurn = isOnline
    ? room.players[room.currentTurnIndex]?.id === onlineSession?.memberId && !showTransition
    : activePlayer && !activePlayer.isBot && !showTransition;

  // Sincroniza turno no modo online quando o servidor atualiza currentTurnIndex
  useEffect(() => {
    if (!isOnline || !onlineSession || room.status !== 'playing') return;

    const active = room.players[room.currentTurnIndex];
    if (!active) return;

    if (active.id === onlineSession.memberId && !active.isSkipped) {
      setTurnState((prev) => {
        if (room.hasDrawnThisTurn) return 'playing';
        return prev === 'playing' ? 'playing' : 'drawing';
      });
    } else {
      setIsBuildingPhase(false);
      setBuildGroup1([]);
      setBuildGroup2([]);
      setSelectedCards([]);
      setTurnState('idle');
    }
  }, [isOnline, onlineSession?.memberId, room.currentTurnIndex, room.status, room.players, room.hasDrawnThisTurn]);

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

  // Auto-sort hand
  const sortHand = (mode: 'value' | 'color') => {
    playSound('click');
    setRoom(prev => {
      const updatedPlayers = [...prev.players];
      const playerIndex = isOnline
        ? updatedPlayers.findIndex((p) => p.id === onlineSession?.memberId)
        : prev.currentTurnIndex;
      if (playerIndex < 0) return prev;
      const playerHand = [...updatedPlayers[playerIndex].cards];

      if (mode === 'value') {
        playerHand.sort((a, b) => {
          // Sort wild cards to the end
          if (a.type === 'wild' && b.type !== 'wild') return 1;
          if (b.type === 'wild' && a.type !== 'wild') return -1;
          if (a.type === 'skip' && b.type !== 'skip') return 1;
          if (b.type === 'skip' && a.type !== 'skip') return -1;
          return a.value - b.value;
        });
      } else {
        playerHand.sort((a, b) => {
          if (a.color === b.color) return a.value - b.value;
          return a.color.localeCompare(b.color);
        });
      }

      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        cards: playerHand
      };

      return {
        ...prev,
        players: updatedPlayers
      };
    });
  };

  // ----------------------------------------------------
  // CORE CARD ACTIONS (DRAW, DISCARD, LAY DOWN, HIT)
  // ----------------------------------------------------

  // Draw card from draw pile or discard pile
  const handleDrawCard = (source: 'draw' | 'discard') => {
    if (!isMyTurn || turnState !== 'drawing' || activePlayer?.isSkipped) return;

    if (isOnline) {
      emitGameAction({ type: 'draw', source }, (result) => {
        if (result?.error) {
          alert(result.error);
          return;
        }
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
        // If draw pile is empty, recycle discard pile!
        if (drawPile.length === 0) {
          addLog("O monte de compras esvaziou! Reciclando descarte...", 'warning');
          const topDiscard = discardPile.pop();
          const newDraw = shuffleDeck([...discardPile]);
          discardPile.length = 0;
          if (topDiscard) discardPile.push(topDiscard);
          drawPile.push(...newDraw);
        }
        drawnCard = drawPile.pop();
        addLog(`${activePlayer.avatar} ${activePlayer.name} comprou do monte.`, 'action');
      } else {
        drawnCard = discardPile.pop();
        addLog(`${activePlayer.avatar} ${activePlayer.name} comprou o descarte (${drawnCard?.type === 'wild' ? 'Curinga' : drawnCard?.type === 'skip' ? 'Skip' : drawnCard?.value + ' ' + drawnCard?.color}).`, 'action');
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
    setSelectedCards([]);
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
      emitGameAction({
        type: 'discard',
        cardId: card.id,
        skipPlayerId: skipPlayerId || undefined,
      }, (result) => {
        if (result?.error) {
          alert(result.error);
          return;
        }
        setIsBuildingPhase(false);
        setBuildGroup1([]);
        setBuildGroup2([]);
        setSelectedCards([]);
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
    setSelectedCards([]);

    let roundEndResult: ReturnType<typeof evaluateRoundEnd> = null;

    setRoom(prev => {
      const updatedPlayers = prev.players.map((p, idx) => {
        if (idx === prev.currentTurnIndex) {
          const newHand = p.cards.filter(c => c.id !== card.id);
          return { ...p, cards: newHand };
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

      const advanced = advanceToNextPlayer(updatedPlayers, prev.currentTurnIndex);
      advanced.skippedPlayers.forEach((skipped) => {
        addLog(`🚫 ${skipped.avatar} ${skipped.name} foi pulado!`, 'warning');
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
      addLog(`${activePlayer.avatar} ${activePlayer.name} descartou Skip e pulou ${skippedUser?.avatar} ${skippedUser?.name}! 🚫`, 'warning');
      playSound('skip');
    } else {
      const cardDesc = card.type === 'wild' ? 'Curinga' : `${card.value} (${card.color})`;
      addLog(`${activePlayer.avatar} ${activePlayer.name} descartou ${cardDesc}.`, 'action');
    }

    if (skipCardPending) {
      setSkipCardPending(null);
      setShowSkipSelector(false);
    }

    if (roundEndResult) {
      handleRoundEnd(roundEndResult.winner, roundEndResult.allAdvance);
    } else {
      setTurnState('idle');
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
    if (!currentPlayer || currentPlayer.isSkipped) return;

    if (room.settings.gameMode === 'pass_and_play' && !isOnline) {
      // In local multiplayer, show the overlay transition screen
      setTransitionPlayer(currentPlayer);
      setShowTransition(true);
    } else {
      // VS Bots mode (not online)
      if (!currentPlayer.isBot) {
        setTurnState('drawing');
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
    setTurnState('drawing');
    addLog(`Vez de ${activePlayer.name}!`, 'action');
  };

  // ----------------------------------------------------
  // LAY DOWN PHASE BUILDER INTERACTIONS
  // ----------------------------------------------------
  const handleToggleBuilder = () => {
    playSound('click');
    setIsBuildingPhase((prev) => {
      if (prev) {
        setBuildGroup1([]);
        setBuildGroup2([]);
        clearCardSelection();
      }
      return !prev;
    });
  };

  const addCardsToBuildGroup = (cards: Card[], groupNum: 1 | 2) => {
    if (cards.length === 0) return;
    playSound('click');
    const incomingIds = new Set(cards.map((c) => c.id));

    if (groupNum === 1) {
      setBuildGroup2((prev) => prev.filter((c) => !incomingIds.has(c.id)));
      setBuildGroup1((prev) => {
        const existing = new Set(prev.map((c) => c.id));
        return [...prev, ...cards.filter((c) => !existing.has(c.id))];
      });
    } else {
      setBuildGroup1((prev) => prev.filter((c) => !incomingIds.has(c.id)));
      setBuildGroup2((prev) => {
        const existing = new Set(prev.map((c) => c.id));
        return [...prev, ...cards.filter((c) => !existing.has(c.id))];
      });
    }
    clearCardSelection();
  };

  const addCardToBuildGroup = (card: Card, groupNum: 1 | 2) => {
    addCardsToBuildGroup([card], groupNum);
  };

  const handleHandCardClick = (card: Card) => {
    if (!isMyTurn) return;
    playSound('click');

    if (isBuildingPhase) {
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
    const check = checkBuilderValidity();
    if (!check.isValid) {
      alert(check.error || "Fase inválida!");
      return;
    }

    const layDownPlayer = isOnline ? myPlayer : activePlayer;
    const group1Ids = buildGroup1.map((c) => c.id);
    const group2Ids = buildGroup2.map((c) => c.id);

    if (isOnline) {
      emitGameAction(
        {
          type: 'lay_down',
          group1CardIds: group1Ids,
          group2CardIds: group2Ids,
        },
        (result) => {
          if (!handleOnlineActionResult(result)) return;
          playSound('laydown');
          setIsBuildingPhase(false);
          setBuildGroup1([]);
          setBuildGroup2([]);
          clearCardSelection();
        },
      );
      return;
    }

    playSound('laydown');

    const groups = [buildGroup1, buildGroup2].filter((g) => g.length > 0);

    let playersAfterLayDown: Player[] = [];
    let laidDownAfterLayDown: LaidDownPhase[] = [];

    setRoom((prev) => {
      const playerIdx = prev.players.findIndex((p) => p.id === layDownPlayer.id);
      if (playerIdx < 0) return prev;

      const allUsedIds = [...group1Ids, ...group2Ids];
      const updatedPlayers = prev.players.map((p, idx) => {
        if (idx !== playerIdx) return p;
        return {
          ...p,
          cards: p.cards.filter((c) => !allUsedIds.includes(c.id)),
          hasLaidDownThisRound: true,
        };
      });

      const newLaidDown: LaidDownPhase = {
        playerId: layDownPlayer.id,
        playerName: layDownPlayer.name,
        playerColor: layDownPlayer.color || '#a855f7',
        phaseId: layDownPlayer.phase,
        groups,
      };

      const newLaidDownPhases = [...prev.laidDownPhases, newLaidDown];
      playersAfterLayDown = updatedPlayers;
      laidDownAfterLayDown = newLaidDownPhases;

      return {
        ...prev,
        players: updatedPlayers,
        laidDownPhases: newLaidDownPhases,
      };
    });

    addLog(`✨ ${layDownPlayer.avatar} ${layDownPlayer.name} BAIXOU A FASE ${layDownPlayer.phase}! ✨`, 'success');

    const endResult = evaluateRoundEnd(playersAfterLayDown, laidDownAfterLayDown, {
      drawPile: room.drawPile,
      discardPile: room.discardPile,
    });
    if (endResult) {
      handleRoundEnd(endResult.winner, endResult.allAdvance);
      return;
    }

    setIsBuildingPhase(false);
    setBuildGroup1([]);
    setBuildGroup2([]);
    clearCardSelection();

    if (room.settings.gameMode === 'bots') {
      triggerBotChatReaction('baixou');
    }
  };

  // ----------------------------------------------------
  // HIT ACTIONS
  // ----------------------------------------------------
  const handleHitCard = (targetPlayerId: string, groupIndex: number) => {
    if (!isMyTurn || turnState !== 'playing' || !selectedHitCard) return;
    if (!myPlayer.hasLaidDownThisRound) {
      alert("Você precisa baixar a sua própria fase antes de poder bater nas fases dos adversários!");
      return;
    }

    // Find the layout group
    const layout = room.laidDownPhases.find(p => p.playerId === targetPlayerId);
    if (!layout) return;

    const group = layout.groups[groupIndex];
    if (!group) {
      alert('Grupo alvo não encontrado.');
      return;
    }

    const phaseDef = STANDARD_PHASES.find(p => p.id === layout.phaseId);
    if (!phaseDef) return;

    const categories = identifyGroupTypes(phaseDef.type, layout.groups);
    const category = categories[groupIndex] || 'Grupo';

    // Validate if hit is allowed
    if (!isValidHit(selectedHitCard, group, category)) {
      alert(`Esta carta não se encaixa neste grupo (${category}).`);
      return;
    }

    if (isOnline) {
      emitGameAction(
        {
          type: 'hit',
          cardId: selectedHitCard.id,
          targetPlayerId,
          groupIndex,
        },
        (result) => {
          if (!handleOnlineActionResult(result)) return;
          playSound('draw');
          clearCardSelection();
        },
      );
      return;
    }

    // Apply hit! (local)
    playSound('draw');

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
    addLog(`${activePlayer.avatar} ${activePlayer.name} bateu com ${cardDesc} na fase de ${layout.playerName}!`, 'success');
    setSelectedCards([]);

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
    if (isOnline) return;
    if (roundEndHandledRef.current) return;
    roundEndHandledRef.current = true;

    playSound('win');

    if (allAdvance) {
      setRoundEndReason('all_laid_down');
      addLog('🎉 TODOS BAIARAM SUAS FASES! A RODADA FOI ENCERRADA! 🎉', 'success');
    } else if (roundWinner) {
      setRoundEndReason('go_out');
      addLog(`🎉 ${roundWinner.avatar} ${roundWinner.name} BATEU E FECHOU A RODADA! 🎉`, 'success');

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
        emitGameAction({ type: 'next_round' }, (result) => {
          if (result?.error) return;
          if (result?.room) applyOnlineGameState(result.room);
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
        alert('Apenas o host pode iniciar a próxima rodada.');
        return;
      }
      emitGameAction({ type: 'next_round' }, (result) => {
        if (result?.error) {
          alert(result.error);
          return;
        }
        if (result?.room) {
          applyOnlineGameState(result.room);
        }
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
    addChatMessage('Sistema', '🤖', '#64748b', 'O jogo foi reiniciado. Boa sorte a todos!', true);
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

    // 1. CHOOSE TO DRAW
    const topDiscard = room.discardPile[room.discardPile.length - 1];
    const shouldDrawDiscard = topDiscard && botShouldDrawFromDiscard(bot, topDiscard);
    
    playSound('draw');

    let currentBotState = { ...bot };

    setRoom(prev => {
      const drawPile = [...prev.drawPile];
      const discardPile = [...prev.discardPile];
      const updatedPlayers = [...prev.players];
      const pIdx = prev.currentTurnIndex;
      const botHand = [...updatedPlayers[pIdx].cards];
      let drawn: Card | undefined;

      if (shouldDrawDiscard && topDiscard) {
        drawn = discardPile.pop();
        addLog(`🤖 ${bot.avatar} ${bot.name} comprou o descarte (${drawn?.type === 'wild' ? 'Curinga' : drawn?.value + ' ' + drawn?.color}).`, 'action');
      } else {
        if (drawPile.length === 0) {
          // Recycle
          const topDisc = discardPile.pop();
          const newDraw = shuffleDeck([...discardPile]);
          discardPile.length = 0;
          if (topDisc) discardPile.push(topDisc);
          drawPile.push(...newDraw);
        }
        drawn = drawPile.pop();
        addLog(`🤖 ${bot.avatar} ${bot.name} comprou do monte.`, 'action');
      }

      if (drawn) {
        botHand.push(drawn);
      }

      currentBotState.cards = botHand;
      updatedPlayers[pIdx] = currentBotState;

      return {
        ...prev,
        drawPile,
        discardPile,
        players: updatedPlayers
      };
    });

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
          addLog(`✨ 🤖 ${bot.avatar} ${bot.name} BAIXOU A FASE ${bot.phase}! ✨`, 'success');

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
              addLog(`🤖 ${activeBot.avatar} ${activeBot.name} bateu com ${cardToPlay.type === 'wild' ? 'Curinga' : cardToPlay.value} em ${targetPlName}!`, 'success');
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
          addChatMessage(responder.name, responder.avatar, responder.color || '#94a3b8', "Ahaha, é bem isso! 👍");
        }, 1000);
      }
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 md:px-4 py-4 select-none">
      
      {/* 1. Header Toolbar */}
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-center justify-between shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 rounded-xl text-center text-white font-black text-sm uppercase tracking-wider">
            Rodada {room.roundNumber}
          </div>
          <div className="text-slate-400 text-xs font-semibold">
            Código Sala: <span className="text-indigo-400 font-mono tracking-widest uppercase font-bold">{room.code}</span>
          </div>
        </div>

        {/* Current Phase Targets Info */}
        <div className="hidden lg:flex items-center space-x-3 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850">
          <span className="text-slate-500 font-bold uppercase tracking-wider">Fases Atuais:</span>
          <div className="flex gap-2">
            {room.players.map(p => (
              <div key={p.id} className="flex items-center space-x-1 border-r border-slate-800 pr-2 last:border-0">
                <span className="text-sm">{p.avatar}</span>
                <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[60px]">{p.name}</span>
                <span className="text-xs font-black text-amber-400">F{p.phase}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Audio Switcher */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-100 transition-colors"
            title={soundEnabled ? "Mutar Efeitos" : "Ativar Efeitos"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-purple-400" /> : <VolumeX className="w-5 h-5 text-slate-600" />}
          </button>

          {/* Rules Trigger */}
          <button
            onClick={() => { playSound('click'); setIsRulesOpen(true); }}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 rounded-xl text-xs font-bold text-slate-200 hover:text-white transition-colors flex items-center space-x-1.5 border border-slate-700/60"
          >
            <Book className="w-4 h-4 text-purple-400" />
            <span>Ver Regras</span>
          </button>

          {/* Sair */}
          <button
            onClick={() => { if (confirm("Tem certeza que deseja sair?")) onExit(); }}
            className="px-3.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 active:bg-rose-950 border border-rose-900/60 rounded-xl text-xs font-bold text-rose-300 hover:text-rose-200 transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      {/* 2. Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Players Table Statuses & Laid-Down Phases on Table (cols: 8) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Discard & Draw Deck Center Pile */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/15 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative flex flex-col md:flex-row items-center justify-around gap-6">
              
              {/* Draw Pile Stack */}
              <div className="flex flex-col items-center space-y-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Monte de Compra</span>
                
                <button
                  onClick={() => handleDrawCard('draw')}
                  disabled={!isMyTurn || turnState !== 'drawing'}
                  className={`w-28 h-40 rounded-2xl border-4 transition-all relative flex flex-col items-center justify-center shadow-lg ${
                    isMyTurn && turnState === 'drawing'
                      ? 'border-purple-500 bg-slate-950 hover:scale-105 active:scale-95 cursor-pointer shadow-purple-900/20'
                      : 'border-slate-800 bg-slate-950 cursor-not-allowed opacity-80'
                  }`}
                >
                  <div className="absolute inset-2 border border-purple-500/10 rounded-lg flex flex-col items-center justify-center">
                    <div className="text-3xl font-black bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent mb-1 font-mono">P10</div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Comprar</span>
                  </div>
                  {/* Cards remaining badge */}
                  <span className="absolute bottom-2 bg-slate-800 text-slate-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700">
                    {room.drawPile.length} restando
                  </span>
                </button>
              </div>

              {/* Discard Pile Stack */}
              <div className="flex flex-col items-center space-y-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Monte de Descarte</span>
                
                {room.discardPile.length > 0 ? (
                  (() => {
                    const topDiscard = room.discardPile[room.discardPile.length - 1];
                    const isSkip = topDiscard.type === 'skip';
                    const isWild = topDiscard.type === 'wild';
                    
                    return (
                      <button
                        onClick={() => handleDrawCard('discard')}
                        disabled={!isMyTurn || turnState !== 'drawing' || isSkip}
                        className={`w-28 h-40 rounded-2xl border-4 transition-all relative flex flex-col items-center justify-between p-4 shadow-lg overflow-hidden ${
                          isMyTurn && turnState === 'drawing' && !isSkip
                            ? 'border-emerald-500 hover:scale-105 active:scale-95 cursor-pointer shadow-emerald-900/20'
                            : 'border-slate-800 cursor-not-allowed'
                        }`}
                        style={{
                          backgroundColor: isSkip ? '#4c0519' : isWild ? '#022c22' : '#0f172a',
                        }}
                      >
                        {/* Suit marker colors */}
                        <div className="flex justify-between w-full text-sm font-black font-mono">
                          <span style={{ color: topDiscard.color === 'wild' ? '#10b981' : topDiscard.color === 'skip' ? '#f43f5e' : topDiscard.color }}>
                            {isWild ? 'W' : isSkip ? 'S' : topDiscard.value}
                          </span>
                        </div>

                        {/* Large center graphic */}
                        <div className="text-center font-black">
                          {isWild ? (
                            <span className="text-3xl bg-gradient-to-br from-emerald-400 to-teal-400 bg-clip-text text-transparent font-sans">WILD</span>
                          ) : isSkip ? (
                            <span className="text-3xl text-rose-500 font-sans tracking-tight">SKIP</span>
                          ) : (
                            <span className="text-5xl font-mono" style={{ color: topDiscard.color }}>
                              {topDiscard.value}
                            </span>
                          )}
                        </div>

                        <div className="w-full flex justify-end text-sm font-black font-mono">
                          <span style={{ color: topDiscard.color === 'wild' ? '#10b981' : topDiscard.color === 'skip' ? '#f43f5e' : topDiscard.color }}>
                            {isWild ? 'W' : isSkip ? 'S' : topDiscard.value}
                          </span>
                        </div>
                      </button>
                    );
                  })()
                ) : (
                  <div className="w-28 h-40 rounded-2xl border-4 border-dashed border-slate-800 flex items-center justify-center text-slate-600 bg-slate-950">
                    <span className="text-xs uppercase font-bold text-center p-2">Sem descarte</span>
                  </div>
                )}
              </div>

              {/* Action State Prompt Card */}
              <div className="flex-1 max-w-sm bg-slate-950 p-4 rounded-xl border border-slate-850/80 flex flex-col justify-center space-y-2">
                <div className="flex items-center space-x-2 text-indigo-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-xs uppercase font-extrabold tracking-wider">Status do Turno</span>
                </div>

                <div className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <span className="text-lg">{activePlayer.avatar}</span>
                  <span style={{ color: activePlayer.color }}>{activePlayer.name}</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {turnState === 'drawing' && "👉 Compre uma carta do monte ou do descarte para iniciar."}
                  {turnState === 'playing' && "👉 Você pode baixar sua fase, bater nas fases baixadas ou descartar uma carta para passar o turno."}
                  {turnState === 'idle' && `Aguardando a jogada de ${activePlayer.name}...`}
                </p>

                {isMyTurn && turnState === 'playing' && !myPlayer.hasLaidDownThisRound && (
                  <button
                    onClick={handleToggleBuilder}
                    className={`w-full py-2 rounded-xl text-xs font-black tracking-wide border transition-all ${
                      isBuildingPhase
                        ? 'bg-rose-950/40 border-rose-900/60 text-rose-300'
                        : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white shadow-md shadow-indigo-900/20'
                    }`}
                  >
                    {isBuildingPhase ? "Fechar Organizador de Fase" : `Organizar Minha Fase ${activePlayer.phase}`}
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* LAID-DOWN PHASES ON THE TABLE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>Mesa: Fases Baixadas</span>
              <span className="text-xs text-slate-500 font-normal normal-case">Clique em uma carta na sua mão e depois clique no botão "Bater" do grupo correspondente.</span>
            </h3>

            {room.laidDownPhases.length === 0 ? (
              <div className="bg-slate-950 rounded-xl p-8 border border-dashed border-slate-800 text-center text-slate-500">
                <p className="text-sm">Nenhum jogador baixou sua fase nesta rodada ainda.</p>
                <p className="text-xs mt-1 text-slate-600">Seja o primeiro a baixar para começar a bater!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {room.laidDownPhases.map((layout) => {
                  const phaseDef = STANDARD_PHASES.find(p => p.id === layout.phaseId);
                  const groupNames = phaseDef ? identifyGroupTypes(phaseDef.type, layout.groups) : [];

                  return (
                    <div 
                      key={layout.playerId} 
                      className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-3 shadow-inner"
                      style={{ borderLeft: `4px solid ${layout.playerColor}` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">
                            {room.players.find(p => p.id === layout.playerId)?.avatar || '👤'}
                          </span>
                          <span className="font-bold text-xs text-slate-200">{layout.playerName}</span>
                        </div>
                        <span className="text-[10px] font-black bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded-full">
                          Fase {layout.phaseId} Completa!
                        </span>
                      </div>

                      {/* Display Groups */}
                      <div className="space-y-3">
                        {layout.groups.map((grp, grpIdx) => (
                          <div key={grpIdx} className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/40 space-y-2">
                            <div className="flex justify-between items-center text-[10px] uppercase font-extrabold text-slate-500">
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
                                    className="w-8 h-12 shrink-0 rounded-md border border-slate-700/80 bg-slate-950 flex flex-col justify-between p-1 shadow-md"
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
                              {isMyTurn && turnState === 'playing' && selectedHitCard && myPlayer.hasLaidDownThisRound && !isBuildingPhase && (
                                <button
                                  onClick={() => handleHitCard(layout.playerId, grpIdx)}
                                  className="w-10 h-12 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-white rounded-md shrink-0 flex flex-col items-center justify-center font-bold text-[9px] cursor-pointer shadow-lg transition-transform hover:scale-105 active:scale-95 animate-pulse"
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

        {/* RIGHT COLUMN: Chat / Action Log Feed & Player Rankings (cols: 4) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* PLAYER LIST SCOREBOARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
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
                        ? 'bg-indigo-500/10 border-indigo-500 shadow-md' 
                        : 'bg-slate-950/60 border-slate-850 hover:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="text-xs font-bold text-slate-500 w-4 font-mono">
                        {idx + 1}º
                      </span>
                      <span className="text-lg relative">
                        {player.avatar}
                        {player.isSkipped && (
                          <span className="absolute -bottom-1 -right-1 text-[8px] bg-rose-600 border border-slate-900 rounded-full w-3.5 h-3.5 flex items-center justify-center font-extrabold text-white" title="Pulado na próxima rodada">
                            🚫
                          </span>
                        )}
                        {player.hasLaidDownThisRound && (
                          <span className="absolute -top-1 -right-1 text-[8px] bg-emerald-600 border border-slate-900 rounded-full w-3.5 h-3.5 flex items-center justify-center font-extrabold text-white" title="Baixou Fase!">
                            ✓
                          </span>
                        )}
                      </span>
                      <div className="min-w-0 leading-tight">
                        <div className="text-xs font-extrabold truncate text-slate-200" style={{ color: player.color }}>
                          {player.name} {player.isBot && <span className="text-[9px] bg-slate-800 text-slate-400 font-normal px-1 rounded">IA</span>}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold uppercase">
                          {player.cards.length} cartas em mãos
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-amber-400">FASE {player.phase}</div>
                      <div className="text-[10px] font-semibold text-slate-400 font-mono">{player.score} pts</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CHAT AND LOGS PANEL */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl h-80 flex flex-col shadow-xl overflow-hidden">
            {/* Tabs header */}
            <div className="flex border-b border-slate-800 bg-slate-950 p-1">
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex-1 py-2 font-bold text-xs rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  activeTab === 'logs'
                    ? 'bg-slate-900 text-indigo-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListTodo className="w-3.5 h-3.5" />
                <span>Logs do Jogo</span>
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2 font-bold text-xs rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                  activeTab === 'chat'
                    ? 'bg-slate-900 text-indigo-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Bate-papo</span>
              </button>
            </div>

            {/* Content Feed */}
            <div className="flex-1 p-3 overflow-y-auto bg-slate-950/30 text-xs">
              {activeTab === 'logs' ? (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="leading-normal flex space-x-2">
                      <span className="text-[10px] font-semibold font-mono text-slate-600 shrink-0">{log.timestamp}</span>
                      <p className={`
                        ${log.type === 'success' ? 'text-emerald-400 font-medium' : ''}
                        ${log.type === 'warning' ? 'text-rose-400 font-medium' : ''}
                        ${log.type === 'phase' ? 'text-purple-400 font-black tracking-wide uppercase bg-purple-950/25 px-1.5 py-0.5 rounded border border-purple-900/30 w-full' : ''}
                        ${log.type === 'action' ? 'text-slate-300' : ''}
                        ${log.type === 'info' ? 'text-slate-500 font-normal' : ''}
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
                    <div className="text-center text-slate-600 py-8 text-xs italic">
                      Nenhuma mensagem enviada. Comece mandando um "Oi"!
                    </div>
                  )}
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col space-y-0.5 ${msg.isSystem ? 'text-center' : ''}`}>
                      {msg.isSystem ? (
                        <div className="bg-slate-900/60 text-slate-400 text-[10px] py-1 px-2.5 rounded-lg border border-slate-800/80 inline-block mx-auto max-w-[85%]">
                          {msg.message}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-1 text-[10px] font-bold">
                            <span>{msg.senderAvatar}</span>
                            <span style={{ color: msg.senderColor }}>{msg.senderName}</span>
                            <span className="text-[9px] font-semibold text-slate-600 font-mono">{msg.timestamp}</span>
                          </div>
                          <div className="bg-slate-900 border border-slate-800/60 p-2 rounded-lg text-slate-300 break-words max-w-[95%]">
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
              <div className="p-2 border-t border-slate-850 bg-slate-950 flex flex-col space-y-2">
                
                {/* Preset words */}
                <div className="flex gap-1 overflow-x-auto py-0.5 scrollbar-none">
                  {['Eita! 😲', 'Curinga! 🔥', 'Boa jogada! 👏', 'Estou quase! 😎', 'Não me pulem! 🚫', 'Que azar... 😢'].map((word) => (
                    <button
                      key={word}
                      type="button"
                      onClick={() => handleSendPresetMessage(word)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 font-bold rounded-lg shrink-0 cursor-pointer"
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
                    className="flex-1 bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
                    maxLength={100}
                  />
                  <button
                    type="submit"
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* 3. PHASE BUILDER MODAL / BOTTOM SCREEN DRAWER */}
      {isMyTurn && turnState === 'playing' && isBuildingPhase && (
        <div className="bg-slate-900 border-2 border-indigo-600 rounded-2xl p-5 my-6 shadow-2xl relative overflow-hidden animate-fade-in">
          <div className="absolute top-2 right-2 text-[10px] bg-indigo-500/10 text-indigo-400 font-extrabold px-2 py-0.5 rounded-full uppercase">
            Organizador de Fase {activePlayer.phase}
          </div>

          <div className="space-y-4">
            <div className="leading-tight">
              <h4 className="text-sm font-black text-slate-200">
                Fase {activePlayer.phase}: {STANDARD_PHASES.find(p => p.id === activePlayer.phase)?.name}
              </h4>
              <p className="text-xs text-slate-400">
                {STANDARD_PHASES.find(p => p.id === activePlayer.phase)?.description}
              </p>
              <p className="text-[11px] text-indigo-400/80 mt-1">
                Dica: clique em várias cartas da mão para selecioná-las e mova todas de uma vez para o grupo.
              </p>
            </div>

            {/* Two Building groups */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Build group 1 */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs font-extrabold text-slate-400">
                  <span>Grupo 1</span>
                  <span className="text-[10px] font-normal text-slate-500">Mínimo necessário</span>
                </div>

                <div className="flex flex-wrap gap-1.5 min-h-16 p-2 bg-slate-900/60 rounded-lg border border-dashed border-slate-800 items-center justify-center">
                  {buildGroup1.length === 0 ? (
                    <span className="text-[10px] text-slate-600 uppercase font-bold">Vazio</span>
                  ) : (
                    buildGroup1.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => removeCardFromBuildGroup(c.id, 1)}
                        className="w-10 h-14 rounded-lg bg-slate-950 border border-slate-700 p-1 text-center flex flex-col justify-between hover:border-rose-500 hover:text-rose-400 transition-colors cursor-pointer group"
                        title="Remover"
                      >
                        <span className="text-[9px] font-black font-mono leading-none" style={{ color: c.type === 'wild' ? '#10b981' : c.color }}>
                          {c.type === 'wild' ? 'W' : c.value}
                        </span>
                        <span className="text-[9px] font-black group-hover:hidden" style={{ color: c.type === 'wild' ? '#10b981' : c.color }}>
                          {c.type === 'wild' ? 'W' : c.value}
                        </span>
                        <span className="text-[8px] font-bold text-rose-500 hidden group-hover:block w-full">Sair</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Build group 2 (Only render if Phase requires 2 groups) */}
              {['sets_2_3', 'set_3_run_4', 'set_4_run_4', 'sets_2_4', 'set_5_set_2', 'set_5_set_3'].includes(
                STANDARD_PHASES.find(p => p.id === activePlayer.phase)?.type || ''
              ) && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-xs font-extrabold text-slate-400">
                    <span>Grupo 2</span>
                    <span className="text-[10px] font-normal text-slate-500">Mínimo necessário</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 min-h-16 p-2 bg-slate-900/60 rounded-lg border border-dashed border-slate-800 items-center justify-center">
                    {buildGroup2.length === 0 ? (
                      <span className="text-[10px] text-slate-600 uppercase font-bold">Vazio</span>
                    ) : (
                      buildGroup2.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => removeCardFromBuildGroup(c.id, 2)}
                          className="w-10 h-14 rounded-lg bg-slate-950 border border-slate-700 p-1 text-center flex flex-col justify-between hover:border-rose-500 hover:text-rose-400 transition-colors cursor-pointer group"
                          title="Remover"
                        >
                          <span className="text-[9px] font-black font-mono leading-none" style={{ color: c.type === 'wild' ? '#10b981' : c.color }}>
                            {c.type === 'wild' ? 'W' : c.value}
                          </span>
                          <span className="text-[9px] font-black group-hover:hidden" style={{ color: c.type === 'wild' ? '#10b981' : c.color }}>
                            {c.type === 'wild' ? 'W' : c.value}
                          </span>
                          <span className="text-[8px] font-bold text-rose-500 hidden group-hover:block w-full">Sair</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Validation feedback & laydown trigger */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800 pt-3">
              <div className="flex items-center space-x-2 text-xs">
                {(() => {
                  const check = checkBuilderValidity();
                  return check.isValid ? (
                    <div className="flex items-center space-x-1.5 text-emerald-400 font-extrabold uppercase bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-900/30">
                      <Check className="w-3.5 h-3.5" />
                      <span>Combinação Válida!</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 text-amber-400 font-bold bg-amber-950/20 px-3 py-1 rounded-full border border-amber-900/20">
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
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Limpar Grupos
                </button>

                <button
                  onClick={handleLayDownPhase}
                  disabled={!checkBuilderValidity().isValid}
                  className={`flex-1 sm:flex-initial px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    checkBuilderValidity().isValid
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/40 animate-pulse'
                      : 'bg-slate-800 text-slate-500 border border-slate-850 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>BAIXAR FASE {activePlayer.phase}!</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4. PLAYER ACTIVE HAND AREA */}
      <footer className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-2xl relative space-y-4">
        
        {/* Sorting and State Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Sua Mão</span>
            <span className="text-[11px] font-black bg-slate-950 text-indigo-400 border border-slate-800 px-2.5 py-0.5 rounded-full font-mono">
              {myPlayer.cards.filter((c) => !c.id.startsWith('hidden-')).length} cartas
            </span>
          </div>

          {/* Sorters */}
          {isMyTurn && (
            <div className="flex gap-2">
              <button
                onClick={() => sortHand('value')}
                className="px-3 py-1 bg-slate-950 hover:bg-slate-800 active:bg-slate-950 text-slate-300 hover:text-white rounded-lg text-[10px] font-black border border-slate-800/80 transition-all cursor-pointer flex items-center space-x-1"
              >
                <span>123</span>
                <span>Ordenar Valor</span>
              </button>
              <button
                onClick={() => sortHand('color')}
                className="px-3 py-1 bg-slate-950 hover:bg-slate-800 active:bg-slate-950 text-slate-300 hover:text-white rounded-lg text-[10px] font-black border border-slate-800/80 transition-all cursor-pointer flex items-center space-x-1"
              >
                <span className="w-2 h-2 rounded-full bg-gradient-to-tr from-red-500 to-blue-500 shrink-0" />
                <span>Ordenar Cor</span>
              </button>
            </div>
          )}
        </div>

        {/* Hand Cards Render */}
        {!isOnline && !isMyTurn ? (
          <div className="h-44 bg-slate-950 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-600 text-sm">
            <User className="w-8 h-8 text-slate-700 animate-pulse mb-2" />
            <p className="font-semibold text-xs uppercase tracking-widest text-slate-500">Aguardando sua vez...</p>
            <p className="text-[10px] text-slate-600 mt-1">Quando seu turno começar, suas cartas serão reveladas aqui.</p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Cards Horizontal Container */}
            <div className="flex gap-2 py-2 overflow-x-auto min-h-48 px-1 scrollbar-thin">
              {myPlayer.cards.filter((c) => !c.id.startsWith('hidden-')).map((card) => {
                const isSelected = selectedCards.some((c) => c.id === card.id);
                const isInGroup1 = buildGroup1.some(c => c.id === card.id);
                const isInGroup2 = buildGroup2.some(c => c.id === card.id);
                const isW = card.type === 'wild';
                const isS = card.type === 'skip';

                return (
                  <button
                    key={card.id}
                    disabled={!isMyTurn}
                    onClick={() => handleHandCardClick(card)}
                    className={`w-24 h-36 rounded-xl border-4 transition-all relative flex flex-col justify-between p-3 shrink-0 overflow-hidden text-left ${
                      isSelected
                        ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-950/50 -translate-y-2'
                        : isInGroup1 || isInGroup2
                        ? 'border-indigo-900/60 opacity-50 saturate-50'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700 hover:-translate-y-1'
                    } cursor-pointer`}
                    style={{
                      backgroundColor: isS ? '#31101b' : isW ? '#09251a' : '#0a0f1d',
                    }}
                  >
                    {/* Suit values */}
                    <div className="flex justify-between w-full text-xs font-black font-mono">
                      <span style={{ color: isW ? '#10b981' : isS ? '#f43f5e' : card.color }}>
                        {isW ? 'W' : isS ? 'S' : card.value}
                      </span>
                    </div>

                    {/* Large display center */}
                    <div className="text-center font-black">
                      {isW ? (
                        <span className="text-xl bg-gradient-to-br from-emerald-400 to-teal-400 bg-clip-text text-transparent font-sans tracking-tight">WILD</span>
                      ) : isS ? (
                        <span className="text-xl text-rose-500 font-sans tracking-tight">SKIP</span>
                      ) : (
                        <span className="text-3xl font-mono" style={{ color: card.color }}>
                          {card.value}
                        </span>
                      )}
                    </div>

                    {/* Suit indicators bottom */}
                    <div className="w-full flex justify-between items-end text-xs font-black font-mono">
                      {isInGroup1 && (
                        <span className="text-[8px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-1 rounded-sm uppercase font-extrabold">G1</span>
                      )}
                      {isInGroup2 && (
                        <span className="text-[8px] bg-purple-500/10 border border-purple-500/30 text-purple-400 px-1 rounded-sm uppercase font-extrabold">G2</span>
                      )}
                      {!isInGroup1 && !isInGroup2 && <span />}

                      <span style={{ color: isW ? '#10b981' : isS ? '#f43f5e' : card.color }}>
                        {isW ? 'W' : isS ? 'S' : card.value}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Card Action Drawer */}
            {selectedCards.length > 0 && (
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-center space-x-3 text-xs">
                  {isBuildingPhase && selectedCards.length > 1 ? (
                    <div>
                      <span className="font-extrabold text-white block uppercase text-[10px] text-slate-500">
                        Cartas Selecionadas
                      </span>
                      <span className="text-sm font-black text-indigo-300">
                        {selectedCards.length} cartas prontas para mover ao grupo
                      </span>
                    </div>
                  ) : primarySelectedCard ? (
                    <>
                      <div className="w-8 h-12 rounded border border-slate-800 bg-slate-900 flex items-center justify-center font-bold">
                        <span style={{ color: primarySelectedCard.type === 'wild' ? '#10b981' : primarySelectedCard.type === 'skip' ? '#f43f5e' : primarySelectedCard.color }}>
                          {primarySelectedCard.type === 'wild' ? 'W' : primarySelectedCard.type === 'skip' ? 'S' : primarySelectedCard.value}
                        </span>
                      </div>
                      <div>
                        <span className="font-extrabold text-white block uppercase text-[10px] text-slate-500">Carta Selecionada</span>
                        <span className="text-sm font-black text-slate-200">
                          {primarySelectedCard.type === 'wild' ? 'Curinga (Wild Card)' : primarySelectedCard.type === 'skip' ? 'Skip (Pular Oponente)' : `${primarySelectedCard.value} de cor ${primarySelectedCard.color.toUpperCase()}`}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div>
                      <span className="font-extrabold text-white block uppercase text-[10px] text-slate-500">
                        Cartas Selecionadas
                      </span>
                      <span className="text-sm font-black text-indigo-300">
                        {selectedCards.length} cartas — selecione uma para descartar ou bater
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  {isBuildingPhase && (
                    <>
                      <button
                        onClick={() => addCardsToBuildGroup(selectedCards, 1)}
                        disabled={selectedCards.length === 0}
                        className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg cursor-pointer"
                      >
                        {selectedCards.length > 1
                          ? `Mover ${selectedCards.length} para Grupo 1`
                          : 'Mover para Grupo 1'}
                      </button>

                      {['sets_2_3', 'set_3_run_4', 'set_4_run_4', 'sets_2_4', 'set_5_set_2', 'set_5_set_3'].includes(
                        STANDARD_PHASES.find(p => p.id === myPlayer.phase)?.type || ''
                      ) && (
                        <button
                          onClick={() => addCardsToBuildGroup(selectedCards, 2)}
                          disabled={selectedCards.length === 0}
                          className="flex-1 sm:flex-initial px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg cursor-pointer"
                        >
                          {selectedCards.length > 1
                            ? `Mover ${selectedCards.length} para Grupo 2`
                            : 'Mover para Grupo 2'}
                        </button>
                      )}
                    </>
                  )}

                  {turnState === 'playing' && primarySelectedCard && !isBuildingPhase && (
                    <button
                      onClick={() => handleDiscard(primarySelectedCard)}
                      className="flex-1 sm:flex-initial px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg cursor-pointer transition-transform hover:scale-105 active:scale-95"
                    >
                      {primarySelectedCard.type === 'skip' ? '🚫 Usar para Pular Oponente' : '🗑 Descartar'}
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </footer>

      {/* 5. SKIP SELECTOR MODAL TARGET */}
      {showSkipSelector && skipCardPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-full flex items-center justify-center mx-auto text-xl">
              🚫
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Selecione quem pular</h3>
              <p className="text-xs text-slate-400">Você descartou um Skip! Escolha um dos adversários para pular o turno na próxima rodada.</p>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {room.players
                .filter(p => p.id !== activePlayer.id) // cannot skip self
                .map((player) => (
                  <button
                    key={player.id}
                    onClick={() => executeDiscard(skipCardPending, player.id)}
                    className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white flex items-center justify-between border border-slate-850/80 transition-colors cursor-pointer text-xs font-bold"
                  >
                    <div className="flex items-center space-x-2">
                      <span>{player.avatar}</span>
                      <span style={{ color: player.color }}>{player.name}</span>
                      {player.isBot && <span className="text-[10px] text-slate-500 font-normal">(IA)</span>}
                    </div>

                    <div className="text-slate-500 font-mono text-[10px]">
                      Fase {player.phase} • {player.score} pts
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
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold cursor-pointer"
            >
              Cancelar Descarte
            </button>
          </div>
        </div>
      )}

      {/* 6. ROUND OVER DISPLAY SCREEN overlay */}
      {room.status === 'round_end' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-6 my-8">
            
            <div className="text-center space-y-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-extrabold">
                <Award className="w-4 h-4" />
                <span>RODADA ENCERRADA!</span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight uppercase">
                Resultados da Rodada {room.roundNumber}
              </h2>
              <p className="text-xs text-slate-400">
                {roundEndReason === 'all_laid_down'
                  ? 'Todos os jogadores baixaram suas fases — todos avançam para a próxima fase!'
                  : 'Um jogador ficou sem cartas — apenas quem baixou a fase avança.'}
              </p>
              {autoStartCountdown !== null && autoStartCountdown > 0 && (
                <p className="text-[11px] text-indigo-400 font-semibold">
                  {isOnline && !onlineSession?.isHost
                    ? `O host iniciará a nova rodada em ${autoStartCountdown}s…`
                    : `Nova rodada em ${autoStartCountdown}s…`}
                </p>
              )}
            </div>

            {/* Results Table */}
            <div className="divide-y divide-slate-800 bg-slate-950 rounded-xl p-4 border border-slate-850">
              {room.players.map((player) => {
                const hadLaidDown = room.laidDownPhases.some(l => l.playerId === player.id) || player.hasLaidDownThisRound;
                
                return (
                  <div key={player.id} className="py-3 flex flex-wrap gap-4 items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 min-w-[180px]">
                      <span className="text-2xl">{player.avatar}</span>
                      <div>
                        <span className="font-extrabold text-slate-200 block" style={{ color: player.color }}>
                          {player.name}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {player.isBot ? 'Jogador Bot (IA)' : 'Jogador Humano'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-8">
                      {/* Phase outcome */}
                      <div className="text-center">
                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Status da Fase</div>
                        {hadLaidDown ? (
                          <span className="text-[10px] bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                            Completa! ➔ Ir para F{player.phase}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-rose-950/40 border border-rose-900/30 text-rose-400 px-2 py-0.5 rounded-full font-bold">
                            Falhou ➔ Mantém F{player.phase}
                          </span>
                        )}
                      </div>

                      {/* Cumulative Score */}
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Pontuação Total</div>
                        <span className="font-black text-slate-100 font-mono text-sm">{player.score} pts</span>
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
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Reiniciar Todo Jogo
                </button>
              )}

              <button
                onClick={handleNextRound}
                disabled={isOnline && !onlineSession?.isHost}
                className={`px-8 py-3 rounded-xl font-black text-sm tracking-wide shadow-lg flex items-center space-x-2 transition-transform ${
                  isOnline && !onlineSession?.isHost
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-indigo-900/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer animate-bounce'
                }`}
              >
                <span>
                  {isOnline && !onlineSession?.isHost
                    ? 'AGUARDANDO HOST'
                    : `INICIAR RODADA ${room.roundNumber + 1}`}
                </span>
                {(!isOnline || onlineSession?.isHost) && (
                  <ArrowRight className="w-4 h-4 text-white" />
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 7. GAME OVER CELEBRATION MODAL overlay */}
      {room.status === 'game_over' && room.winnerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden animate-fade-in">
            
            {/* Confetti decoration */}
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-yellow-400 via-pink-500 to-indigo-500" />
            
            {(() => {
              const champion = room.players.find(p => p.id === room.winnerId);
              if (!champion) return null;

              return (
                <div className="space-y-4">
                  <div className="text-5xl animate-bounce">🏆</div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-black tracking-widest text-yellow-500 animate-pulse">CAMPEÃO SUPREMO</p>
                    <h2 className="text-3xl font-black tracking-tight" style={{ color: champion.color }}>
                      {champion.name}
                    </h2>
                  </div>

                  <div className="inline-flex items-center space-x-1 px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-bold rounded-full text-xs">
                    <span>Fase 10 Completada com {champion.score} pts!</span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed px-2">
                    Parabéns! {champion.name} superou as adversidades, completou as 10 Fases e garantiu a vitória nesta partida fantástica!
                  </p>
                </div>
              );
            })()}

            {/* Ranked summary list */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs text-left divide-y divide-slate-800">
              <p className="text-[10px] uppercase font-bold text-slate-500 pb-2">Classificação Final</p>
              {[...room.players].sort((a, b) => b.phase - a.phase || a.score - b.score).map((player, idx) => (
                <div key={player.id} className="py-2 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-slate-500">{idx + 1}º</span>
                    <span>{player.avatar}</span>
                    <span className="font-bold" style={{ color: player.color }}>{player.name}</span>
                  </div>
                  <div className="text-slate-400 font-mono">Fase {player.phase} ({player.score} pts)</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onExit}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Voltar ao Menu
              </button>
              
              <button
                onClick={handleResetGame}
                className="flex-1 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 rounded-xl font-extrabold text-xs tracking-wider shadow-lg shadow-yellow-950/20 cursor-pointer"
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
