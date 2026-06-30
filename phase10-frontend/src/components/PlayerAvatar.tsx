import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { resolveAvatarIcon } from '../lib/avatars';
import {
  decodeCharacterAvatar,
  DEFAULT_CHARACTER,
  isCharacterAvatar,
  renderCharacter,
} from '../lib/characterAvatar';

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
  const [src, setSrc] = useState<string | null>(null);
  const showCharacter = isCharacterAvatar(avatar);

  useEffect(() => {
    if (!showCharacter) {
      setSrc(null);
      return;
    }

    const config = decodeCharacterAvatar(avatar) ?? DEFAULT_CHARACTER;
    let cancelled = false;

    renderCharacter(config, size, color).then((url) => {
      if (!cancelled) setSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [avatar, size, showCharacter, color]);

  if (isSystem) {
    const iconSize = Math.round(size * 0.55);
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full border border-default/50 bg-surface/80 shrink-0 ${className}`}
        style={{ width: size, height: size, color }}
      >
        <Info size={iconSize} strokeWidth={2.25} />
      </span>
    );
  }

  if (showCharacter) {
    if (!src) {
      return (
        <span
          className={`inline-block rounded-full bg-surface-muted animate-pulse shrink-0 ${className}`}
          style={{ width: size, height: size }}
        />
      );
    }

    return (
      <img
        src={src}
        alt=""
        className={`inline-block rounded-full object-cover shrink-0 border border-default/50 ${className}`}
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }

  const Icon = resolveAvatarIcon(avatar, isBot);
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
