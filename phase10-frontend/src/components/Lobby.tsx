import React, { useState, useEffect } from 'react';
import { 
  Users, Shield, Sparkles, User, Play, RefreshCw, 
  Globe, Laptop, Plus, Trash2, Bot, ArrowRight, CheckCircle2 
} from 'lucide-react';
import { GameRoom, Player } from '../types';
import { generateId } from '../gameEngine';
import { onlineApi, LobbyPlayer, PublicRoom, RoomSession } from '../services/onlineApi';
import { connectOnlineSocket, emitAddBot, emitGameStart, emitRemoveBot, emitRoomLeave, disconnectOnlineSocket, getRoomDeletedMessage } from '../services/onlineSocket';

interface LobbyProps {
  onStartGame: (
    room: GameRoom,
    playerProfile: { name: string; avatar: string; color: string },
    session?: RoomSession | null,
  ) => void;
}

const AVATARS = [
  { emoji: '🦊', label: 'Raposa' },
  { emoji: '🦁', label: 'Leão' },
  { emoji: '🐼', label: 'Panda' },
  { emoji: '🐨', label: 'Coala' },
  { emoji: '🦄', label: 'Unicórnio' },
  { emoji: '🦉', label: 'Coruja' },
  { emoji: '🐸', label: 'Sapo' },
  { emoji: '🐧', label: 'Pinguim' },
  { emoji: '🐯', label: 'Tigre' },
  { emoji: '🐙', label: 'Polvo' },
];

