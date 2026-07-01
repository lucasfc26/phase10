import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  User,
  Play,
  RefreshCw,
  Copy,
  CopyCheck,
  Globe,
  Laptop,
  Plus,
  Trash2,
  Bot,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Layers,
  Swords,
  Building2,
  Spade,
} from "lucide-react";
import { GameRoom, Player, TowerCharacterClass } from "../types";
import { generateId } from "../gameEngine";
import type { ActiveGameState } from "../games/GameRouter";
import type { CardGameId, GamePlayerProfile } from "../games/types";
import {
  createInitialPokerRoom,
  mapLobbyToPokerPlayers,
} from "../games/poker/engine";
import {
  createInitialTrucoRoom,
  mapLobbyToTrucoPlayers,
} from "../games/truco/engine";
import {
  onlineApi,
  LobbyPlayer,
  PublicRoom,
  RoomSession,
} from "../services/onlineApi";
import {
  connectOnlineSocket,
  emitGameStart,
  emitLobbyAddBot,
  emitLobbySetReady,
  emitRoomLeave,
} from "../services/onlineSocket";
import {
  TOWER_CHARACTER_CLASSES,
  pickRandomTowerCharacterClass,
  getTowerCharacterInfo,
} from "../games/towerMaster/characters";
import { TowerCharacterBadge } from "./TowerCharacterSelect";
import { PlayerAvatar } from "./PlayerAvatar";
import { CharacterCreator, DEFAULT_CHARACTER } from "./CharacterCreator";
import {
  CharacterConfig,
  decodeCharacterAvatar,
  encodeCharacterAvatar,
  randomCharacterConfig,
} from "../lib/characterAvatar";
import { useI18n } from "../lib/i18n";
import {
  profileFromParts,
  type SavedPlayerProfile,
} from "../lib/playerProfile";

interface LobbyProps {
  onStartGame: (game: ActiveGameState, profile: GamePlayerProfile) => void;
  initialStep?: "profile" | "room_setup";
  initialProfile?: SavedPlayerProfile;
  onProfileChange?: (profile: SavedPlayerProfile) => void;
  onBackHome?: () => void;
}

type CardGameIdLocal = CardGameId;

function minPlayersForGame(game: CardGameId): number {
  if (game === "truco") return 4;
  if (game === "poker") return 2;
  if (game === "tower_master") return 2;
  return 3;
}

function maxPlayersForGame(game: CardGameId): number {
  if (game === "truco") return 4;
  if (game === "poker") return 6;
  return 10;
}

function canLaunchGame(game: CardGameId, count: number): boolean {
  if (game === "truco") return count === 4;
  return count >= minPlayersForGame(game);
}

function allNonHostHumansReady(players: Player[], hostMemberId: string): boolean {
  const humans = players.filter(
    (p) => !p.isBot && p.id !== hostMemberId && p.isConnected !== false,
  );
  if (humans.length === 0) return true;
  return humans.every((p) => p.isReady);
}

const COLORS = [
  "#f87171", // red
  "#fbbf24", // yellow
  "#34d399", // green
  "#60a5fa", // blue
  "#c084fc", // purple
  "#f472b6", // pink
  "#fb923c", // orange
  "#2dd4bf", // teal
  "#a3e635", // lime
  "#f43f5e", // rose
  "#818cf8", // indigo
  "#14b8a6", // cyan
  "#eab308", // amber
  "#ec4899", // magenta
];

const BOT_NAMES = [
  "Arthur Bot",
  "Beatriz AI",
  "Caio Bot",
  "Diana AI",
  "Enzo Bot",
  "Fernanda AI",
  "Gabriel Bot",
  "Helena AI",
  "Igor Bot",
  "Julia AI",
];

