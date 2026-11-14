import { INDICATORS } from './indicators';
import type { HealthStatus, IndicatorEvaluation, IndicatorId, Range } from './types';

const inRange = (value: number, { min = -Infinity, max = Infinity }: Range) =>
  value >= min && value <= max;

/**
 * Evaluación local (optimista) para dar feedback inmediato en la UI.
 * La fuente de verdad es `evaluateReading` del backend.
 */
export function evaluateIndicator(indicator: IndicatorId, value: number): IndicatorEvaluation {
  if (!Number.isFinite(value)) return { indicator, value, status: 'unknown' };
  const { green, amber } = INDICATORS[indicator].thresholds;
  let status: HealthStatus = 'red';
  if (inRange(value, green)) status = 'green';
  else if (amber.some((r) => inRange(value, r))) status = 'amber';
  return { indicator, value, status };
}

const SEVERITY: Record<HealthStatus, number> = { unknown: 0, green: 1, amber: 2, red: 3 };

/** El peor estado manda: se usa para colorear una zona de la figura. */
export function worstStatus(statuses: HealthStatus[]): HealthStatus {
  return statuses.reduce<HealthStatus>(
    (worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst),
    'unknown',
  );
}
