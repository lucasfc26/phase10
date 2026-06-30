export interface CharacterConfig {
  hairIndex: number;
  faceIndex: number;
  hairColor: string;
  skinColor: string;
}

export const DEFAULT_HAIR_COLOR = "#54ff00";
export const DEFAULT_SKIN_COLOR = "#3b44ff";

export const HAIR_COUNT = 12;
export const FACE_COUNT = 10;
export const LAYER_SIZE = 270;

export const HAIR_COLOR_PRESETS = [
  "#6B2D2D",
  "#1A1A1A",
  "#E8D44A",
  "#54FF00",
  "#4A3020",
  "#FFFFFF",
  "#A020F0",
  "#4A4A4A",
];

export const SKIN_COLOR_PRESETS = [
  "#F5C4B8",
  "#B5B5B5",
  "#E8C99A",
  "#F0EADC",
  "#D4A088",
  "#5C3A1E",
  "#2A1810",
  "#1A1A1A",
];

export const DEFAULT_CHARACTER: CharacterConfig = {
  hairIndex: 2,
  faceIndex: 0,
  hairColor: "#4A3020",
  skinColor: "#B5B5B5",
};

export function isCharacterAvatar(avatar: string): boolean {
  return avatar.startsWith("char:");
}

export function normalizeHex(hex: string): string {
  const raw = hex.replace("#", "").trim().toLowerCase();
  if (raw.length === 3) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
  }
  return `#${raw.padStart(6, "0").slice(0, 6)}`;
}

export function normalizeCharacterConfig(config: CharacterConfig): CharacterConfig {
  return {
    hairIndex: Math.max(0, Math.min(HAIR_COUNT - 1, config.hairIndex)),
    faceIndex: Math.max(0, Math.min(FACE_COUNT - 1, config.faceIndex)),
    hairColor: normalizeHex(config.hairColor),
    skinColor: normalizeHex(config.skinColor),
  };
}

export function encodeCharacterAvatar(config: CharacterConfig): string {
  const normalized = normalizeCharacterConfig(config);
  return `char:${normalized.hairIndex}:${normalized.faceIndex}:${normalized.hairColor.replace("#", "")}:${normalized.skinColor.replace("#", "")}`;
}

export function decodeCharacterAvatar(avatar: string): CharacterConfig | null {
  if (!isCharacterAvatar(avatar)) return null;
  const parts = avatar.split(":");
  if (parts.length !== 5) return null;
  const hairIndex = parseInt(parts[1], 10);
  const faceIndex = parseInt(parts[2], 10);
  if (Number.isNaN(hairIndex) || Number.isNaN(faceIndex)) return null;
  return normalizeCharacterConfig({
    hairIndex,
    faceIndex,
    hairColor: `#${parts[3]}`,
    skinColor: `#${parts[4]}`,
  });
}

export function avatarDisplayText(avatar: string): string {
  return isCharacterAvatar(avatar) ? "👤" : avatar;
}

