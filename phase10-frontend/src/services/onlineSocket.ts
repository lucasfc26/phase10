import { io, Socket } from 'socket.io-client';
import { WS_BASE_URL } from '../config';
import { GameLog, GameRoom } from '../types';
import { LobbyState } from './onlineApi';

export type OnlineSocketCallbacks = {
  onLobbyUpdate?: (lobby: LobbyState) => void;
  onGameState?: (room: GameRoom) => void;
  onGameLog?: (log: GameLog) => void;
  onRoomDeleted?: (payload: { roomId: string; reason: string }) => void;
};

let socket: Socket | null = null;
let activeToken: string | null = null;

function registerHandlers(sock: Socket, callbacks: OnlineSocketCallbacks) {
  sock.off('lobby:update');
  sock.off('game:state');
  sock.off('game:log');
  sock.off('room:deleted');
  sock.on('lobby:update', (lobby: LobbyState) => callbacks.onLobbyUpdate?.(lobby));
  sock.on('game:state', (room: GameRoom) => callbacks.onGameState?.(room));
  sock.on('game:log', (log: GameLog) => callbacks.onGameLog?.(log));
  sock.on('room:deleted', (payload: { roomId: string; reason: string }) =>
    callbacks.onRoomDeleted?.(payload),
  );
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

export function getRoomDeletedMessage(reason: string): string {
  if (reason === 'inactive') {
    return 'A sala foi encerrada por inatividade (1 hora sem jogadas).';
  }
  return 'O host saiu. A sala foi encerrada.';
}

export function emitRoomLeave() {
  if (socket?.connected) {
    socket.emit('room:leave');
  }
  disconnectOnlineSocket();
}

export function emitGameStart(onResult?: (result: { ok?: boolean; error?: string }) => void) {
  if (!socket?.connected) {
    onResult?.({ error: 'Sem conexão com o servidor. Aguarde a conexão e tente novamente.' });
    return;
  }
  socket.emit('game:start', {}, onResult);
}

export function emitLobbyAddBot(onResult?: (result: { ok?: boolean; error?: string }) => void) {
  if (!socket?.connected) {
    onResult?.({ error: 'Sem conexão com o servidor. Aguarde a conexão e tente novamente.' });
    return;
  }
  socket.emit('lobby:add_bot', {}, onResult);
}

export function emitLobbyRemoveBot(
  botMemberId: string,
  onResult?: (result: { ok?: boolean; error?: string }) => void,
) {
  socket?.emit('lobby:remove_bot', { botMemberId }, onResult);
}

export function emitGameAction(
  action: Record<string, unknown>,
  onResult?: (result: { ok?: boolean; error?: string; room?: GameRoom }) => void,
) {
  socket?.emit('game:action', action, onResult);
}
