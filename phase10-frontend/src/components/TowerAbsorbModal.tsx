import React, { useMemo, useState } from 'react';
import { BatteryCharging, Check, X } from 'lucide-react';
import type { Card } from '../types';
import { TOWER_CARD_CATEGORY_LABELS } from '../lib/cards';
import {
  ABSORBABLE_POWER_CATEGORIES,
  absorbEnergyGain,
  type AbsorbCategoryFilter,
} from '../games/towerMaster/absorb';

interface TowerAbsorbModalProps {
  cards: Card[];
  currentEnergy: number;
  onConfirm: (powerCardIds: string[]) => void;
  onCancel: () => void;
}

function AbsorbCardButton({
  card,
  selected,
  onToggle,
}: {
  card: Card;
  selected: boolean;
  onToggle: () => void;
}) {
  const category = card.powerCategory ?? 'attack';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`playing-card playing-card--prompt-discard text-left playing-card--tower playing-card--tower-${category} relative ${
        selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''
      }`}
      aria-pressed={selected}
    >
      {selected && (
        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent text-on-accent flex items-center justify-center z-10">
          <Check className="w-3 h-3" />
        </span>
      )}
      <div className="h-full flex flex-col justify-between">
        <div className="playing-card__power-art">
          <img src={card.imageSrc} alt="" draggable={false} />
        </div>
        <div className="playing-card__power-name">{card.powerName}</div>
      </div>
    </button>
  );
}

export const TowerAbsorbModal: React.FC<TowerAbsorbModalProps> = ({
  cards,
  currentEnergy,
  onConfirm,
  onCancel,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<AbsorbCategoryFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const categoriesInHand = useMemo(() => {
    const set = new Set(cards.map((card) => card.powerCategory).filter(Boolean));
    return ABSORBABLE_POWER_CATEGORIES.filter((category) => set.has(category));
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (categoryFilter === 'all') return cards;
    return cards.filter((card) => card.powerCategory === categoryFilter);
  }, [cards, categoryFilter]);

  const selectedCount = selectedIds.size;
  const energyGain = absorbEnergyGain(currentEnergy, selectedCount);

  const toggleCard = (cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface border border-default rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 bg-accent-soft border border-accent/30 text-accent rounded-full flex items-center justify-center shrink-0">
              <BatteryCharging className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-primary leading-tight">Absorver Poderes</h3>
              <p className="text-xs text-muted mt-1">
                Destrua cartas de ação da sua mão para ganhar energia (+1 por carta, máx. 6).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-muted hover:text-secondary hover:bg-surface-muted transition-colors shrink-0"
            aria-label="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors ${
              categoryFilter === 'all'
                ? 'bg-accent-soft border-accent text-accent'
                : 'bg-surface-muted border-default text-muted hover:text-secondary'
            }`}
          >
            Todas
          </button>
          {categoriesInHand.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setCategoryFilter(category)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                categoryFilter === category
                  ? 'bg-accent-soft border-accent text-accent'
                  : 'bg-surface-muted border-default text-muted hover:text-secondary'
              }`}
            >
              {TOWER_CARD_CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
          {filteredCards.map((card) => (
            <AbsorbCardButton
              key={card.id}
              card={card}
              selected={selectedIds.has(card.id)}
              onToggle={() => toggleCard(card.id)}
            />
          ))}
        </div>

        {filteredCards.length === 0 && (
          <p className="text-xs text-muted text-center py-2">Nenhuma carta nesta categoria.</p>
        )}

        <div className="flex items-center justify-between text-[11px] text-muted px-1">
          <span>Energia atual: {currentEnergy}/6</span>
          <span>
            {selectedCount > 0
              ? `+${energyGain} energia (${selectedCount} carta${selectedCount > 1 ? 's' : ''})`
              : 'Selecione cartas para absorver'}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 bg-surface-raised hover:bg-surface-muted text-secondary rounded-lg text-xs font-bold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm([...selectedIds])}
            disabled={selectedCount === 0}
            className="flex-1 py-2.5 btn-primary font-bold text-xs rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Absorver{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
