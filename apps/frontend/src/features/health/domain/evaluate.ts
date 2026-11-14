import { INDICATORS } from './indicators';
import { getIndicatorSegments } from './phaseNorms';
import type {
  ApiHealthStatus,
  EvaluationResult,
  HealthAlert,
  HealthStatus,
  IndicatorEvaluation,
  IndicatorId,
  StatusSegment,
  Vitals,
} from './types';

const contains = (s: StatusSegment, value: number) =>
  (s.lt !== undefined && value < s.lt) ||
  (s.lte !== undefined && value <= s.lte) ||
  (s.lt === undefined && s.lte === undefined);

/**
 * Estado de un valor según los tramos del indicador (misma regla que el backend).
 * Con `phaseId`, usa las normas fisiológicas de esa fase (NASA-STD-3001 / NASA HRP).
 */
export function evaluateIndicator(indicator: IndicatorId, value: number, phaseId?: string | null): IndicatorEvaluation {
  if (!Number.isFinite(value)) return { indicator, value, status: 'unknown' };
  const segment = getIndicatorSegments(indicator, phaseId).find((s) => contains(s, value));
  return { indicator, value, status: segment?.status ?? 'red' };
}

const SEVERITY: Record<HealthStatus, number> = { unknown: 0, green: 1, amber: 2, red: 3 };

/** El peor estado manda: se usa para colorear una zona de la figura. */
export function worstStatus(statuses: HealthStatus[]): HealthStatus {
  return statuses.reduce<HealthStatus>(
    (worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst),
    'unknown',
  );
}

/** Límites del tramo verde: `[min, max]` con `undefined` si no hay límite por ese lado. */
export function nominalBounds(indicator: IndicatorId): { min?: number; max?: number; minInclusive: boolean; maxInclusive: boolean } {
  const segments = INDICATORS[indicator].segments;
  const i = segments.findIndex((s) => s.status === 'green');
  const prev = segments[i - 1];
  const green = segments[i];
  return {
    min: prev ? (prev.lt ?? prev.lte) : undefined,
    minInclusive: prev ? prev.lt !== undefined : true,
    max: green.lt ?? green.lte,
    maxInclusive: green.lte !== undefined,
  };
}

/** Texto del rango nominal, p. ej. "50 – 90 bpm", "< 85 mmHg", "≥ 7 h/day". */
export function nominalLabel(indicator: IndicatorId): string {
  const { min, max, minInclusive, maxInclusive } = nominalBounds(indicator);
  const unit = INDICATORS[indicator].unit;
  if (min !== undefined && max !== undefined) {
    return `${minInclusive ? '' : '> '}${min} – ${maxInclusive ? '' : '< '}${max} ${unit}`;
  }
  if (min !== undefined) return `${minInclusive ? '≥' : '>'} ${min} ${unit}`;
  if (max !== undefined) return `${maxInclusive ? '≤' : '<'} ${max} ${unit}`;
  return unit;
}

const TO_API: Record<Exclude<HealthStatus, 'unknown'>, ApiHealthStatus> = {
  green: 'OK',
  amber: 'WARNING',
  red: 'CRITICAL',
};

/** Agrupación de alertas idéntica al backend (la presión arterial es una sola alerta). */
interface AlertGroup {
  key: string;
  label: string;
  checks: Array<[IndicatorId, number]>;
  shown: string;
}

const alertGroups = (v: Vitals): AlertGroup[] => [
  { key: 'heartRate', label: 'Heart rate', checks: [['heartRate', v.heartRateBpm]], shown: `${v.heartRateBpm} bpm` },
  {
    key: 'bloodPressure',
    label: 'Blood pressure',
    checks: [['systolic', v.systolicMmHg], ['diastolic', v.diastolicMmHg]],
    shown: `${v.systolicMmHg}/${v.diastolicMmHg} mmHg`,
  },
  { key: 'glucose', label: 'Blood glucose', checks: [['glucose', v.glucoseMgDl]], shown: `${v.glucoseMgDl} mg/dL` },
  { key: 'temperature', label: 'Body temperature', checks: [['temperature', v.temperatureC]], shown: `${v.temperatureC} °C` },
  { key: 'spo2', label: 'O₂ saturation', checks: [['spo2', v.spo2Pct]], shown: `${v.spo2Pct} %` },
  { key: 'sleep', label: 'Sleep', checks: [['sleepHours', v.sleepHours]], shown: `${v.sleepHours} h` },
  { key: 'mood', label: 'Mood', checks: [['mood', v.mood]], shown: `${v.mood}/5` },
];

export const RECOMMENDATIONS: Record<ApiHealthStatus, string> = {
  OK: 'All parameters within nominal mission ranges. Continue the scheduled routine.',
  WARNING:
    'CAUTION: One or more parameters are outside the nominal range. Repeat the measurement in 4 hours and check hydration and rest before the next shift.',
  CRITICAL:
    'CRITICAL ALERT: Notify the Flight Surgeon at Mission Control immediately. Suspend EVA activity and start the medical containment protocol.',
};

/**
 * Vista previa local del veredicto que calculará el backend al guardar.
 * Usa la misma tabla de tramos, así que el estado coincide con el que se persiste.
 */
export function evaluateVitals(vitals: Vitals): EvaluationResult {
  const alerts: HealthAlert[] = [];
  for (const group of alertGroups(vitals)) {
    const status = worstStatus(group.checks.map(([id, value]) => evaluateIndicator(id, value).status));
    if (status !== 'amber' && status !== 'red') continue;
    const level = TO_API[status] as HealthAlert['level'];
    alerts.push({
      indicator: group.key,
      level,
      value: group.checks[0][1],
      message: `${group.label} ${level === 'CRITICAL' ? 'critical' : 'outside nominal range'} (${group.shown}).`,
    });
  }
  const status: ApiHealthStatus = alerts.some((a) => a.level === 'CRITICAL')
    ? 'CRITICAL'
    : alerts.length
      ? 'WARNING'
      : 'OK';
  return { status, alerts, recommendation: RECOMMENDATIONS[status] };
}
