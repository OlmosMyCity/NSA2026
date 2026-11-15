/**
 * @module domain/health/trends
 * Pure time-series transformation utilities for longitudinal telemetry charts:
 * window filtering, Y-axis domain framing, and threshold background band synthesis.
 */

import { evaluateIndicator } from './evaluate';
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

/** Extracts a chronologically sorted series for one indicator within the trailing `days` window ending at `now`. */
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

/** Computes the Y-axis domain covering observed data and the full green band with padding, clamped to physical limits. */
export function trendDomain(indicator: IndicatorId, points: TrendPoint[]): [number, number] {
  const def = INDICATORS[indicator];
  const { green } = def.thresholds;
  const values = points.map((p) => p.value);
  let lo = Math.min(...values, green.min ?? Infinity);
  let hi = Math.max(...values, green.max ?? -Infinity);
  if (!Number.isFinite(lo)) lo = def.input.min;
  if (!Number.isFinite(hi)) hi = def.input.max;
  const pad = Math.max((hi - lo) * 0.15, def.input.step * 2);
  return [Math.max(def.input.min, lo - pad), Math.min(def.input.max, hi + pad)];
}

/**
 * Generates contiguous green/amber/red bands covering `[lo, hi]` by uniformly sampling
 * the domain and merging adjacent intervals with identical status, avoiding manual
 * special-casing across open/closed threshold combinations.
 */
export function statusBands(indicator: IndicatorId, [lo, hi]: [number, number], steps = 400): StatusBand[] {
  const bands: StatusBand[] = [];
  const dv = (hi - lo) / steps;
  for (let i = 0; i < steps; i++) {
    const a = lo + i * dv;
    const status = evaluateIndicator(indicator, a + dv / 2).status as StatusBand['status'];
    const last = bands.at(-1);
    if (last && last.status === status) last.to = a + dv;
    else bands.push({ from: a, to: a + dv, status });
  }
  return bands;
}

export interface TrendSummary {
  last: TrendPoint | null;
  average: number | null;
  outOfRange: number;
}

/** Computes latest reading, arithmetic mean, and out-of-range (`amber` or `red`) count for a trend series. */
export function summarizeTrend(points: TrendPoint[]): TrendSummary {
  if (!points.length) return { last: null, average: null, outOfRange: 0 };
  const average = points.reduce((s, p) => s + p.value, 0) / points.length;
  return {
    last: points.at(-1) ?? null,
    average,
    outOfRange: points.filter((p) => p.status === 'amber' || p.status === 'red').length,
  };
}
