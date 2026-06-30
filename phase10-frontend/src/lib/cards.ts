import type { CardColor } from '../types';

/** Classes CSS para cor do naipe/número — variam com data-theme no :root */
export function cardPipClass(color: CardColor): string {
  return `playing-card__pip--${color}`;
}
