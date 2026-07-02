import { Pause, Play } from 'lucide-react';
import { useI18n } from '../lib/i18n';

type MusicPlayerButtonProps = {
  playing: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export function MusicPlayerButton({ playing, disabled, onToggle }: MusicPlayerButtonProps) {
  const { t } = useI18n();

  if (disabled) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-default bg-surface/95 text-secondary shadow-lg backdrop-blur-sm transition-all hover:bg-surface-raised hover:text-primary active:scale-95"
      aria-label={playing ? t.settings.musicPause : t.settings.musicPlay}
      title={playing ? t.settings.musicPause : t.settings.musicPlay}
    >
      {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
    </button>
  );
}
