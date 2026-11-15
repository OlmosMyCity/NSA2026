/**
 * @module components/health/IndicatorCard
 * Selectable summary card for a single physiological indicator and its traffic-light status.
 */

import { INDICATORS } from '../../domain/health/indicators';
import { STATUS_THEME } from '../../domain/health/status-theme';
import type { IndicatorEvaluation, IndicatorId } from '../../domain/health/types';
import { StatusBadge } from './StatusBadge';

interface IndicatorCardProps {
  indicator: IndicatorId;
  evaluation: IndicatorEvaluation | undefined;
  selected?: boolean;
  onClick?: () => void;
}

/** Displays an indicator's current measurement, unit, and compact `StatusBadge`. */
export function IndicatorCard({
  indicator,
  evaluation,
  selected = false,
  onClick,
}: IndicatorCardProps) {
  const def = INDICATORS[indicator];
  const status = evaluation?.status ?? 'unknown';
  const t = STATUS_THEME[status];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`tactile-press group flex flex-col justify-between gap-3 rounded-lg p-4 text-left transition-colors ${
        selected
          ? 'bg-blueberry text-plate shadow-md'
          : 'surface-card hover:bg-surface-tinted/50'
      }`}
    >
      <span
        className={`flex items-center gap-2 text-xs font-medium ${
          selected ? 'text-plate/80' : 'text-stem'
        }`}
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: t.color }}
        />
        <span className="line-clamp-2">{def.label}</span>
      </span>

      <span
        className={`text-2xl font-bold tabular-nums ${
          selected ? 'text-plate' : 'text-blueberry'
        }`}
      >
        {evaluation ? evaluation.value : '—'}
        <span
          className={`ml-1 text-xs font-normal ${
            selected ? 'text-plate/70' : 'text-stem'
          }`}
        >
          {def.unit}
        </span>
      </span>

      <span className="self-start">
        <StatusBadge status={status} compact />
      </span>
    </button>
  );
}

