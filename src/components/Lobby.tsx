import React, { useState, useEffect } from 'react';
import { 
  Users, User, Play, RefreshCw, 
  Globe, Laptop, Plus, Trash2, Bot, ArrowRight, CheckCircle2, AlertCircle
} from 'lucide-react';
import { GameRoom, Player } from '../types';
import { generateId } from '../gameEngine';
import { onlineApi, LobbyPlayer, PublicRoom, RoomSession } from '../services/onlineApi';
import { connectOnlineSocket, emitGameStart, emitLobbyAddBot, emitRoomLeave } from '../services/onlineSocket';
import { AVATAR_OPTIONS, DEFAULT_AVATAR_ID } from '../lib/avatars';
import { PlayerAvatar } from './PlayerAvatar';

interface LobbyProps {
  onStartGame: (
    room: GameRoom,
    playerProfile: { name: string; avatar: string; color: string },
    session?: RoomSession | null,
  ) => void;
}

const AVATARS = AVATAR_OPTIONS;

const COLORS = [
  '#f87171', // red
  '#fbbf24', // yellow
  '#34d399', // green
  '#60a5fa', // blue
  '#c084fc', // purple
  '#f472b6', // pink
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#a3e635', // lime
  '#f43f5e', // rose
  '#818cf8', // indigo
  '#14b8a6', // cyan
  '#eab308', // amber
  '#ec4899', // magenta
];

const BOT_NAMES = [
  'Arthur Bot', 'Beatriz AI', 'Caio Bot', 'Diana AI', 'Enzo Bot', 
  'Fernanda AI', 'Gabriel Bot', 'Helena AI', 'Igor Bot', 'Julia AI'
];

