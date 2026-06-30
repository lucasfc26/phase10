import { API_BASE_URL } from '../config';
import { GameRoom } from '../types';

export interface RoomSession {
  roomId: string;
  code: string;
  memberId: string;
  sessionToken: string;
  isHost: boolean;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isBot: boolean;
  isConnected: boolean;
  seatIndex: number;
}

export interface LobbyState {
  roomId: string;
  code: string;
  status: string;
  maxPlayers: number;
  hostMemberId: string;
  players: LobbyPlayer[];
  hasPassword: boolean;
  allowBots: boolean;
}

export interface PublicRoom {
  id: string;
  code: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  hasPassword: boolean;
  status: string;
  createdAt: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Erro na requisição');
  }
  return res.json();
}

export const onlineApi = {
  listRooms: () => request<PublicRoom[]>('/rooms'),

  createRoom: (body: {
    name: string;
    avatar: string;
    color: string;
    maxPlayers: number;
    password?: string;
    allowBots?: boolean;
  }) =>
    request<{ session: RoomSession; lobby: LobbyState }>('/rooms', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  joinRoom: (body: {
    code: string;
    name: string;
    avatar: string;
    color: string;
    password?: string;
  }) =>
    request<{ session: RoomSession; lobby: LobbyState }>('/rooms/join', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export type { GameRoom };
