/** Layout de leque: pivô na base, rotação simétrica, cartas da direita por cima. */
export type HandFanLayout = {
  translateX: number;
  rotate: number;
  zIndex: number;
};

const CARD_WIDTH_PX = 109; // 84px + 30%

/** Largura visível ocupada pelo leque (px). */
export function getHandFanSpreadWidth(total: number): number {
  if (total <= 1) return CARD_WIDTH_PX;
  const visibleSlice = CARD_WIDTH_PX * 0.34;
  return (total - 1) * visibleSlice + CARD_WIDTH_PX;
}

export function getHandFanLayout(index: number, total: number): HandFanLayout {
  if (total <= 1) {
    return { translateX: 0, rotate: 0, zIndex: 10 };
  }

  const center = (total - 1) / 2;
  const maxAngle = Math.min(62, 20 + total * 4);
  const halfSpread = maxAngle / 2;
  const rotate = center === 0 ? 0 : ((index - center) / center) * halfSpread;

  const visibleSlice = CARD_WIDTH_PX * 0.34;
  const translateX = (index - center) * visibleSlice;

  return {
    translateX,
    rotate,
    zIndex: index + 1,
  };
}
