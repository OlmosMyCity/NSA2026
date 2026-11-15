import { INDICATORS_BY_ZONE } from './indicators';
import { evaluateIndicator, worstStatus } from './evaluate';
import type { BodyZoneId, IndicatorReading, HealthStatus, IndicatorEvaluation, IndicatorId } from './types';

/** Última medición de cada indicador (por `takenAt`). */
export function latestByIndicator(readings: IndicatorReading[]): Partial<Record<IndicatorId, IndicatorReading>> {
  const latest: Partial<Record<IndicatorId, IndicatorReading>> = {};
  for (const r of readings) {
    const prev = latest[r.indicator];
    if (!prev || Date.parse(r.takenAt) > Date.parse(prev.takenAt)) latest[r.indicator] = r;
  }
  return latest;
}

export interface ZoneSummary {
  zone: BodyZoneId;
  status: HealthStatus;
  evaluations: IndicatorEvaluation[];
}

/** Estado de cada zona de la figura según la última medición de sus indicadores. */
export function summarizeZones(
  readings: IndicatorReading[],
  phaseId?: string | null,
): Record<BodyZoneId, ZoneSummary> {
  const latest = latestByIndicator(readings);
  const result = {} as Record<BodyZoneId, ZoneSummary>;
  for (const zone of Object.keys(INDICATORS_BY_ZONE) as BodyZoneId[]) {
    const evaluations = INDICATORS_BY_ZONE[zone]
      .map((id) => latest[id])
      .filter((r): r is IndicatorReading => !!r)
      .map((r) => evaluateIndicator(r.indicator, r.value, phaseId));
    result[zone] = { zone, status: worstStatus(evaluations.map((e) => e.status)), evaluations };
  }
  return result;
}
