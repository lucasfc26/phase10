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
let activeToken: string | null = null;

function registerHandlers(sock: Socket, callbacks: OnlineSocketCallbacks) {
  sock.off('lobby:update');
  sock.off('game:state');
  sock.off('game:log');
  sock.on('lobby:update', (lobby: LobbyState) => callbacks.onLobbyUpdate?.(lobby));
  sock.on('game:state', (room: GameRoom) => callbacks.onGameState?.(room));
  sock.on('game:log', (log: GameLog) => callbacks.onGameLog?.(log));
}

export function connectOnlineSocket(sessionToken: string, callbacks: OnlineSocketCallbacks): Socket {
  if (socket?.connected && activeToken === sessionToken) {
    registerHandlers(socket, callbacks);
    return socket;
  }

  socket?.disconnect();

  activeToken = sessionToken;
  socket = io(`${WS_BASE_URL}/game`, {
    auth: { token: sessionToken },
    transports: ['websocket', 'polling'],
  });

  registerHandlers(socket, callbacks);

  return socket;
}

export function getOnlineSocket(): Socket | null {
  return socket;
}

export function disconnectOnlineSocket() {
  socket?.disconnect();
  socket = null;
  activeToken = null;
}

export function emitRoomLeave() {
  if (socket?.connected) {
    socket.emit('room:leave');
  }
  disconnectOnlineSocket();
}

export function emitGameStart() {
  socket?.emit('game:start');
}

export function emitGameAction(action: Record<string, unknown>) {
  socket?.emit('game:action', action);
}
