import { evaluateIndicator, worstStatus } from '@/features/health/domain/evaluate';
import { toIndicatorReadings, type ApiHealthReading } from '@/features/health/domain/api-adapter';
import type { HealthStatus } from '@/features/health/domain/types';

/** Fase de la simulación, tal como la envía el visor en el mensaje `ready`. */
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

/** Una lectura de salud ubicada en el reloj de misión (MET, segundos desde el lanzamiento). */
export interface TimelineReading {
  reading: ApiHealthReading;
  met: number;
  status: HealthStatus;
  /** `null` antes del lanzamiento (línea base en Tierra). */
  phaseId: string | null;
}

/** MET de un instante: segundos desde el lanzamiento (negativo = antes). */
export function metOf(iso: string, missionStart: string): number {
  return (Date.parse(iso) - Date.parse(missionStart)) / 1000;
}

export function phaseAt(phases: MissionPhase[], met: number): MissionPhase | null {
  if (met < 0 || !phases.length) return null;
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

/** Última lectura tomada en o antes de `met`. */
export function readingAt(items: TimelineReading[], met: number): TimelineReading | null {
  let found: TimelineReading | null = null;
  for (const it of items) {
    if (it.met <= met) found = it;
    else break;
  }
  return found;
}

/** Fracción del ancho reservada a la línea base en Tierra (antes de T+0). */
export const BASELINE_SHARE = 0.14;

/**
 * Escala MET → [0, 1]. Igual que la barra del visor: cada fase ocupa un ancho
 * proporcional a log(duración), para que el ascenso (8 min) no desaparezca
 * frente a la NRHO (11 días). Antes de T+0 hay un tramo lineal de línea base.
 */
export function createMissionScale(phases: MissionPhase[], baselineSeconds: number) {
  const w = phases.map((p) => Math.log1p(p.t_end - p.t_start));
  const total = w.reduce((a, b) => a + b, 0) || 1;
  const edges = [BASELINE_SHARE];
  for (const x of w) edges.push(edges[edges.length - 1] + (x / total) * (1 - BASELINE_SHARE));

  function toFraction(met: number): number {
    if (met < 0) {
      const u = baselineSeconds > 0 ? Math.max(0, 1 + met / baselineSeconds) : 1;
      return u * BASELINE_SHARE;
    }
    const i = Math.max(0, phases.findIndex((p) => met <= p.t_end));
    const p = phases[i] ?? phases[phases.length - 1];
    const idx = phases[i] ? i : phases.length - 1;
    const u = Math.min(Math.max((met - p.t_start) / (p.t_end - p.t_start || 1), 0), 1);
    return edges[idx] + u * (edges[idx + 1] - edges[idx]);
  }

  return { toFraction, edges };
}

export function formatMET(met: number): string {
  const sign = met < 0 ? 'T− ' : 'T+ ';
  const s = Math.abs(met);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${sign}${d}d ${pad(h)}:${pad(m)}`;
}
