/**
 * @module health/domain/summary
 * Aggregates flattened indicator telemetry into per-zone physiological summaries
 * across the 5 Digital Twin zones (`heart`, `brain`, `blood`, `bones`, `sleep`).
 */

import { INDICATORS_BY_ZONE } from './indicators';
import { evaluateIndicator, worstStatus } from './evaluate';
import { evaluateFreshness, isLiveIndicator } from './freshness';
import type { BodyZoneId, IndicatorReading, HealthStatus, IndicatorEvaluation, IndicatorId } from './types';

/** Returns the latest reading per indicator based on `takenAt` timestamp. */
export function latestByIndicator(readings: IndicatorReading[]): Partial<Record<IndicatorId, IndicatorReading>> {
  const latest: Partial<Record<IndicatorId, IndicatorReading>> = {};
  for (const r of readings) {
    const prev = latest[r.indicator];
    if (!prev || Date.parse(r.takenAt) > Date.parse(prev.takenAt)) latest[r.indicator] = r;
  }
  return latest;
}

/** Deterministic status and constituent indicator evaluations for a single body zone. */
export interface ZoneSummary {
  zone: BodyZoneId;
  status: HealthStatus;
  evaluations: IndicatorEvaluation[];
  /** Algún signo vivo de la zona venció: la zona no tiene estado actual. */
  hasExpiredVitals: boolean;
}

/**
 * Estado de cada zona de la figura según la última medición de sus indicadores.
 * Con `nowMs`, los signos vivos vencidos se descartan y su zona queda sin estado:
 * un dato viejo nunca se muestra como actual. Sin `nowMs` no se aplica vigencia
 * (simulaciones What-If).
 */
export function summarizeZones(
  readings: IndicatorReading[],
  phaseId?: string | null,
  nowMs?: number,
): Record<BodyZoneId, ZoneSummary> {
  const latest = latestByIndicator(readings);
  const isExpired = (r: IndicatorReading) =>
    nowMs !== undefined && isLiveIndicator(r.indicator) && evaluateFreshness(r.takenAt, nowMs).phase === 'expired';

  const result = {} as Record<BodyZoneId, ZoneSummary>;
  for (const zone of Object.keys(INDICATORS_BY_ZONE) as BodyZoneId[]) {
    const measured = INDICATORS_BY_ZONE[zone]
      .map((id) => latest[id])
      .filter((r): r is IndicatorReading => !!r);
    const hasExpiredVitals = measured.some(isExpired);
    const evaluations = measured
      .filter((r) => !isExpired(r))
      .map((r) => evaluateIndicator(r.indicator, r.value, phaseId));
    result[zone] = {
      zone,
      status: hasExpiredVitals ? 'unknown' : worstStatus(evaluations.map((e) => e.status)),
      evaluations,
      hasExpiredVitals,
    };
  }
  return result;
}
