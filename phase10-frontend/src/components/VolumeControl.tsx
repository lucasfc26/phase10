import { useEffect, useRef, useState } from 'react';
import { Volume1, Volume2, VolumeX } from 'lucide-react';

type VolumeControlProps = {
  volume: number;
  onChange: (volume: number) => void;
  className?: string;
};

export function VolumeControl({ volume, onChange, className }: VolumeControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const percent = Math.round(volume * 100);
  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="p-2 hover:bg-surface-raised rounded-lg text-muted hover:text-secondary"
        title={`Volume: ${percent}%`}
        aria-label={`Volume: ${percent}%`}
        aria-expanded={open}
      >
        <Icon className={`w-5 h-5 ${volume > 0 ? 'text-accent' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 flex min-w-[11rem] items-center gap-2 rounded-lg border border-default bg-surface p-3 shadow-lg">
          <VolumeX className="h-4 w-4 shrink-0 text-muted" />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={percent}
            onChange={(event) => onChange(Number(event.target.value) / 100)}
            className="w-full accent-(--accent)"
            aria-label="Volume"
          />
          <span className="w-9 shrink-0 text-right text-[10px] font-semibold text-secondary">
            {percent}%
          </span>
        </div>
      )}
    </div>
  );
}
