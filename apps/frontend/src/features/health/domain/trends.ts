import { evaluateIndicator, nominalBounds } from './evaluate';
import { INDICATORS } from './indicators';
import type { HealthStatus, IndicatorId, IndicatorReading } from './types';

export interface TrendPoint {
  t: number;
  value: number;
  status: HealthStatus;
}

export interface StatusBand {
  from: number;
  to: number;
  status: Exclude<HealthStatus, 'unknown'>;
}

export const RANGE_PRESETS = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
] as const;

export type RangeDays = (typeof RANGE_PRESETS)[number]['days'];

/** Serie temporal de un indicador dentro de los últimos `days` días respecto a `now`. */
export function buildTrend(
  readings: IndicatorReading[],
  indicator: IndicatorId,
  days: number,
  now = Date.now(),
): TrendPoint[] {
  const from = now - days * 86_400_000;
  return readings
    .filter((r) => r.indicator === indicator)
    .map((r) => ({ t: Date.parse(r.takenAt), value: r.value }))
    .filter((p) => p.t >= from && p.t <= now)
    .sort((a, b) => a.t - b.t)
    .map((p) => ({ ...p, status: evaluateIndicator(indicator, p.value).status }));
}

/** Dominio Y: datos + rango verde completo, con margen, dentro de los límites físicos. */
export function trendDomain(indicator: IndicatorId, points: TrendPoint[]): [number, number] {
  const def = INDICATORS[indicator];
  const green = nominalBounds(indicator);
  const values = points.map((p) => p.value);
  let lo = Math.min(...values, green.min ?? Infinity);
  let hi = Math.max(...values, green.max ?? -Infinity);
  if (!Number.isFinite(lo)) lo = def.input.min;
  if (!Number.isFinite(hi)) hi = def.input.max;
  const pad = Math.max((hi - lo) * 0.15, def.input.step * 2);
  return [Math.max(def.input.min, lo - pad), Math.min(def.input.max, hi + pad)];
}

/**
 * Bandas verde/ámbar/rojo que cubren [lo, hi], calculadas directamente de los tramos
 * del indicador. Como los tramos son contiguos, las bandas tampoco dejan huecos.
 */
export function statusBands(indicator: IndicatorId, [lo, hi]: [number, number]): StatusBand[] {
  const bands: StatusBand[] = [];
  let from = -Infinity;
  for (const s of INDICATORS[indicator].segments) {
    const to = s.lt ?? s.lte ?? Infinity;
    const a = Math.max(from, lo);
    const b = Math.min(to, hi);
    if (b > a) bands.push({ from: a, to: b, status: s.status });
    from = to;
  }
  return bands;
}

export interface TrendSummary {
  last: TrendPoint | null;
  average: number | null;
  outOfRange: number;
}

export function summarizeTrend(points: TrendPoint[]): TrendSummary {
  if (!points.length) return { last: null, average: null, outOfRange: 0 };
  const average = points.reduce((s, p) => s + p.value, 0) / points.length;
  return {
    last: points.at(-1) ?? null,
    average,
    outOfRange: points.filter((p) => p.status === 'amber' || p.status === 'red').length,
  };
}
