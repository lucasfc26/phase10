import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  CharacterConfig,
  DEFAULT_CHARACTER,
  FACE_COUNT,
  HAIR_COUNT,
  HAIR_COLOR_PRESETS,
  SKIN_COLOR_PRESETS,
  renderCharacter,
} from '../lib/characterAvatar';

interface CharacterCreatorProps {
  value: CharacterConfig;
  onChange: (config: CharacterConfig) => void;
  themeColor?: string;
}

const SELECT_BORDER = '#79d8f3';

function ColorSwatch({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 transition-transform hover:scale-105 active:scale-95"
      style={{
        width: 28,
        height: 28,
        backgroundColor: color,
        border: selected ? `3px solid ${SELECT_BORDER}` : '2px solid rgba(255,255,255,0.15)',
        boxSizing: 'border-box',
      }}
      title={color}
    />
  );
}

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({
  value,
  onChange,
  themeColor = '#ffffff',
}) => {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderCharacter(value, 220, themeColor).then((url) => {
      if (!cancelled) setPreviewSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, themeColor]);

  const update = (patch: Partial<CharacterConfig>) => onChange({ ...value, ...patch });

  const cycleHair = (delta: number) => {
    update({ hairIndex: (value.hairIndex + delta + HAIR_COUNT) % HAIR_COUNT });
  };

  const cycleFace = (delta: number) => {
    update({ faceIndex: (value.faceIndex + delta + FACE_COUNT) % FACE_COUNT });
  };

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => cycleHair(-1)}
          className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-muted transition-colors"
          title="Cabelo anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div
          className="w-[200px] h-[200px] rounded-lg flex items-center justify-center overflow-hidden border border-default/40"
          style={{ backgroundColor: themeColor }}
        >
          {previewSrc ? (
            <img
              src={previewSrc}
              alt="Prévia do personagem"
              className="w-full h-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full bg-surface-muted animate-pulse" />
          )}
        </div>

        <button
          type="button"
          onClick={() => cycleHair(1)}
          className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-muted transition-colors"
          title="Próximo cabelo"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
        <button
          type="button"
          onClick={() => cycleFace(-1)}
          className="px-2 py-0.5 rounded hover:bg-surface-muted hover:text-secondary transition-colors"
        >
          ‹ Rosto
        </button>
        <span className="font-mono text-secondary">
          {value.faceIndex + 1}/{FACE_COUNT}
        </span>
        <button
          type="button"
          onClick={() => cycleFace(1)}
          className="px-2 py-0.5 rounded hover:bg-surface-muted hover:text-secondary transition-colors"
        >
          Rosto ›
        </button>
      </div>

      <div className="flex gap-1.5 justify-center flex-wrap max-w-[280px]">
        {HAIR_COLOR_PRESETS.map((col) => (
          <ColorSwatch
            key={`hair-${col}`}
            color={col}
            selected={value.hairColor.toLowerCase() === col.toLowerCase()}
            onClick={() => update({ hairColor: col })}
          />
        ))}
      </div>

      <div className="flex gap-1.5 justify-center flex-wrap max-w-[280px]">
        {SKIN_COLOR_PRESETS.map((col) => (
          <ColorSwatch
            key={`skin-${col}`}
            color={col}
            selected={value.skinColor.toLowerCase() === col.toLowerCase()}
            onClick={() => update({ skinColor: col })}
          />
        ))}
      </div>
    </div>
  );
};

export { DEFAULT_CHARACTER };
