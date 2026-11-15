import { getIndicatorThresholds } from './phaseNorms';
import type { HealthStatus, IndicatorEvaluation, IndicatorId, Range } from './types';

const inRange = (value: number, { min = -Infinity, max = Infinity }: Range) =>
  value >= min && value <= max;

/**
 * Optimistic client-side evaluation providing immediate UI feedback.
 * When `phaseId` is supplied, adapts thresholds to phase-specific physiological norms
 * (NASA-STD-3001 / NASA HRP).
 */
export function evaluateIndicator(
  indicator: IndicatorId,
  value: number,
  phaseId?: string | null,
): IndicatorEvaluation {
  if (!Number.isFinite(value)) return { indicator, value, status: 'unknown' };
  const { green, amber } = getIndicatorThresholds(indicator, phaseId);
  let status: HealthStatus = 'red';
  if (inRange(value, green)) status = 'green';
  else if (amber.some((r) => inRange(value, r))) status = 'amber';
  return { indicator, value, status };
}

const SEVERITY: Record<HealthStatus, number> = { unknown: 0, green: 1, amber: 2, red: 3 };

/** Returns the highest-severity status across a collection (`red > amber > green > unknown`), used to tint each 3D zone. */
export function worstStatus(statuses: HealthStatus[]): HealthStatus {
  return statuses.reduce<HealthStatus>(
    (worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst),
    'unknown',
  );
}