const COLORS = [
  '#f87171', // red
  '#fbbf24', // yellow
  '#34d399', // green
  '#60a5fa', // blue
  '#c084fc', // purple
  '#f472b6', // pink
  '#fb923c', // orange
  '#2dd4bf', // teal
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
  const [selectedAvatar, setSelectedAvatar] = useState<string>('🦊');
  const [selectedColor, setSelectedColor] = useState<string>('#60a5fa');

  // Room Settings
  const [gameMode, setGameMode] = useState<'bots' | 'pass_and_play' | 'online'>('bots');
  const [isOnlineRoleHost, setIsOnlineRoleHost] = useState<boolean>(true); // Host vs Join Code
  const [inputRoomCode, setInputRoomCode] = useState<string>('');
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [botSpeed, setBotSpeed] = useState<number>(1200); // ms delay
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
    setSelectedAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)].emoji);
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

  // Load public rooms when online mode is selected
  useEffect(() => {
    if (step !== 'room_setup' || gameMode !== 'online') return;
    onlineApi.listRooms().then(setPublicRooms).catch(() => setPublicRooms([]));
    const interval = setInterval(() => {
      onlineApi.listRooms().then(setPublicRooms).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
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
        setAllowBotsToggle(result.lobby.allowBots);
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
      const shuffledAvatars = AVATARS.filter(a => a.emoji !== selectedAvatar).sort(() => 0.5 - Math.random());
      const shuffledColors = COLORS.filter(c => c !== selectedColor).sort(() => 0.5 - Math.random());

      for (let i = 0; i < localHumansToCreate; i++) {
        initialList.push({
          id: `player-local-${generateId()}`,
          name: `Jogador ${i + 2}`,
          avatar: shuffledAvatars[i % shuffledAvatars.length]?.emoji || '👥',
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
      const shuffledAvatars = AVATARS.filter(a => a.emoji !== selectedAvatar).sort(() => 0.5 - Math.random());
      const shuffledColors = COLORS.filter(c => c !== selectedColor).sort(() => 0.5 - Math.random());

      for (let i = 0; i < botsToCreate; i++) {
        initialList.push({
          id: `bot-${generateId()}`,
          name: shuffledBotNames[i % shuffledBotNames.length],
          avatar: shuffledAvatars[i % shuffledAvatars.length]?.emoji || '🤖',
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
    const av = AVATARS.find(a => !usedAvatars.includes(a.emoji))?.emoji || '🤖';
    
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
        const present = lobby.players.filter((p) => p.isBot || p.isConnected).length;
        setStatusMessage(
          `Sala ${lobby.code}: ${present}/${lobby.maxPlayers} jogadores (${lobby.players.filter((p) => p.isConnected).length} online).`,
        );
      },
      onRoomDeleted: (payload) => {
        const message = getRoomDeletedMessage(payload.reason);
        disconnectOnlineSocket();
        setOnlineSession(null);
        setLobbyPlayers([]);
        setStep('room_setup');
        setStatusMessage(message);
        alert(message);
      },
      onGameState: (room) => {
        onStartGame(room, profile, onlineSession);
      },
    });
  }, [step, gameMode, onlineSession?.sessionToken]);

  // Handle manual removal of player/bot from lobby slots (local modes only)
  const handleRemovePlayer = (id: string) => {
    if (gameMode === 'online') {
      if (!onlineSession?.isHost) return;
      emitRemoveBot(id, (result) => {
        if (result?.error) alert(result.error);
      });
      return;
    }
    setLobbyPlayers(prev => prev.filter(p => p.id !== id));
  };

  const canManageBots =
    allowBotsToggle && (gameMode !== 'online' || !!onlineSession?.isHost);

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
      emitAddBot((result) => {
        if (result?.error) alert(result.error);
        else setStatusMessage('🤖 Um Bot de Inteligência Artificial foi adicionado ao lobby!');
      });
      return;
    }

    const updated = [...lobbyPlayers];
    addBotToLobbyList(updated, maxPlayers);
    setLobbyPlayers(updated);
    setStatusMessage("🤖 Um Bot de Inteligência Artificial foi adicionado ao lobby!");
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
        if (result?.error) alert(result.error);
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
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-purple-500/15 border border-purple-500/30 rounded-full text-purple-300 text-xs font-semibold animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Nova Atualização: Multiplayer Online & Bots Customizados!</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase">
          <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
            Phase 10 Arena
          </span>
        </h1>
      </div>

      {/* STEP 1: PLAYER PROFILE SETUP */}
      {step === 'profile' && (
        <form onSubmit={handleConfirmProfile} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 max-w-xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-200 flex items-center space-x-2">
              <User className="w-5 h-5 text-purple-400" />
              <span>Passo 1: Crie seu Perfil</span>
            </h3>
            <button
              type="button"
              onClick={handleRandomizeProfile}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center space-x-1 font-semibold hover:underline"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Aleatório</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Seu Nome de Jogador
              </label>
              <input
                type="text"
                required
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ex: Pedro, Marta_Sets..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 outline-none transition-colors"
                maxLength={18}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Escolha um Avatar ({selectedAvatar})
                </label>
                <div className="grid grid-cols-5 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 max-h-32 overflow-y-auto">
                  {AVATARS.map((av) => (
                    <button
                      key={av.label}
                      type="button"
                      onClick={() => setSelectedAvatar(av.emoji)}
                      className={`text-xl p-2 rounded-lg transition-transform hover:scale-110 active:scale-95 ${
                        selectedAvatar === av.emoji
                          ? 'bg-purple-600/30 border border-purple-500/80 scale-105'
                          : 'bg-transparent border border-transparent'
                      }`}
                    >
                      {av.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Sua Cor do Tema
                </label>
                <div className="flex flex-wrap gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
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
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-extrabold text-sm tracking-wider flex items-center justify-center space-x-1.5 shadow-lg shadow-purple-900/20"
          >
            <span>CONFIRMAR E CONTINUAR</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* STEP 2: ROOM SETUP / LOCAL VS ONLINE CHOICES */}
      {step === 'room_setup' && (
        <form onSubmit={handleConfigureRoom} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-200 flex items-center space-x-2">
              <Laptop className="w-5 h-5 text-indigo-400" />
              <span>Passo 2: Opções de Rede e Conectividade</span>
            </h3>
            <button
              type="button"
              onClick={() => setStep('profile')}
              className="text-xs text-slate-400 hover:text-slate-300 font-semibold underline"
            >
              Voltar ao Perfil
            </button>
          </div>

          <div className="space-y-5">
            
            {/* Multiplayer Choice Row */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                Escolha o Tipo de Conexão
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* Traditional Bot mode */}
                <button
                  type="button"
                  onClick={() => setGameMode('bots')}
                  className={`p-4 rounded-xl border flex flex-col text-left transition-all ${
                    gameMode === 'bots'
                      ? 'bg-purple-500/10 border-purple-500 text-purple-200'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-extrabold text-xs block text-white mb-1 flex items-center space-x-1.5">
                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                    <span>Treino contra Bots</span>
                  </span>
                  <span className="text-[10px] leading-relaxed">Solo vs Inteligência Artificial inteligente de resposta rápida.</span>
                </button>

                {/* Local multiplayer */}
                <button
                  type="button"
                  onClick={() => setGameMode('pass_and_play')}
                  className={`p-4 rounded-xl border flex flex-col text-left transition-all ${
                    gameMode === 'pass_and_play'
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-200'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-extrabold text-xs block text-white mb-1 flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
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
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-200'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-extrabold text-xs block text-white mb-1 flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
                    <span>Multiplayer Online</span>
                  </span>
                  <span className="text-[10px] leading-relaxed">Crie ou conecte-se a salas online em servidores simulados ao vivo.</span>
                </button>

              </div>
            </div>

            {/* If Online, allow Host vs Join code */}
            {gameMode === 'online' && (
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-3.5">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsOnlineRoleHost(true)}
                    className={`flex-1 py-2 font-bold text-xs rounded-lg border transition-all ${
                      isOnlineRoleHost
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Host: Criar Nova Sala Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOnlineRoleHost(false)}
                    className={`flex-1 py-2 font-bold text-xs rounded-lg border transition-all ${
                      !isOnlineRoleHost
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Entrar em Sala via Código
                  </button>
                </div>

                {!isOnlineRoleHost && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500">
                      Código de Convite da Sala
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: F1B6A2"
                      value={inputRoomCode}
                      onChange={(e) => setInputRoomCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white uppercase outline-none focus:border-emerald-500"
                      maxLength={6}
                    />
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 mt-2">
                      Senha da Sala (se houver)
                    </label>
                    <input
                      type="password"
                      placeholder="Senha opcional"
                      value={joinPassword}
                      onChange={(e) => setJoinPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                      maxLength={32}
                    />
                  </div>
                )}

                {isOnlineRoleHost && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500">
                      Senha da Sala (opcional)
                    </label>
                    <input
                      type="password"
                      placeholder="Deixe vazio para sala pública"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                      maxLength={32}
                    />
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500">
                    Salas abertas no servidor
                  </label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {publicRooms.length === 0 ? (
                      <p className="text-[10px] text-slate-500">Nenhuma sala ativa no momento.</p>
                    ) : (
                      publicRooms.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setIsOnlineRoleHost(false);
                            setInputRoomCode(r.code);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-600 text-xs flex justify-between"
                        >
                          <span className="font-mono text-emerald-400">{r.code}</span>
                          <span className="text-slate-400">
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
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Capacidade da Sala ({maxPlayers} Jogadores)
                </label>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none"
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
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Configuração de Bots (Inteligência Artificial)
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Adicionar Bots</span>
                      <span className="text-[10px] text-slate-500">Preencher vagas vazias</span>
                    </div>
                  </div>
                  
                  {/* Slider checkbox custom toggle */}
                  <button
                    type="button"
                    onClick={() => setAllowBotsToggle(!allowBotsToggle)}
                    className={`w-12 h-6 rounded-full p-0.5 transition-colors relative flex items-center ${
                      allowBotsToggle ? 'bg-purple-600' : 'bg-slate-800'
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
              <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Velocidade de Inteligência (Bots)</span>
                  <span className="text-[10px] text-slate-500">Tempo de raciocínio da máquina</span>
                </div>
                <select
                  value={botSpeed}
                  onChange={(e) => setBotSpeed(parseInt(e.target.value))}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-300"
                >
                  <option value={2000}>Super Calmo (2.0s)</option>
                  <option value={1200}>Moderado (1.2s)</option>
                  <option value={600}>Rápido (0.6s)</option>
                  <option value={200}>Instantâneo (0.2s)</option>
                </select>
              </div>
            )}

          </div>

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-60 text-white rounded-xl font-black text-sm tracking-wider uppercase shadow-lg shadow-indigo-950/40"
          >
            {isConnecting ? 'Conectando...' : 'Avançar para Lobby de Espera ➔'}
          </button>
        </form>
      )}

      {/* STEP 3: INTERACTIVE WAITING ROOM / ADD-REMOVE BOTS BOARD */}
      {step === 'waiting_room' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-3xl mx-auto space-y-6">
          
          {/* Header waiting summary */}
          <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                Lobby do Jogo
              </span>
              <h3 className="text-xl font-extrabold text-white flex items-center space-x-2">
                <span>Vagas no Lobby:</span>
                <span className="text-indigo-400 font-mono">{lobbyPlayers.length}/{maxPlayers}</span>
              </h3>
            </div>

            <div className="flex items-center space-x-3 text-xs bg-slate-950 border border-slate-850 p-2.5 rounded-xl">
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[9px]">Código da Sala</span>
                <span className="text-sm font-black text-emerald-400 tracking-wider font-mono">{roomCode}</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomCode);
                  alert("Código copiado para a área de transferência!");
                }}
                className="p-1 hover:bg-slate-900 border border-slate-850 rounded-lg text-slate-400 hover:text-white"
                title="Copiar Código"
              >
                📋
              </button>
            </div>
          </div>

          {/* Connected Network Status Toast */}
          <div className="bg-indigo-950/40 border border-indigo-900/60 p-3 rounded-xl flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <p className="text-[11px] text-indigo-200">{statusMessage}</p>
          </div>

          {/* Active players grid representation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {lobbyPlayers.map((p, idx) => (
              <div 
                key={p.id} 
                className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl flex items-center justify-between"
                style={{ borderLeft: `3px solid ${p.color}` }}
              >
                <div className="flex items-center space-x-3">
                  <div className="text-2xl w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                    {p.avatar}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block truncate max-w-[150px]">
                      {p.name} {idx === 0 && <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-1 rounded-sm uppercase font-extrabold ml-1">Líder</span>}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      {p.isBot ? '🤖 Bot Inteligência Artificial' : '👤 Jogador Humano'}
                    </span>
                  </div>
                </div>

                {/* Kick/Remove control: local modes or host removing bots online */}
                {idx > 0 && (gameMode !== 'online' || (onlineSession?.isHost && p.isBot)) && (
                  <button
                    onClick={() => handleRemovePlayer(p.id)}
                    className="p-1.5 hover:bg-rose-950/30 border border-slate-850 hover:border-rose-900/60 rounded-lg text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
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
                className="bg-slate-950/30 border border-dashed border-slate-850 p-3 rounded-xl flex items-center justify-between text-slate-600"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full border border-dashed border-slate-800 flex items-center justify-center text-sm">
                    ?
                  </div>
                  <div className="leading-tight">
                    <span className="text-xs font-bold text-slate-600 block">Vaga Disponível</span>
                    <span className="text-[9px] font-semibold text-slate-600 uppercase block">Lobby aberto</span>
                  </div>
                </div>

                {/* Trigger to manually add a bot to this spot if bots are allowed (host only online) */}
                {canManageBots && (
                  <button
                    onClick={handleAddManualBot}
                    className="px-2.5 py-1.5 bg-purple-950/40 hover:bg-purple-900/40 border border-purple-900/30 hover:border-purple-500 rounded-lg text-[10px] font-extrabold text-purple-400 hover:text-purple-300 transition-all flex items-center space-x-1 cursor-pointer"
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
            <div className="bg-rose-950/20 border border-rose-900/40 p-3 rounded-xl text-center text-xs text-rose-300 leading-tight">
              ⚠️ O Phase 10 necessita de pelo menos <strong className="text-white">3 jogadores ativos</strong> para preencher o tabuleiro e iniciar a partida. Adicione Bots ou aguarde outros jogadores.
            </div>
          )}

          {/* Lobby Controller Actions Footer */}
          <div className="border-t border-slate-850 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              onClick={() => {
                if (gameMode === 'online') {
                  emitRoomLeave();
                  setOnlineSession(null);
                }
                setLobbyPlayers([]);
                setStep('room_setup');
              }}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
            >
              Cancelar Sala
            </button>

            <button
              onClick={handleLaunchGame}
              disabled={lobbyPlayers.length < 3 || (gameMode === 'online' && !onlineSession?.isHost)}
              className={`px-8 py-3.5 rounded-xl font-black text-sm tracking-wider uppercase transition-all flex items-center space-x-2 ${
                lobbyPlayers.length >= 3 && (gameMode !== 'online' || onlineSession?.isHost)
                  ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-950/60 animate-pulse cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-850 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{gameMode === 'online' && !onlineSession?.isHost ? 'AGUARDANDO HOST' : 'INICIAR PARTIDA'}</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
