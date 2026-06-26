import { io, Socket } from 'socket.io-client';
import { WS_BASE_URL } from '../config';
import { GameLog, GameRoom } from '../types';
import { LobbyState } from './onlineApi';

export type OnlineSocketCallbacks = {
  onLobbyUpdate?: (lobby: LobbyState) => void;
  onGameState?: (room: GameRoom) => void;
  onGameLog?: (log: GameLog) => void;
};

let socket: Socket | null = null;

export function connectOnlineSocket(sessionToken: string, callbacks: OnlineSocketCallbacks): Socket {
  if (socket?.connected) {
    socket.disconnect();
  }

  socket = io(`${WS_BASE_URL}/game`, {
    auth: { token: sessionToken },
    transports: ['websocket', 'polling'],
  });

  socket.on('lobby:update', (lobby: LobbyState) => callbacks.onLobbyUpdate?.(lobby));
  socket.on('game:state', (room: GameRoom) => callbacks.onGameState?.(room));
  socket.on('game:log', (log: GameLog) => callbacks.onGameLog?.(log));

  return socket;
}

export function getOnlineSocket(): Socket | null {
  return socket;
}

export function disconnectOnlineSocket() {
  socket?.disconnect();
  socket = null;
}

export function emitGameStart() {
  socket?.emit('game:start');
}

export function emitGameAction(action: Record<string, unknown>) {
  socket?.emit('game:action', action);
}
