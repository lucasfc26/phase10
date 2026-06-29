export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** Em produção, use o mesmo domínio (nginx faz proxy do WebSocket). */
export const WS_BASE_URL =
  import.meta.env.VITE_WS_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');
