import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Compass,
  Crown,
  Diamond,
  Flame,
  Heart,
  Hexagon,
  Shield,
  Star,
  Target,
  User,
  Zap,
} from 'lucide-react';

export const AVATAR_OPTIONS = [
  { id: 'crown', label: 'Coroa', Icon: Crown },
  { id: 'star', label: 'Estrela', Icon: Star },
  { id: 'diamond', label: 'Diamante', Icon: Diamond },
  { id: 'heart', label: 'Coração', Icon: Heart },
  { id: 'shield', label: 'Escudo', Icon: Shield },
  { id: 'zap', label: 'Raio', Icon: Zap },
  { id: 'target', label: 'Alvo', Icon: Target },
  { id: 'compass', label: 'Bússola', Icon: Compass },
  { id: 'flame', label: 'Chama', Icon: Flame },
  { id: 'hexagon', label: 'Hexágono', Icon: Hexagon },
] as const;

export type AvatarId = (typeof AVATAR_OPTIONS)[number]['id'];

const ICON_BY_ID = Object.fromEntries(
  AVATAR_OPTIONS.map((a) => [a.id, a.Icon]),
) as Record<AvatarId, LucideIcon>;

export function resolveAvatarIcon(avatar: string, isBot?: boolean): LucideIcon {
  if (isBot) return Bot;
  return ICON_BY_ID[avatar as AvatarId] ?? User;
}

export const DEFAULT_AVATAR_ID: AvatarId = 'crown';
