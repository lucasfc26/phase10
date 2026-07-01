export type CardFaceStyle = 'mono' | 'art';

const STORAGE_KEY = 'phase10-card-face';

export const CARD_JOKER_SRC = '/Cards/jocker.png';
export const CARD_SKIP_SRC = '/Cards/skip.png';
export const CARD_NUMERIC_FACE_SRC = '/Cards/CartaNumerica.png';
export const CARD_GENERAL_FACE_SRC = '/Cards/CartasGeral.png';

export function getStoredCardFaceStyle(): CardFaceStyle | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'mono' || value === 'art' ? value : null;
}

export function applyCardFaceStyle(style: CardFaceStyle) {
  document.documentElement.dataset.cardFace = style;
  localStorage.setItem(STORAGE_KEY, style);
}

export function initCardFaceStyle(): CardFaceStyle {
  const style = getStoredCardFaceStyle() ?? 'mono';
  applyCardFaceStyle(style);
  return style;
}
