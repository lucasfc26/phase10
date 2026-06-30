import {
  DEFAULT_CHARACTER,
  decodeCharacterAvatar,
  encodeCharacterAvatar,
  normalizeCharacterConfig,
  preloadCharacterAssets,
  type CharacterConfig,
} from './characterAvatar';

export type SavedPlayerProfile = {
  name: string;
  avatar: string;
  color: string;
  character: CharacterConfig;
};

const STORAGE_KEY = 'phase10-player-profile';

export function createDefaultProfile(): SavedPlayerProfile {
  const character = normalizeCharacterConfig(DEFAULT_CHARACTER);
  return {
    name: 'Jogador',
    avatar: encodeCharacterAvatar(character),
    color: '#60a5fa',
    character,
  };
}

function migrateStoredProfile(raw: unknown): SavedPlayerProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<SavedPlayerProfile>;
  if (!parsed.name || !parsed.avatar || !parsed.color) return null;

  const character = normalizeCharacterConfig(
    parsed.character ?? decodeCharacterAvatar(parsed.avatar) ?? DEFAULT_CHARACTER,
  );

  return {
    name: parsed.name,
    avatar: encodeCharacterAvatar(character),
    color: parsed.color,
    character,
  };
}

export function getStoredPlayerProfile(): SavedPlayerProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrateStoredProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setStoredPlayerProfile(profile: SavedPlayerProfile) {
  const normalized = profileFromParts(profile.name, profile.character, profile.color);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function profileFromParts(
  name: string,
  characterConfig: CharacterConfig,
  color: string,
): SavedPlayerProfile {
  const character = normalizeCharacterConfig(characterConfig);
  return {
    name: name.trim() || 'Jogador',
    avatar: encodeCharacterAvatar(character),
    color,
    character,
  };
}

export function warmPlayerProfileCache(profile: SavedPlayerProfile) {
  void preloadCharacterAssets(profile.character);
}