export function randomCharacterConfig(): CharacterConfig {
  return normalizeCharacterConfig({
    hairIndex: Math.floor(Math.random() * HAIR_COUNT),
    faceIndex: Math.floor(Math.random() * FACE_COUNT),
    hairColor:
      HAIR_COLOR_PRESETS[Math.floor(Math.random() * HAIR_COLOR_PRESETS.length)],
    skinColor:
      SKIN_COLOR_PRESETS[Math.floor(Math.random() * SKIN_COLOR_PRESETS.length)],
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function replaceColorInData(
  data: Uint8ClampedArray,
  fromHex: string,
  toHex: string,
  tolerance = 90,
): void {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 10) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (colorDistance(r, g, b, from.r, from.g, from.b) < tolerance) {
      data[i] = to.r;
      data[i + 1] = to.g;
      data[i + 2] = to.b;
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const hairImageCache = new Map<number, Promise<HTMLImageElement>>();
const faceImageCache = new Map<number, Promise<HTMLImageElement>>();

export function loadHairByIndex(hairIndex: number): Promise<HTMLImageElement> {
  const index = Math.max(0, Math.min(HAIR_COUNT - 1, hairIndex));
  const cached = hairImageCache.get(index);
  if (cached) return cached;

  const promise = loadImage(`/cabelo${index + 1}.png`);
  hairImageCache.set(index, promise);
  return promise;
}

export function loadFaceByIndex(faceIndex: number): Promise<HTMLImageElement> {
  const index = Math.max(0, Math.min(FACE_COUNT - 1, faceIndex));
  const cached = faceImageCache.get(index);
  if (cached) return cached;

  const promise = loadImage(`/rosto${index + 1}.png`);
  faceImageCache.set(index, promise);
  return promise;
}

function layerSize(img: HTMLImageElement): { w: number; h: number } {
  return {
    w: img.naturalWidth || LAYER_SIZE,
    h: img.naturalHeight || LAYER_SIZE,
  };
}

const renderCache = new Map<string, string>();
const RENDER_CACHE_INDEX_KEY = "phase10-avatar-render-index";
const RENDER_CACHE_PREFIX = "phase10-avatar-render:";
const MAX_PERSISTED_RENDERS = 36;

function readRenderCacheIndex(): string[] {
  try {
    const raw = localStorage.getItem(RENDER_CACHE_INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeRenderCacheIndex(keys: string[]) {
  localStorage.setItem(RENDER_CACHE_INDEX_KEY, JSON.stringify(keys.slice(-MAX_PERSISTED_RENDERS)));
}

function getPersistedRender(key: string): string | null {
  try {
    return localStorage.getItem(RENDER_CACHE_PREFIX + key);
  } catch {
    return null;
  }
}

function setPersistedRender(key: string, dataUrl: string) {
  try {
    localStorage.setItem(RENDER_CACHE_PREFIX + key, dataUrl);
    const index = readRenderCacheIndex().filter((entry) => entry !== key);
    index.push(key);
    while (index.length > MAX_PERSISTED_RENDERS) {
      const oldest = index.shift();
      if (oldest) localStorage.removeItem(RENDER_CACHE_PREFIX + oldest);
    }
    writeRenderCacheIndex(index);
  } catch {
    // localStorage cheio ou indisponível — ignora persistência
  }
}

export function preloadCharacterAssets(config: CharacterConfig): Promise<void> {
  const normalized = normalizeCharacterConfig(config);
  return Promise.all([
    loadHairByIndex(normalized.hairIndex),
    loadFaceByIndex(normalized.faceIndex),
  ]).then(() => undefined);
}

export function characterCacheKey(
  config: CharacterConfig,
  size: number,
): string {
  const normalized = normalizeCharacterConfig(config);
  return `v5:${normalized.hairIndex}:${normalized.faceIndex}:${normalized.hairColor}:${normalized.skinColor}:${size}`;
}

export async function renderCharacter(
  config: CharacterConfig,
  size: number,
  backgroundColor: string | null = "#ffffff",
): Promise<string> {
  const normalized = normalizeCharacterConfig(config);
  const bgKey = backgroundColor ? normalizeHex(backgroundColor) : "transparent";
  const key = `${characterCacheKey(normalized, size)}:${bgKey}`;

  const memoryCached = renderCache.get(key);
  if (memoryCached) return memoryCached;

  const persisted = getPersistedRender(key);
  if (persisted) {
    renderCache.set(key, persisted);
    return persisted;
  }

  const [hairImg, faceImg] = await Promise.all([
    loadHairByIndex(normalized.hairIndex),
    loadFaceByIndex(normalized.faceIndex),
  ]);

  const { w, h } = layerSize(hairImg);

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const offCtx = off.getContext("2d")!;

  offCtx.drawImage(hairImg, 0, 0, w, h);

  const headData = offCtx.getImageData(0, 0, w, h);
  replaceColorInData(headData.data, DEFAULT_HAIR_COLOR, normalized.hairColor);
  replaceColorInData(headData.data, DEFAULT_SKIN_COLOR, normalized.skinColor);
  offCtx.putImageData(headData, 0, 0);

  offCtx.drawImage(faceImg, 0, 0, w, h);

  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d")!;
  if (backgroundColor) {
    ctx.fillStyle = bgKey;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.drawImage(off, 0, 0, w, h, 0, 0, size, size);

  const dataUrl = out.toDataURL("image/png");
  renderCache.set(key, dataUrl);
  setPersistedRender(key, dataUrl);
  return dataUrl;
}
