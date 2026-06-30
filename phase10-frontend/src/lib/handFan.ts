import { useEffect, useState } from 'react';

/** Layout de leque: pivô na base, rotação simétrica, cartas da direita por cima. */
export type HandFanLayout = {
  translateX: number;
  rotate: number;
  zIndex: number;
};

export type HandFanMode = 'fan' | 'stack';

export type HandFanOptions = {
  mode?: HandFanMode;
  cardWidthPx?: number;
};

export type HandSortMode = 'value' | 'color';

const MOBILE_HAND_MQ = '(max-width: 640px)';

type SortableCard = {
  type: string;
  value: number;
  color: string;
};

const DESKTOP_CARD_WIDTH_PX = 109; // 6.825rem
const MOBILE_CARD_WIDTH_PX = 72; // 4.5rem

export function useCompactHandLayout(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_HAND_MQ).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_HAND_MQ);
    const onChange = (event: MediaQueryListEvent) => setCompact(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return compact;
}

function resolveOptions(options?: HandFanOptions): Required<HandFanOptions> {
  const mode = options?.mode ?? 'fan';
  const cardWidthPx =
    options?.cardWidthPx ?? (mode === 'stack' ? MOBILE_CARD_WIDTH_PX : DESKTOP_CARD_WIDTH_PX);
  return { mode, cardWidthPx };
}

export function sortHandCards<T extends SortableCard>(cards: T[], mode: HandSortMode): T[] {
  const sorted = [...cards];
  if (mode === 'value') {
    sorted.sort((a, b) => {
      if (a.type === 'wild' && b.type !== 'wild') return 1;
      if (b.type === 'wild' && a.type !== 'wild') return -1;
      if (a.type === 'skip' && b.type !== 'skip') return 1;
      if (b.type === 'skip' && a.type !== 'skip') return -1;
      if (a.type === 'power' && b.type !== 'power') return 1;
      if (b.type === 'power' && a.type !== 'power') return -1;
      return a.value - b.value;
    });
  } else {
    sorted.sort((a, b) => {
      if (a.color === b.color) return a.value - b.value;
      return a.color.localeCompare(b.color);
    });
  }
  return sorted;
}

/** Largura visível ocupada pelo leque (px). */
export function getHandFanSpreadWidth(total: number, options?: HandFanOptions): number {
  const { mode, cardWidthPx } = resolveOptions(options);
  if (total <= 1) return cardWidthPx;
  const visibleSlice = cardWidthPx * (mode === 'stack' ? 0.32 : 0.34);
  return (total - 1) * visibleSlice + cardWidthPx;
}

export function getHandFanLayout(
  index: number,
  total: number,
  options?: HandFanOptions,
): HandFanLayout {
  const { mode, cardWidthPx } = resolveOptions(options);

  if (total <= 1) {
    return { translateX: 0, rotate: 0, zIndex: 10 };
  }

  const center = (total - 1) / 2;
  const visibleSlice = cardWidthPx * (mode === 'stack' ? 0.32 : 0.34);
  const translateX = (index - center) * visibleSlice;

  if (mode === 'stack') {
    return {
      translateX,
      rotate: 0,
      zIndex: index + 1,
    };
  }

  const maxAngle = Math.min(62, 20 + total * 4);
  const halfSpread = maxAngle / 2;
  const rotate = center === 0 ? 0 : ((index - center) / center) * halfSpread;

  return {
    translateX,
    rotate,
    zIndex: index + 1,
  };
}