export const Lobby: React.FC<LobbyProps> = ({ onStartGame }) => {
  // Mode options
  const [step, setStep] = useState<'profile' | 'room_setup' | 'waiting_room'>('profile');
  
  // Profile settings
  const [playerName, setPlayerName] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(DEFAULT_AVATAR_ID);
  const [selectedColor, setSelectedColor] = useState<string>('#60a5fa');

  // Room Settings
  const [gameMode, setGameMode] = useState<'bots' | 'pass_and_play' | 'online'>('bots');
  const [isOnlineRoleHost, setIsOnlineRoleHost] = useState<boolean>(true); // Host vs Join Code
  const [inputRoomCode, setInputRoomCode] = useState<string>('');
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [botSpeed, setBotSpeed] = useState<number>(600); // ms delay
  const [allowBotsToggle, setAllowBotsToggle] = useState<boolean>(true);
  const [roomPassword, setRoomPassword] = useState<string>('');
  const [joinPassword, setJoinPassword] = useState<string>('');

  // Online multiplayer state
  const [onlineSession, setOnlineSession] = useState<RoomSession | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  // Waiting Room state (holds active players in the lobby before starting)
  const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([]);
  const [roomCode, setRoomCode] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Auto-generate random name/profile info initially
  useEffect(() => {
    handleRandomizeProfile();
  }, []);

  const handleRandomizeProfile = () => {
    const names = ['Mestre_Phase', 'Curinga_Louco', 'Rei_das_Trincas', 'Sequência_Master', 'Descarte_Ninja', 'Sortudo'];
    const randomName = names[Math.floor(Math.random() * names.length)] + '_' + Math.floor(Math.random() * 90 + 10);
    setPlayerName(randomName);
    setSelectedAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)].id);
    setSelectedColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  };

  // Step 1 -> Step 2
  const handleConfirmProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('room_setup');
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
    }));

  // Load public rooms when online mode is selected (pauses when tab is hidden)
  useEffect(() => {
    if (step !== 'room_setup' || gameMode !== 'online') return;

    let interval: ReturnType<typeof setInterval>;

    const refresh = () => {
      onlineApi.listRooms().then(setPublicRooms).catch(() => setPublicRooms([]));
    };

    const startPolling = () => {
      refresh();
      clearInterval(interval);
      interval = setInterval(refresh, document.hidden ? 15000 : 8000);
    };

    const onVisibility = () => startPolling();

    startPolling();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [step, gameMode]);

  // Step 2 -> Step 3 (Creates / Pre-configures the Lobby room)
  const handleConfigureRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalName = playerName.trim() || 'Jogador 1';

    if (gameMode === 'online') {
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
        setLobbyPlayers(mapLobbyPlayersToGame(result.lobby.players));
        setStatusMessage(
          isOnlineRoleHost
            ? 'Sala criada! Aguardando jogadores se conectarem...'
            : `Conectado à sala ${result.lobby.code}!`,
        );
        setStep('waiting_room');
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erro ao conectar na sala.');
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
    if (gameMode === 'pass_and_play') {
      // Local Pass & Play Mode: create human players to fill up to maxPlayers
      const localHumansToCreate = maxPlayers - 1;
      const shuffledAvatars = AVATARS.filter(a => a.id !== selectedAvatar).sort(() => 0.5 - Math.random());
      const shuffledColors = COLORS.filter(c => c !== selectedColor).sort(() => 0.5 - Math.random());

      for (let i = 0; i < localHumansToCreate; i++) {
        initialList.push({
          id: `player-local-${generateId()}`,
          name: `Jogador ${i + 2}`,
          avatar: shuffledAvatars[i % shuffledAvatars.length]?.id || DEFAULT_AVATAR_ID,
          color: shuffledColors[i % shuffledColors.length] || '#a855f7',
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
    } else if (gameMode === 'bots') {
      // Traditional VS Bots mode
      const botsToCreate = maxPlayers - 1;
      const shuffledBotNames = [...BOT_NAMES].sort(() => 0.5 - Math.random());
      const shuffledAvatars = AVATARS.filter(a => a.id !== selectedAvatar).sort(() => 0.5 - Math.random());
      const shuffledColors = COLORS.filter(c => c !== selectedColor).sort(() => 0.5 - Math.random());

      for (let i = 0; i < botsToCreate; i++) {
        initialList.push({
          id: `bot-${generateId()}`,
          name: shuffledBotNames[i % shuffledBotNames.length],
          avatar: shuffledAvatars[i % shuffledAvatars.length]?.id || DEFAULT_AVATAR_ID,
          color: shuffledColors[i % shuffledColors.length] || '#94a3b8',
          isBot: true,
          botDifficulty: i % 2 === 0 ? 'medium' : 'hard',
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
    setStep('waiting_room');
  };

  // Helper to append a single bot to player list
  const addBotToLobbyList = (currentList: Player[], limit: number) => {
    if (currentList.length >= limit) return;
    
    const usedNames = currentList.map(p => p.name);
    const availableName = BOT_NAMES.find(n => !usedNames.includes(n)) || `Bot AI ${generateId()}`;
    
    const usedAvatars = currentList.map(p => p.avatar);
    const av = AVATARS.find(a => !usedAvatars.includes(a.id))?.id || DEFAULT_AVATAR_ID;
    
    const usedColors = currentList.map(p => p.color);
    const col = COLORS.find(c => !usedColors.includes(c)) || '#6b7280';

    const newBot: Player = {
      id: `bot-${generateId()}`,
      name: availableName,
      avatar: av,
      color: col,
      isBot: true,
      botDifficulty: 'medium',
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
    if (step !== 'waiting_room' || gameMode !== 'online' || !onlineSession) return;

    const profile = { name: playerName, avatar: selectedAvatar, color: selectedColor };

    connectOnlineSocket(onlineSession.sessionToken, {
      onLobbyUpdate: (lobby) => {
        setRoomCode(lobby.code);
        setAllowBotsToggle(lobby.allowBots);
        setLobbyPlayers(mapLobbyPlayersToGame(lobby.players));
        const connected = lobby.players.filter((p) => p.isConnected).length;
        setStatusMessage(
          `Sala ${lobby.code}: ${lobby.players.length}/${lobby.maxPlayers} jogadores (${connected} online).`,
        );
      },
      onGameState: (room) => {
        onStartGame(room, profile, onlineSession);
      },
    });
  }, [step, gameMode, onlineSession?.sessionToken]);

  // Handle manual removal of player/bot from lobby slots (local modes only)
  const handleRemovePlayer = (id: string) => {
    setLobbyPlayers(prev => prev.filter(p => p.id !== id));
  };

  // Handle manual adding of a BOT to Lobby list
  const handleAddManualBot = () => {
    if (lobbyPlayers.length >= maxPlayers) {
      alert(`A sala já atingiu o limite de ${maxPlayers} jogadores.`);
      return;
    }

    if (gameMode === 'online') {
      if (!onlineSession?.isHost) {
        alert('Apenas o host pode adicionar bots.');
        return;
      }
      if (!allowBotsToggle) {
        alert('Bots não estão habilitados nesta sala.');
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
    setStatusMessage('Bot adicionado ao lobby.');
  };

  const handleLaunchGame = () => {
    if (lobbyPlayers.length < 3) {
      alert("O Phase 10 requer no mínimo 3 jogadores para iniciar.");
      return;
    }

    if (gameMode === 'online') {
      if (!onlineSession?.isHost) {
        alert('Apenas o host da sala pode iniciar a partida.');
        return;
      }
      emitGameStart((result) => {
        if (result?.error) {
          alert(result.error);
        }
      });
      return;
    }

    // Load custom settings (local modes)
    const createdRoom: GameRoom = {
      id: `room-${generateId()}`,
      code: roomCode || 'ROOMP10',
      hostId: lobbyPlayers[0]?.id || '',
      players: lobbyPlayers,
      status: 'playing',
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
        allowBots: allowBotsToggle
      }
    };

    onStartGame(createdRoom, { name: playerName, avatar: selectedAvatar, color: selectedColor });
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      
      {/* 1. Header Title */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-secondary">Configurar partida</h2>
      </div>

      {/* STEP 1: PLAYER PROFILE SETUP */}
      {step === 'profile' && (
        <form onSubmit={handleConfirmProfile} className="panel p-6 space-y-6 max-w-xl mx-auto">
          <div className="flex items-center justify-between border-b border-default pb-3">
            <h3 className="text-base font-semibold text-secondary flex items-center gap-2">
              <User className="w-5 h-5 text-accent" />
              <span>Seu perfil</span>
            </h3>
            <button
              type="button"
              onClick={handleRandomizeProfile}
              className="text-xs text-muted hover:text-secondary flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Aleatório</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                Seu Nome de Jogador
              </label>
              <input
                type="text"
                required
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ex: Pedro, Marta_Sets..."
                className="w-full bg-app border border-default focus:border-accent rounded-lg px-4 py-3 text-primary placeholder:text-muted outline-none"
                maxLength={18}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-muted mb-2">
                  Ícone do jogador
                </label>
                <div className="grid grid-cols-5 gap-2 bg-app p-2 rounded-lg border border-default">
                  {AVATARS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setSelectedAvatar(av.id)}
                      className={`p-1.5 rounded-lg flex items-center justify-center ${
                        selectedAvatar === av.id
                          ? 'bg-accent-soft/50 border border-accent'
                          : 'border border-transparent hover:bg-surface'
                      }`}
                      title={av.label}
                    >
                      <PlayerAvatar avatar={av.id} color={selectedColor} size={32} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Sua Cor do Tema
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
                        borderColor: selectedColor === col ? '#ffffff' : 'transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 btn-primary flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <span>Continuar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* STEP 2: ROOM SETUP / LOCAL VS ONLINE CHOICES */}
      {step === 'room_setup' && (
        <form onSubmit={handleConfigureRoom} className="bg-surface border border-default rounded-2xl p-6 shadow-xl space-y-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-between border-b border-default pb-3">
            <h3 className="text-base font-bold text-secondary flex items-center space-x-2">
              <Laptop className="w-5 h-5 text-accent" />
              <span>Passo 2: Opções de Rede e Conectividade</span>
            </h3>
            <button
              type="button"
              onClick={() => setStep('profile')}
              className="text-xs text-muted hover:text-secondary font-semibold underline"
            >
              Voltar ao Perfil
            </button>
          </div>

          <div className="space-y-5">
            
            {/* Multiplayer Choice Row */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2.5">
                Escolha o Tipo de Conexão
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* Traditional Bot mode */}
                <button
                  type="button"
                  onClick={() => setGameMode('bots')}
                  className={`p-4 rounded-xl border flex flex-col text-left transition-all ${
                    gameMode === 'bots'
                      ? 'bg-accent-soft border-accent text-secondary'
                      : 'bg-surface-muted border-default text-muted hover:border-default'
                  }`}
                >
                  <span className="font-extrabold text-xs block text-primary mb-1 flex items-center space-x-1.5">
                    <Bot className="w-3.5 h-3.5 text-accent" />
                    <span>Contra bots</span>
                  </span>
                  <span className="text-[10px] leading-relaxed text-muted">Treine sozinho contra oponentes automáticos.</span>
                </button>

                {/* Local multiplayer */}
                <button
                  type="button"
                  onClick={() => setGameMode('pass_and_play')}
                  className={`p-4 rounded-xl border flex flex-col text-left transition-all ${
                    gameMode === 'pass_and_play'
                      ? 'bg-accent-soft/30 border-accent text-secondary'
                      : 'bg-surface-muted border-default text-muted hover:border-default'
                  }`}
                >
                  <span className="font-extrabold text-xs block text-primary mb-1 flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-accent" />
                    <span>Multiplayer Local</span>
                  </span>
                  <span className="text-[10px] leading-relaxed">Passar e Jogar dividindo a mesma tela em turnos secretos seguros.</span>
                </button>

                {/* Online simulated multiplayer */}
                <button
                  type="button"
                  onClick={() => setGameMode('online')}
                  className={`p-4 rounded-xl border flex flex-col text-left transition-all ${
                    gameMode === 'online'
                      ? 'bg-success-muted/30 border-success text-success'
                      : 'bg-surface-muted border-default text-muted hover:border-default'
                  }`}
                >
                  <span className="font-extrabold text-xs block text-primary mb-1 flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-success animate-spin-slow" />
                    <span>Multiplayer Online</span>
                  </span>
                  <span className="text-[10px] leading-relaxed">Crie ou conecte-se a salas online em servidores simulados ao vivo.</span>
                </button>

              </div>
            </div>

            {/* If Online, allow Host vs Join code */}
            {gameMode === 'online' && (
              <div className="bg-surface-muted border border-default p-4 rounded-xl space-y-3.5">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsOnlineRoleHost(true)}
                    className={`flex-1 py-2 font-bold text-xs rounded-lg border transition-all ${
                      isOnlineRoleHost
                        ? 'bg-emerald-600/20 border-success text-success'
                        : 'bg-surface border-default text-muted hover:text-secondary'
                    }`}
                  >
                    Host: Criar Nova Sala Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOnlineRoleHost(false)}
                    className={`flex-1 py-2 font-bold text-xs rounded-lg border transition-all ${
                      !isOnlineRoleHost
                        ? 'bg-emerald-600/20 border-success text-success'
                        : 'bg-surface border-default text-muted hover:text-secondary'
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
                      onChange={(e) => setInputRoomCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
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
                      <p className="text-[10px] text-muted">Nenhuma sala ativa no momento.</p>
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
                          <span className="font-mono text-success">{r.code}</span>
                          <span className="text-muted">
                            {r.playerCount}/{r.maxPlayers} {r.hasPassword ? '🔒' : ''}
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
                  className="w-full bg-surface-muted border border-default rounded-xl px-4 py-2.5 text-sm text-secondary outline-none"
                >
                  <option value={3}>3 Jogadores (Mínimo)</option>
                  <option value={4}>4 Jogadores</option>
                  <option value={5}>5 Jogadores</option>
                  <option value={6}>6 Jogadores</option>
                  <option value={7}>7 Jogadores</option>
                  <option value={8}>8 Jogadores</option>
                  <option value={9}>9 Jogadores</option>
                  <option value={10}>10 Jogadores (Máximo)</option>
                </select>
              </div>

              {/* Bot Delay or Toggle Bots */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                  Configuração de Bots (Inteligência Artificial)
                </label>
                <div className="bg-surface-muted border border-default rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-4 h-4 text-accent" />
                    <div>
                      <span className="text-xs font-bold text-secondary block">Adicionar Bots</span>
                      <span className="text-[10px] text-muted">Preencher vagas vazias</span>
                    </div>
                  </div>
                  
                  {/* Slider checkbox custom toggle */}
                  <button
                    type="button"
                    onClick={() => setAllowBotsToggle(!allowBotsToggle)}
                    className={`w-12 h-6 rounded-full p-0.5 transition-colors relative flex items-center ${
                      allowBotsToggle ? 'bg-accent' : 'bg-surface-raised'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                      allowBotsToggle ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

            </div>

            {/* Speed slider for bots if allowed */}
            {allowBotsToggle && gameMode !== 'pass_and_play' && (
              <div className="bg-surface-muted border border-default p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-secondary block">Velocidade de Inteligência (Bots)</span>
                  <span className="text-[10px] text-muted">Tempo de raciocínio da máquina</span>
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
            {isConnecting ? 'Conectando...' : 'Avançar para Lobby de Espera ➔'}
          </button>
        </form>
      )}

      {/* STEP 3: INTERACTIVE WAITING ROOM / ADD-REMOVE BOTS BOARD */}
      {step === 'waiting_room' && (
        <div className="bg-surface border border-default rounded-2xl p-6 shadow-xl max-w-3xl mx-auto space-y-6">
          
          {/* Header waiting summary */}
          <div className="border-b border-default pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-accent bg-accent-soft border border-accent px-2 py-0.5 rounded-full">
                Lobby do Jogo
              </span>
              <h3 className="text-xl font-extrabold text-primary flex items-center space-x-2">
                <span>Vagas no Lobby:</span>
                <span className="text-accent font-mono">{lobbyPlayers.length}/{maxPlayers}</span>
              </h3>
            </div>

            <div className="flex items-center space-x-3 text-xs bg-surface-muted border border-default p-2.5 rounded-xl">
              <div>
                <span className="text-muted block uppercase font-bold text-[9px]">Código da Sala</span>
                <span className="text-sm font-black text-success tracking-wider font-mono">{roomCode}</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomCode);
                  alert("Código copiado para a área de transferência!");
                }}
                className="p-1 hover:bg-surface border border-default rounded-lg text-muted hover:text-primary"
                title="Copiar Código"
              >
                📋
              </button>
            </div>
          </div>

          {/* Connected Network Status Toast */}
          <div className="bg-accent-soft border border-accent p-3 rounded-xl flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
            <p className="text-[11px] text-primary font-medium">{statusMessage}</p>
          </div>

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
                    <PlayerAvatar avatar={p.avatar} color={p.color} size={36} isBot={p.isBot} />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-primary block truncate max-w-[150px]">
                      {p.name} {idx === 0 && <span className="text-[9px] bg-accent-soft border border-accent text-accent px-1 rounded ml-1 uppercase font-bold">Host</span>}
                    </span>
                    <span className="text-[10px] text-muted font-medium uppercase block flex items-center gap-1">
                      {p.isBot ? <><Bot className="w-3 h-3" /> Bot</> : <><User className="w-3 h-3" /> Humano</>}
                    </span>
                  </div>
                </div>

                {/* Kick/Remove control buttons. First index is client/host (cannot remove self) */}
                {idx > 0 && gameMode !== 'online' && (
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
            {Array.from({ length: Math.max(0, maxPlayers - lobbyPlayers.length) }).map((_, i) => (
              <div 
                key={i} 
                className="bg-surface-raised border border-dashed border-default p-3 rounded-xl flex items-center justify-between text-muted"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full border border-dashed border-default flex items-center justify-center text-sm">
                    ?
                  </div>
                  <div className="leading-tight">
                    <span className="text-xs font-bold text-muted block">Vaga Disponível</span>
                    <span className="text-[9px] font-semibold text-muted uppercase block">Lobby aberto</span>
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
          {lobbyPlayers.length < 3 && (
            <div className="bg-danger-muted border border-danger p-3 rounded-lg text-center text-xs text-danger flex items-center justify-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
              O Phase 10 precisa de pelo menos <strong className="text-secondary">3 jogadores</strong> para iniciar.
              </span>
            </div>
          )}

          {/* Lobby Controller Actions Footer */}
          <div className="border-t border-default pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              onClick={() => {
                if (gameMode === 'online') {
                  emitRoomLeave();
                  setOnlineSession(null);
                }
                setLobbyPlayers([]);
                setStep('room_setup');
              }}
              className="px-5 py-2.5 bg-surface-raised hover:bg-surface-muted text-secondary font-bold text-xs rounded-xl cursor-pointer"
            >
              Cancelar Sala
            </button>

            <button
              onClick={handleLaunchGame}
              disabled={lobbyPlayers.length < 3 || (gameMode === 'online' && !onlineSession?.isHost)}
              className={`px-8 py-3.5 rounded-xl font-black text-sm tracking-wider uppercase transition-all flex items-center space-x-2 ${
                lobbyPlayers.length >= 3 && (gameMode !== 'online' || onlineSession?.isHost)
                  ? 'btn-primary cursor-pointer'
                  : 'bg-surface-raised text-muted border border-default cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{gameMode === 'online' && !onlineSession?.isHost ? 'AGUARDANDO HOST' : 'INICIAR PARTIDA'}</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
