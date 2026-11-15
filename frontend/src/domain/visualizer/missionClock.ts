/**
 * Mission Elapsed Time (MET) timeline mapping and physiological reading alignment
 * utilities for synchronizing clinical telemetry with the 3D orbital viewer.
 *
 * @module domain/visualizer/missionClock
 */

import { evaluateIndicator, worstStatus } from '@/domain/health/evaluate';
import { toIndicatorReadings, type ApiHealthReading } from '@/domain/health/api-adapter';
import type { HealthStatus } from '@/domain/health/types';

/** Simulation phase metadata emitted by the 3D viewer in its `ready` handshake message. */
export interface MissionPhase {
  id: string;
  name: string;
  t_start: number;
  t_end: number;
}

export interface MissionEvent {
  t: number;
  label: string;
}

/** Health reading anchored on the Mission Elapsed Time (MET, seconds from liftoff) clock. */
export interface TimelineReading {
  reading: ApiHealthReading;
  met: number;
  status: HealthStatus;
  /** `null` prior to liftoff (Earth pre-launch baseline). */
  phaseId: string | null;
}

/** Computes Mission Elapsed Time (MET) in seconds from liftoff (negative indicates pre-launch). */
export function metOf(iso: string, missionStart: string): number {
  const t = Date.parse(iso);
  const t0 = Date.parse(missionStart);
  if (!Number.isFinite(t) || !Number.isFinite(t0)) return 0;
  return (t - t0) / 1000;
}

export function phaseAt(phases: MissionPhase[], met: number): MissionPhase | null {
  if (!Number.isFinite(met) || met < 0 || !phases.length) return null;
  return phases.find((p) => met <= p.t_end) ?? phases[phases.length - 1];
}

/** Estado de una lectura: el peor de sus indicadores (ajustado a la fase de vuelo si aplica). */
export function readingStatus(r: ApiHealthReading, phaseId?: string | null): HealthStatus {
  return worstStatus(
    toIndicatorReadings(r).map((x) => evaluateIndicator(x.indicator, x.value, phaseId).status),
  );
}

export function readingsOnTimeline(
  readings: ApiHealthReading[],
  missionStart: string,
  phases: MissionPhase[],
): TimelineReading[] {
  return readings
    .map((reading) => {
      const met = metOf(reading.takenAt, missionStart);
      const phaseId = phaseAt(phases, met)?.id ?? null;
      return { reading, met, status: readingStatus(reading, phaseId), phaseId };
    })
    .sort((a, b) => a.met - b.met);
}

/** Returns the most recent reading recorded at or before `met` (expects ascending MET order). */
export function readingAt(items: TimelineReading[], met: number): TimelineReading | null {
  let found: TimelineReading | null = null;
  for (const it of items) {
    if (it.met <= met) found = it;
    else break;
  }
  return found;
}

/** Fraction of timeline width reserved for the pre-launch Earth baseline (before T+0). */
export const BASELINE_SHARE = 0.14;

/**
 * Maps MET -> [0, 1] horizontal coordinates. Matches the 3D viewer scrubber:
 * each flight phase occupies width proportional to log(1 + duration) so brief phases
 * like ascent (8 min) remain visible alongside multi-day NRHO segments, preceded by
 * a linear baseline span before T+0.
 */
export function createMissionScale(phases: MissionPhase[], baselineSeconds: number) {
  const safePhases = Array.isArray(phases) ? phases : [];
  const safeBaseline = Number.isFinite(baselineSeconds) && baselineSeconds > 0 ? baselineSeconds : 86400;
  const w = safePhases.map((p) => Math.log1p(Math.max(0, p.t_end - p.t_start)));
  const total = w.reduce((a, b) => a + b, 0) || 1;
  const edges = [BASELINE_SHARE];
  for (const x of w) edges.push(edges[edges.length - 1] + (x / total) * (1 - BASELINE_SHARE));

  function toFraction(met: number): number {
    if (!Number.isFinite(met)) return BASELINE_SHARE;
    if (met < 0) {
      const u = safeBaseline > 0 ? Math.max(0, 1 + met / safeBaseline) : 1;
      return u * BASELINE_SHARE;
    }
    if (!safePhases.length) {
      const fallbackSpan = 86400 * 8;
      return BASELINE_SHARE + Math.min(1, Math.max(0, met / fallbackSpan)) * (1 - BASELINE_SHARE);
    }
    const found = safePhases.findIndex((p) => met <= p.t_end);
    const idx = found >= 0 ? found : safePhases.length - 1;
    const p = safePhases[idx];
    const span = p.t_end - p.t_start || 1;
    const u = Math.min(Math.max((met - p.t_start) / span, 0), 1);
    return edges[idx] + u * ((edges[idx + 1] ?? 1) - edges[idx]);
  }

  return { toFraction, edges };
}

export function formatSafeDate(formatter: Intl.DateTimeFormat, iso?: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? formatter.format(ts) : '—';
}

export function formatMET(met: number): string {
  if (!Number.isFinite(met)) return 'T+ 0d 00:00';
  const sign = met < 0 ? 'T− ' : 'T+ ';
  const s = Math.abs(met);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${sign}${d}d ${pad(h)}:${pad(m)}`;
}
