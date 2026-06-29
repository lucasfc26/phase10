import { Info } from 'lucide-react';
import { resolveAvatarIcon } from '../lib/avatars';

type PlayerAvatarProps = {
  avatar: string;
  color?: string;
  size?: number;
  isBot?: boolean;
  isSystem?: boolean;
  className?: string;
};

export function PlayerAvatar({
  avatar,
  color = '#a8a29e',
  size = 28,
  isBot,
  isSystem,
  className = '',
}: PlayerAvatarProps) {
  const Icon = isSystem ? Info : resolveAvatarIcon(avatar, isBot);
  const iconSize = Math.round(size * 0.55);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border border-default/50 bg-surface/80 shrink-0 ${className}`}
      style={{ width: size, height: size, color }}
    >
      <Icon size={iconSize} strokeWidth={2.25} />
    </span>
  );
}