export const Lobby: React.FC<LobbyProps> = ({
  onStartGame,
  initialStep = "profile",
  initialProfile,
  onProfileChange,
  onBackHome,
}) => {
  const { t } = useI18n();

  // Mode options
  const [step, setStep] = useState<"profile" | "room_setup" | "waiting_room">(
    initialStep,
  );

  // Profile settings
  const [playerName, setPlayerName] = useState<string>(
    () => initialProfile?.name ?? "",
  );
  const [characterConfig, setCharacterConfig] = useState<CharacterConfig>(
    () =>
      initialProfile?.character ??
      decodeCharacterAvatar(initialProfile?.avatar ?? "") ??
      DEFAULT_CHARACTER,
  );
  const [selectedColor, setSelectedColor] = useState<string>(
    () => initialProfile?.color ?? "#60a5fa",
  );

  const selectedAvatar = encodeCharacterAvatar(characterConfig);

  // Room Settings
  const [cardGame, setCardGame] = useState<CardGameIdLocal>("phase10");
  const [gameMode, setGameMode] = useState<"bots" | "pass_and_play" | "online">(
    "bots",
  );
  const [isOnlineRoleHost, setIsOnlineRoleHost] = useState<boolean>(true); // Host vs Join Code
  const [inputRoomCode, setInputRoomCode] = useState<string>("");
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [botSpeed, setBotSpeed] = useState<number>(600); // ms delay
  const [allowBotsToggle, setAllowBotsToggle] = useState<boolean>(true);
  const [roomPassword, setRoomPassword] = useState<string>("");
  const [joinPassword, setJoinPassword] = useState<string>("");

  // Online multiplayer state
  const [onlineSession, setOnlineSession] = useState<RoomSession | null>(null);
  const [onlineHostMemberId, setOnlineHostMemberId] = useState<string>("");
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  // Waiting Room state (holds active players in the lobby before starting)
  const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([]);
  const [roomCode, setRoomCode] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [roomCodeCopied, setRoomCodeCopied] = useState(false);
  const roomCodeCopyResetRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setRoomCodeCopied(true);
    if (roomCodeCopyResetRef.current)
      clearTimeout(roomCodeCopyResetRef.current);
    roomCodeCopyResetRef.current = setTimeout(
      () => setRoomCodeCopied(false),
      2000,
    );
  };

  useEffect(() => {
    return () => {
      if (roomCodeCopyResetRef.current)
        clearTimeout(roomCodeCopyResetRef.current);
    };
  }, []);

  useEffect(() => {
    const cap = maxPlayersForGame(cardGame);
    setMaxPlayers((prev) => {
      if (cardGame === "truco") return 4;
      return Math.max(minPlayersForGame(cardGame), Math.min(prev, cap));
    });
  }, [cardGame]);

  // Generate random profile only when none was saved yet
  useEffect(() => {
    if (initialProfile) return;
    handleRandomizeProfile();
  }, []);

  useEffect(() => {
    onProfileChange?.(
      profileFromParts(playerName, characterConfig, selectedColor),
    );
  }, [playerName, characterConfig, selectedColor, onProfileChange]);

  const handleRandomizeProfile = () => {
    const names = [
      "Mestre_Fase",
      "Curinga_Louco",
      "Rei_da_Trinca",
      "Ninja",
      "Sortudo",
      "Player",
      "Bomba",
    ];
    const randomName =
      names[Math.floor(Math.random() * names.length)] +
      "_" +
      Math.floor(Math.random() * 90 + 10);
    setPlayerName(randomName);
    setCharacterConfig(randomCharacterConfig());
    setSelectedColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  };

  const handleSelectTowerMaster = () => {
    setCardGame("tower_master");
  };

  // Step 1 -> Step 2
  const handleConfirmProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("room_setup");
  };

  const mapLobbyPlayersToGame = (players: LobbyPlayer[]): Player[] =>
    players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      isBot: p.isBot,
      cards: [],
      phase: 1,
      hasLaidDownThisRound: false,
      score: 0,
      isSkipped: false,
      isReady: p.isReady ?? false,
      isConnected: p.isConnected,
    }));

  // Load public rooms when online mode is selected (pauses when tab is hidden)
  useEffect(() => {
    if (step !== "room_setup" || gameMode !== "online") return;

    let interval: ReturnType<typeof setInterval>;

    const refresh = () => {
      onlineApi
        .listRooms()
        .then(setPublicRooms)
        .catch(() => setPublicRooms([]));
    };

    const startPolling = () => {
      refresh();
      clearInterval(interval);
      interval = setInterval(refresh, document.hidden ? 15000 : 8000);
    };

    const onVisibility = () => startPolling();

    startPolling();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [step, gameMode]);

  // Step 2 -> Step 3 (Creates / Pre-configures the Lobby room)
  const handleConfigureRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalName = playerName.trim() || "Jogador 1";

    if (finalName.length > 18) {
      alert(t.lobby.nameTooLong);
      return;
    }

    if (gameMode === "online") {
      setIsConnecting(true);
      try {
        const result = isOnlineRoleHost
          ? await onlineApi.createRoom({
              name: finalName,
              avatar: selectedAvatar,
              color: selectedColor,
              maxPlayers,
              password: roomPassword.trim() || undefined,
              allowBots: allowBotsToggle,
              cardGame,
            })
          : await onlineApi.joinRoom({
              code: inputRoomCode.trim().toUpperCase(),
              name: finalName,
              avatar: selectedAvatar,
              color: selectedColor,
              password: joinPassword.trim() || undefined,
            });

        setOnlineSession(result.session);
        setRoomCode(result.lobby.code);
        setOnlineHostMemberId(result.lobby.hostMemberId);
        setLobbyPlayers(mapLobbyPlayersToGame(result.lobby.players));
        setStatusMessage(
          isOnlineRoleHost
            ? "Sala criada! Aguardando jogadores se conectarem..."
            : `Conectado à sala ${result.lobby.code}!`,
        );
        setStep("waiting_room");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao conectar na sala.");
      } finally {
        setIsConnecting(false);
      }
      return;
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);

    // Create the host player (user)
    const hostPlayer: Player = {
      id: `player-${generateId()}`,
      name: finalName,
      avatar: selectedAvatar,
      color: selectedColor,
      isBot: false,
      cards: [],
      phase: 1,
      hasLaidDownThisRound: false,
      score: 0,
      isSkipped: false,
    };

    const initialList: Player[] = [hostPlayer];

    // Populating based on Mode choice
    if (gameMode === "pass_and_play") {
      // Local Pass & Play Mode: create human players to fill up to maxPlayers
      const localHumansToCreate = maxPlayers - 1;
      const shuffledColors = COLORS.filter((c) => c !== selectedColor).sort(
        () => 0.5 - Math.random(),
      );

      for (let i = 0; i < localHumansToCreate; i++) {
        initialList.push({
          id: `player-local-${generateId()}`,
          name: `Jogador ${i + 2}`,
          avatar: encodeCharacterAvatar(randomCharacterConfig()),
          color: shuffledColors[i % shuffledColors.length] || "#a855f7",
          isBot: false,
          cards: [],
          phase: 1,
          hasLaidDownThisRound: false,
          score: 0,
          isSkipped: false,
        });
      }

      // Add a couple of Bots if allowBots is enabled
      if (allowBotsToggle && initialList.length < maxPlayers) {
        addBotToLobbyList(initialList, maxPlayers);
      }
    } else if (gameMode === "bots") {
      // Traditional VS Bots mode
      const botsToCreate = maxPlayers - 1;
      const shuffledBotNames = [...BOT_NAMES].sort(() => 0.5 - Math.random());
      const shuffledColors = COLORS.filter((c) => c !== selectedColor).sort(
        () => 0.5 - Math.random(),
      );

      for (let i = 0; i < botsToCreate; i++) {
        initialList.push({
          id: `bot-${generateId()}`,
          name: shuffledBotNames[i % shuffledBotNames.length],
          avatar: encodeCharacterAvatar(randomCharacterConfig()),
          color: shuffledColors[i % shuffledColors.length] || "#94a3b8",
          isBot: true,
          botDifficulty: i % 2 === 0 ? "medium" : "hard",
          cards: [],
          phase: 1,
          hasLaidDownThisRound: false,
          score: 0,
          isSkipped: false,
        });
      }
    } else {
      // ONLINE handled above via API
    }

    setLobbyPlayers(initialList);
    setStep("waiting_room");
  };

  // Helper to append a single bot to player list
  const addBotToLobbyList = (currentList: Player[], limit: number) => {
    if (currentList.length >= limit) return;

    const usedNames = currentList.map((p) => p.name);
    const availableName =
      BOT_NAMES.find((n) => !usedNames.includes(n)) || `Bot AI ${generateId()}`;

    const usedColors = currentList.map((p) => p.color);
    const col = COLORS.find((c) => !usedColors.includes(c)) || "#6b7280";

    const newBot: Player = {
      id: `bot-${generateId()}`,
      name: availableName,
      avatar: encodeCharacterAvatar(randomCharacterConfig()),
      color: col,
      isBot: true,
      botDifficulty: "medium",
      cards: [],
      phase: 1,
      hasLaidDownThisRound: false,
      score: 0,
      isSkipped: false,
    };

    currentList.push(newBot);
  };

  // Real-time online lobby via WebSocket
  useEffect(() => {
    if (step !== "waiting_room" || gameMode !== "online" || !onlineSession)
      return;

    const profile = {
      name: playerName,
      avatar: selectedAvatar,
      color: selectedColor,
    };

    connectOnlineSocket(onlineSession.sessionToken, {
      onLobbyUpdate: (lobby) => {
        setRoomCode(lobby.code);
        setAllowBotsToggle(lobby.allowBots);
        setOnlineHostMemberId(lobby.hostMemberId);
        setLobbyPlayers(mapLobbyPlayersToGame(lobby.players));
        if (lobby.cardGame) setCardGame(lobby.cardGame);
        setMaxPlayers(lobby.maxPlayers);
        const connected = lobby.players.filter((p) => p.isConnected).length;
        setStatusMessage(
          `Sala ${lobby.code}: ${lobby.players.length}/${lobby.maxPlayers} jogadores (${connected} online).`,
        );
      },
      onGameState: (room) => {
        const cardGameId =
          (room.settings as { cardGame?: typeof cardGame }).cardGame ?? cardGame;
        onStartGame({ cardGame: cardGameId, room, session: onlineSession } as ActiveGameState, profile);
      },
    });
  }, [step, gameMode, onlineSession?.sessionToken]);

  // Handle manual removal of player/bot from lobby slots (local modes only)
  const handleRemovePlayer = (id: string) => {
    setLobbyPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  // Handle manual adding of a BOT to Lobby list
  const handleAddManualBot = () => {
    if (lobbyPlayers.length >= maxPlayers) {
      alert(`A sala já atingiu o limite de ${maxPlayers} jogadores.`);
      return;
    }

    if (gameMode === "online") {
      if (!onlineSession?.isHost) {
        alert("Apenas o host pode adicionar bots.");
        return;
      }
      if (!allowBotsToggle) {
        alert("Bots não estão habilitados nesta sala.");
        return;
      }
      emitLobbyAddBot((result) => {
        if (result?.error) alert(result.error);
      });
      return;
    }

    const updated = [...lobbyPlayers];
    addBotToLobbyList(updated, maxPlayers);
    setLobbyPlayers(updated);
    setStatusMessage("Bot adicionado ao lobby.");
  };

  const handleLaunchGame = () => {
    if (!canLaunchGame(cardGame, lobbyPlayers.length)) {
      if (cardGame === "truco") {
        alert(t.lobby.minPlayersTruco);
      } else if (cardGame === "poker") {
        alert(t.lobby.minPlayersPoker);
      } else if (cardGame === "tower_master") {
        alert(t.lobby.minPlayersTower);
      } else {
        alert(t.lobby.minPlayersPhase10);
      }
      return;
    }

    if (gameMode === "online") {
      if (!onlineSession?.isHost) {
        alert("Apenas o host da sala pode iniciar a partida.");
        return;
      }
      emitGameStart((result) => {
        if (result?.error) {
          alert(result.error);
        }
      });
      return;
    }

    const profile: GamePlayerProfile = {
      name: playerName,
      avatar: selectedAvatar,
      color: selectedColor,
    };

    if (cardGame === "truco") {
      const trucoRoom = createInitialTrucoRoom(
        mapLobbyToTrucoPlayers(lobbyPlayers),
        roomCode || "TRUCO",
        lobbyPlayers[0]?.id || "",
        { gameMode, botDelay: botSpeed, cardGame: "truco" },
      );
      onStartGame({ cardGame: "truco", room: trucoRoom }, profile);
      return;
    }

    if (cardGame === "poker") {
      const pokerRoom = createInitialPokerRoom(
        mapLobbyToPokerPlayers(lobbyPlayers),
        roomCode || "POKER",
        lobbyPlayers[0]?.id || "",
        { gameMode, botDelay: botSpeed, cardGame: "poker" },
      );
      onStartGame({ cardGame: "poker", room: pokerRoom }, profile);
      return;
    }

    // Phase-style local modes
    const isTowerLaunch = cardGame === "tower_master";
    const launchPlayers = lobbyPlayers.map((player) => ({
      ...player,
      towerCharacterClass:
        player.towerCharacterClass ??
        (player.isBot ? pickRandomTowerCharacterClass() : undefined),
    }));

    const createdRoom: GameRoom = {
      id: `room-${generateId()}`,
      code: roomCode || "ROOMP10",
      hostId: lobbyPlayers[0]?.id || "",
      players: launchPlayers,
      status: isTowerLaunch ? "character_select" : "playing",
      maxPlayers,
      currentTurnIndex: 0,
      drawPile: [],
      discardPile: [],
      phaseSets: [],
      laidDownPhases: [],
      roundNumber: 1,
      winnerId: null,
      settings: {
        gameMode,
        botDelay: botSpeed,
        customPhases: false,
        allowBots: allowBotsToggle,
        cardGame,
      },
    };

    onStartGame({ cardGame, room: createdRoom }, profile);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      {onBackHome && step !== "waiting_room" && (
        <div className="mb-4">
          <button
            type="button"
            onClick={onBackHome}
            className="text-xs text-muted hover:text-secondary font-semibold underline"
          >
            ← {t.lobby.backHome}
          </button>
        </div>
      )}

      {/* 1. Header Title */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-secondary">
          {t.lobby.configureMatch}
        </h2>
      </div>

      {/* STEP 1: PLAYER PROFILE SETUP */}
      {step === "profile" && (
        <form
          onSubmit={handleConfirmProfile}
          className="panel p-6 space-y-6 max-w-xl mx-auto"
        >
          <div className="flex items-center justify-between border-b border-default pb-3">
            <h3 className="text-base font-semibold text-secondary flex items-center gap-2">
              <User className="w-5 h-5 text-accent" />
              <span>{t.lobby.yourProfile}</span>
            </h3>
            <button
              type="button"
              onClick={handleRandomizeProfile}
              className="text-xs text-muted hover:text-secondary flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t.lobby.random}</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                {t.lobby.playerName}
              </label>
              <input
                type="text"
                required
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={t.lobby.playerNamePlaceholder}
                className="w-full bg-app border border-default focus:border-accent rounded-lg px-4 py-3 text-primary placeholder:text-muted outline-none"
                maxLength={18}
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-muted mb-2">
                {t.lobby.createCharacter}
              </label>
              <CharacterCreator
                value={characterConfig}
                onChange={setCharacterConfig}
                themeColor={selectedColor}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                {t.lobby.themeColor}
              </label>
              <div className="flex flex-wrap gap-2 bg-surface-muted p-3 rounded-xl border border-default">
                {COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setSelectedColor(col)}
                    className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110 active:scale-95 shrink-0"
                    style={{
                      backgroundColor: col,
                      borderColor:
                        selectedColor === col ? "#ffffff" : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 btn-primary flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <span>{t.lobby.continue}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* STEP 2: ROOM SETUP / LOCAL VS ONLINE CHOICES */}
      {step === "room_setup" && (
        <form
          onSubmit={handleConfigureRoom}
          className="bg-surface border border-default rounded-2xl p-6 shadow-xl space-y-6 max-w-2xl mx-auto"
        >
          <div className="flex items-center justify-between border-b border-default pb-3">
            <h3 className="text-base font-bold text-secondary flex items-center space-x-2">
              <Laptop className="w-5 h-5 text-accent" />
              <span>{t.lobby.step2Title}</span>
            </h3>
            <button
              type="button"
              onClick={() => setStep("profile")}
              className="text-xs text-muted hover:text-secondary font-semibold underline"
            >
              {t.lobby.backToProfile}
            </button>
          </div>

          <div className="space-y-5">
            {/* Game mode selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2.5">
                {t.lobby.chooseGame}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setCardGame("phase10")}
                  className={`relative p-4 rounded-xl border flex flex-col text-left transition-all ${
                    cardGame === "phase10"
                      ? "bg-accent-soft border-accent text-secondary"
                      : "bg-surface-muted border-default text-muted hover:border-default"
                  }`}
                >
                  <span className="font-extrabold text-xs text-primary mb-1 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-accent" />
                    <span>{t.lobby.gamePhase10}</span>
                  </span>
                  <span className="text-[10px] leading-relaxed text-muted">
                    {t.lobby.gamePhase10Desc}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCardGame("truco")}
                  className={`relative p-4 rounded-xl border flex flex-col text-left transition-all ${
                    cardGame === "truco"
                      ? "bg-accent-soft border-accent text-secondary"
                      : "bg-surface-muted border-default text-muted hover:border-default"
                  }`}
                >
                  <span className="font-extrabold text-xs text-primary mb-1 flex items-center space-x-1.5">
                    <Swords className="w-3.5 h-3.5 text-accent" />
                    <span>{t.lobby.gameTruco}</span>
                  </span>
                  <span className="text-[10px] leading-relaxed text-muted">
                    {t.lobby.gameTrucoDesc}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCardGame("poker")}
                  className={`relative p-4 rounded-xl border flex flex-col text-left transition-all ${
                    cardGame === "poker"
                      ? "bg-accent-soft border-accent text-secondary"
                      : "bg-surface-muted border-default text-muted hover:border-default"
                  }`}
                >
                  <span className="font-extrabold text-xs text-primary mb-1 flex items-center space-x-1.5">
                    <Spade className="w-3.5 h-3.5 text-accent" />
                    <span>{t.lobby.gamePoker}</span>
                  </span>
                  <span className="text-[10px] leading-relaxed text-muted">
                    {t.lobby.gamePokerDesc}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleSelectTowerMaster}
                  className={`relative p-4 rounded-xl border flex flex-col text-left transition-all ${
                    cardGame === "tower_master"
                      ? "bg-accent-soft border-accent text-secondary"
                      : "bg-surface-muted border-default text-muted hover:border-default"
                  }`}
                >
                  <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-success-muted text-success border border-success">
                    MVP
                  </span>
                  <span className="font-extrabold text-xs text-primary mb-1 flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-accent" />
                    <span>{t.lobby.gameTower}</span>
                  </span>
                  <span className="text-[10px] leading-relaxed">
                    {t.lobby.gameTowerDesc}
                  </span>
                </button>
              </div>
            </div>

            {/* Multiplayer Choice Row */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2.5">
                Escolha o Tipo de Conexão
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Traditional Bot mode */}
                <button
                  type="button"
                  onClick={() => setGameMode("bots")}
                  className={`p-4 rounded-xl border flex flex-col text-left transition-all ${
                    gameMode === "bots"
                      ? "bg-accent-soft border-accent text-secondary"
                      : "bg-surface-muted border-default text-muted hover:border-default"
                  }`}
                >
                  <span className="font-extrabold text-xs block text-primary mb-1 flex items-center space-x-1.5">
                    <Bot className="w-3.5 h-3.5 text-accent" />
                    <span>Contra bots</span>
                  </span>
                  <span className="text-[10px] leading-relaxed text-muted">
                    Treine sozinho contra oponentes automáticos.
                  </span>
                </button>

                {/* Local multiplayer */}
                <button
                  type="button"
                  onClick={() => setGameMode("pass_and_play")}
                  className={`p-4 rounded-xl border flex flex-col text-left transition-all ${
                    gameMode === "pass_and_play"
                      ? "bg-accent-soft/30 border-accent text-secondary"
                      : "bg-surface-muted border-default text-muted hover:border-default"
                  }`}
                >
                  <span className="font-extrabold text-xs block text-primary mb-1 flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-accent" />
                    <span>Multiplayer Local</span>
                  </span>
                  <span className="text-[10px] leading-relaxed">
                    Passar e Jogar dividindo a mesma tela em turnos secretos
                    seguros.
                  </span>
                </button>

                {/* Online simulated multiplayer */}
                <button
                  type="button"
                  onClick={() => setGameMode("online")}
                  className={`p-4 rounded-xl border flex flex-col text-left transition-all ${
                    gameMode === "online"
                      ? "bg-success-muted/30 border-success text-success"
                      : "bg-surface-muted border-default text-muted hover:border-default"
                  }`}
                >
                  <span className="font-extrabold text-xs block text-primary mb-1 flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-success animate-spin-slow" />
                    <span>Multiplayer Online</span>
                  </span>
                  <span className="text-[10px] leading-relaxed">
                    Crie ou conecte-se a salas online em servidores simulados ao
                    vivo.
                  </span>
                </button>
              </div>
            </div>

            {/* If Online, allow Host vs Join code */}
            {gameMode === "online" && (
              <div className="bg-surface-muted border border-default p-4 rounded-xl space-y-3.5">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsOnlineRoleHost(true)}
                    className={`flex-1 py-2 font-bold text-xs rounded-lg border transition-all ${
                      isOnlineRoleHost
                        ? "bg-emerald-600/20 border-success text-success"
                        : "bg-surface border-default text-muted hover:text-secondary"
                    }`}
                  >
                    Host: Criar Nova Sala Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOnlineRoleHost(false)}
                    className={`flex-1 py-2 font-bold text-xs rounded-lg border transition-all ${
                      !isOnlineRoleHost
                        ? "bg-emerald-600/20 border-success text-success"
                        : "bg-surface border-default text-muted hover:text-secondary"
                    }`}
                  >
                    Entrar em Sala via Código
                  </button>
                </div>

                {!isOnlineRoleHost && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold uppercase text-muted">
                      Código de Convite da Sala
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: F1B6A2"
                      value={inputRoomCode}
                      onChange={(e) =>
                        setInputRoomCode(
                          e.target.value.replace(/[^a-zA-Z0-9]/g, ""),
                        )
                      }
                      className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary uppercase outline-none focus:border-success"
                      maxLength={6}
                    />
                    <label className="block text-[10px] font-extrabold uppercase text-muted mt-2">
                      Senha da Sala (se houver)
                    </label>
                    <input
                      type="password"
                      placeholder="Senha opcional"
                      value={joinPassword}
                      onChange={(e) => setJoinPassword(e.target.value)}
                      className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-success"
                      maxLength={32}
                    />
                  </div>
                )}

                {isOnlineRoleHost && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold uppercase text-muted">
                      Senha da Sala (opcional)
                    </label>
                    <input
                      type="password"
                      placeholder="Deixe vazio para sala pública"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-success"
                      maxLength={32}
                    />
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  <label className="block text-[10px] font-extrabold uppercase text-muted">
                    Salas abertas no servidor
                  </label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {publicRooms.length === 0 ? (
                      <p className="text-[10px] text-muted">
                        Nenhuma sala ativa no momento.
                      </p>
                    ) : (
                      publicRooms.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setIsOnlineRoleHost(false);
                            setInputRoomCode(r.code);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg bg-surface border border-default hover:border-success text-xs flex justify-between"
                        >
                          <span className="font-mono text-success">
                            {r.code}
                          </span>
                          <span className="text-muted">
                            {r.cardGame ? `${r.cardGame} · ` : ''}
                            {r.playerCount}/{r.maxPlayers}{" "}
                            {r.hasPassword ? "🔒" : ""}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Global Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Max players select */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Capacidade da Sala ({maxPlayers} Jogadores)
                </label>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                  disabled={cardGame === "truco"}
                  className="w-full bg-surface-muted border border-default rounded-xl px-4 py-2.5 text-sm text-secondary outline-none disabled:opacity-60"
                >
                  {cardGame === "truco" ? (
                    <option value={4}>4 Jogadores (Truco)</option>
                  ) : cardGame === "poker" ? (
                    <>
                      <option value={2}>2 Jogadores</option>
                      <option value={3}>3 Jogadores</option>
                      <option value={4}>4 Jogadores</option>
                      <option value={5}>5 Jogadores</option>
                      <option value={6}>6 Jogadores</option>
                    </>
                  ) : cardGame === "tower_master" ? (
                    <>
                      <option value={2}>2 Jogadores (Mínimo)</option>
                      <option value={3}>3 Jogadores</option>
                      <option value={4}>4 Jogadores</option>
                      <option value={5}>5 Jogadores</option>
                      <option value={6}>6 Jogadores</option>
                      <option value={7}>7 Jogadores</option>
                      <option value={8}>8 Jogadores</option>
                      <option value={9}>9 Jogadores</option>
                      <option value={10}>10 Jogadores (Máximo)</option>
                    </>
                  ) : (
                    <>
                      <option value={3}>3 Jogadores (Mínimo)</option>
                      <option value={4}>4 Jogadores</option>
                      <option value={5}>5 Jogadores</option>
                      <option value={6}>6 Jogadores</option>
                      <option value={7}>7 Jogadores</option>
                      <option value={8}>8 Jogadores</option>
                      <option value={9}>9 Jogadores</option>
                      <option value={10}>10 Jogadores (Máximo)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Bot Delay or Toggle Bots */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Configuração de Bots (IA)
                </label>
                <div className="bg-surface-muted border border-default rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-4 h-4 text-accent" />
                    <div>
                      <span className="text-xs font-bold text-secondary block">
                        Adicionar Bots
                      </span>
                      <span className="text-[10px] text-muted">
                        Preencher vagas vazias
                      </span>
                    </div>
                  </div>

                  {/* Slider checkbox custom toggle */}
                  <button
                    type="button"
                    onClick={() => setAllowBotsToggle(!allowBotsToggle)}
                    className={`w-12 h-6 rounded-full p-0.5 transition-colors relative flex items-center ${
                      allowBotsToggle ? "bg-accent" : "bg-surface-raised"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                        allowBotsToggle ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Speed slider for bots if allowed */}
            {allowBotsToggle && gameMode !== "pass_and_play" && (
              <div className="bg-surface-muted border border-default p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-secondary block">
                    Velocidade de Inteligência (Bots)
                  </span>
                  <span className="text-[10px] text-muted">
                    Tempo de raciocínio da máquina
                  </span>
                </div>
                <select
                  value={botSpeed}
                  onChange={(e) => setBotSpeed(parseInt(e.target.value))}
                  className="bg-surface border border-default rounded-lg px-3 py-1.5 text-xs font-bold text-secondary"
                >
                  <option value={2000}>Super Calmo (2.0s)</option>
                  <option value={600}>Moderado (0.6s)</option>
                  <option value={1200}>Lento (1.2s)</option>
                  <option value={200}>Instantâneo (0.2s)</option>
                </select>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full py-4 btn-primary disabled:opacity-50 text-sm font-semibold uppercase"
          >
            {isConnecting ? "Conectando..." : "Avançar para Lobby de Espera ➔"}
          </button>
        </form>
      )}

      {/* STEP 3: INTERACTIVE WAITING ROOM / ADD-REMOVE BOTS BOARD */}
      {step === "waiting_room" && (
        <div className="bg-surface border border-default rounded-2xl p-6 shadow-xl max-w-3xl mx-auto space-y-6">
          {/* Header waiting summary */}
          <div className="border-b border-default pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-accent bg-accent-soft border border-accent px-2 py-0.5 rounded-full">
                Lobby do Jogo
              </span>
              <h3 className="text-xl font-extrabold text-primary flex items-center space-x-2">
                <span>Vagas no Lobby:</span>
                <span className="text-accent font-mono">
                  {lobbyPlayers.length}/{maxPlayers}
                </span>
              </h3>
            </div>

            <div className="flex items-center space-x-3 text-xs bg-surface-muted border border-default p-2.5 rounded-xl">
              <div>
                <span className="text-muted block uppercase font-bold text-[9px]">
                  Código da Sala
                </span>
                <span className="text-sm font-black text-success tracking-wider font-mono">
                  {roomCode}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyRoomCode}
                className="p-1 hover:bg-surface border border-default rounded-lg text-muted hover:text-primary"
                title={roomCodeCopied ? "Copiado!" : "Copiar Código"}
              >
                {roomCodeCopied ? (
                  <CopyCheck className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4 text-muted" />
                )}
              </button>
            </div>
          </div>

          {/* Connected Network Status Toast */}
          <div className="bg-accent-soft border border-accent p-3 rounded-xl flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
            <p className="text-[11px] text-primary font-medium">
              {statusMessage}
            </p>
          </div>

          {cardGame === "tower_master" && (
            <div className="bg-surface-muted border border-default rounded-xl p-4 space-y-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-secondary">
                  Sua classe (Mestre da Torre)
                </h4>
                <p className="text-[10px] text-muted mt-1">
                  Escolha agora ou na tela antes da partida (pass-and-play). Bots recebem classe aleatória.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {TOWER_CHARACTER_CLASSES.map((character) => {
                  const localPlayerId =
                    gameMode === "online" && onlineSession
                      ? onlineSession.memberId
                      : lobbyPlayers[0]?.id;
                  const localPlayer = lobbyPlayers.find((p) => p.id === localPlayerId);
                  const isSelected = localPlayer?.towerCharacterClass === character.id;
                  return (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => {
                        if (!localPlayerId) return;
                        setLobbyPlayers((prev) =>
                          prev.map((player) =>
                            player.id === localPlayerId
                              ? { ...player, towerCharacterClass: character.id as TowerCharacterClass }
                              : player,
                          ),
                        );
                      }}
                      className={`tower-class-card tower-class-card--compact text-left ${
                        isSelected ? "tower-class-card--selected" : ""
                      }`}
                    >
                      <div className="tower-class-card__art tower-class-card__art--compact">
                        <img src={character.imageSrc} alt="" draggable={false} />
                      </div>
                      <span className="tower-class-card__name">{character.name}</span>
                    </button>
                  );
                })}
              </div>
              {(() => {
                const localPlayerId =
                  gameMode === "online" && onlineSession
                    ? onlineSession.memberId
                    : lobbyPlayers[0]?.id;
                const selectedClass = lobbyPlayers.find((p) => p.id === localPlayerId)
                  ?.towerCharacterClass;
                const classInfo = selectedClass ? getTowerCharacterInfo(selectedClass) : null;
                if (!classInfo) return null;
                return (
                  <div className="tower-class-detail">
                    <h5 className="tower-class-detail__name">{classInfo.name}</h5>
                    <p className="tower-class-detail__line">
                      <span className="tower-class-detail__label">Passiva</span>
                      {classInfo.passive}
                    </p>
                    <p className="tower-class-detail__line">
                      <span className="tower-class-detail__label">Exclusivo</span>
                      {classInfo.exclusive}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Active players grid representation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {lobbyPlayers.map((p, idx) => (
              <div
                key={p.id}
                className="bg-surface-muted border border-default p-3 rounded-xl flex items-center justify-between"
                style={{ borderLeft: `3px solid ${p.color}` }}
              >
                <div className="flex items-center space-x-3">
                  <div className="text-2xl w-10 h-10 rounded-full bg-surface border border-default flex items-center justify-center">
                    <PlayerAvatar
                      avatar={p.avatar}
                      color={p.color}
                      size={36}
                      isBot={p.isBot}
                    />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-primary block truncate max-w-[150px]">
                      {p.name}{" "}
                      {(gameMode === "online"
                        ? p.id === onlineHostMemberId
                        : idx === 0) && (
                        <span className="text-[9px] bg-accent-soft border border-accent text-accent px-1 rounded ml-1 uppercase font-bold">
                          Host
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted font-medium uppercase block flex items-center gap-1 flex-wrap">
                      {p.isBot ? (
                        <>
                          <Bot className="w-3 h-3" /> Bot
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3" /> Humano
                        </>
                      )}
                      {cardGame === "tower_master" && p.towerCharacterClass && (
                        <TowerCharacterBadge classId={p.towerCharacterClass} compact />
                      )}
                      {gameMode === "online" && !p.isBot && p.id !== onlineHostMemberId && (
                        <span
                          className={`text-[9px] font-bold uppercase ${
                            p.isReady ? "text-success" : "text-muted"
                          }`}
                        >
                          {p.isReady ? "Pronto" : "Aguardando"}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Kick/Remove control buttons. First index is client/host (cannot remove self) */}
                {idx > 0 && gameMode !== "online" && (
                  <button
                    onClick={() => handleRemovePlayer(p.id)}
                    className="p-1.5 hover:bg-danger-muted/30 border border-default hover:border-danger rounded-lg text-muted hover:text-danger transition-all cursor-pointer"
                    title="Remover Slot"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {/* Empty Slots placeholder representation */}
            {Array.from({
              length: Math.max(0, maxPlayers - lobbyPlayers.length),
            }).map((_, i) => (
              <div
                key={i}
                className="bg-surface-raised border border-dashed border-default p-3 rounded-xl flex items-center justify-between text-muted"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full border border-dashed border-default flex items-center justify-center text-sm">
                    ?
                  </div>
                  <div className="leading-tight">
                    <span className="text-xs font-bold text-muted block">
                      Vaga Disponível
                    </span>
                    <span className="text-[9px] font-semibold text-muted uppercase block">
                      Lobby aberto
                    </span>
                  </div>
                </div>

                {/* Trigger to manually add a bot to this spot if bots are allowed */}
                {allowBotsToggle && (
                  <button
                    onClick={handleAddManualBot}
                    className="px-2.5 py-1.5 bg-surface-raised hover:bg-surface-muted border border-default hover:border-accent rounded-lg text-[10px] font-extrabold text-secondary hover:text-primary transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>BOT AI</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Warning / Suggestion banner */}
          {gameMode === "online" &&
            canLaunchGame(cardGame, lobbyPlayers.length) &&
            onlineSession?.isHost &&
            !allNonHostHumansReady(lobbyPlayers, onlineHostMemberId) && (
              <div className="bg-accent-soft border border-accent/30 p-3 rounded-lg text-center text-xs text-accent flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Aguardando todos os jogadores marcarem Pronto.</span>
              </div>
            )}

          {!canLaunchGame(cardGame, lobbyPlayers.length) && (
            <div className="bg-danger-muted border border-danger p-3 rounded-lg text-center text-xs text-danger flex items-center justify-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {cardGame === "truco"
                  ? t.lobby.minPlayersTruco
                  : cardGame === "poker"
                    ? t.lobby.minPlayersPoker
                    : cardGame === "tower_master"
                      ? t.lobby.minPlayersTower
                      : t.lobby.minPlayersPhase10}
              </span>
            </div>
          )}

          {/* Lobby Controller Actions Footer */}
          <div className="border-t border-default pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              onClick={() => {
                if (gameMode === "online") {
                  emitRoomLeave();
                  setOnlineSession(null);
                }
                setLobbyPlayers([]);
                setStep("room_setup");
              }}
              className="px-5 py-2.5 bg-surface-raised hover:bg-surface-muted text-secondary font-bold text-xs rounded-xl cursor-pointer"
            >
              Cancelar Sala
            </button>

            <div className="flex items-center gap-3">
              {gameMode === "online" && onlineSession && !onlineSession.isHost && (
                <button
                  type="button"
                  onClick={() => {
                    const nextReady = !lobbyPlayers.find((p) => p.id === onlineSession.memberId)?.isReady;
                    emitLobbySetReady(nextReady, (result) => {
                      if (result?.error) alert(result.error);
                    });
                  }}
                  className={`px-6 py-3.5 rounded-xl font-black text-sm tracking-wider uppercase transition-all flex items-center space-x-2 cursor-pointer ${
                    lobbyPlayers.find((p) => p.id === onlineSession.memberId)?.isReady
                      ? "bg-surface-raised text-secondary border border-default hover:bg-surface-muted"
                      : "btn-primary"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {lobbyPlayers.find((p) => p.id === onlineSession.memberId)?.isReady
                      ? "CANCELAR PRONTO"
                      : "PRONTO"}
                  </span>
                </button>
              )}

              <button
                onClick={handleLaunchGame}
                disabled={
                  !canLaunchGame(cardGame, lobbyPlayers.length) ||
                  (gameMode === "online" &&
                    (!onlineSession?.isHost ||
                      !allNonHostHumansReady(lobbyPlayers, onlineHostMemberId)))
                }
                className={`px-8 py-3.5 rounded-xl font-black text-sm tracking-wider uppercase transition-all flex items-center space-x-2 ${
                  canLaunchGame(cardGame, lobbyPlayers.length) &&
                  (gameMode !== "online" ||
                    (onlineSession?.isHost &&
                      allNonHostHumansReady(lobbyPlayers, onlineHostMemberId)))
                    ? "btn-primary cursor-pointer"
                    : "bg-surface-raised text-muted border border-default cursor-not-allowed"
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {gameMode === "online" && !onlineSession?.isHost
                    ? "AGUARDANDO HOST"
                    : gameMode === "online" &&
                        onlineSession?.isHost &&
                        !allNonHostHumansReady(lobbyPlayers, onlineHostMemberId)
                      ? "AGUARDANDO PRONTOS"
                      : "INICIAR PARTIDA"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
