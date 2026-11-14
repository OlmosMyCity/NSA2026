/**
 * Modelo de dominio de salud de la tripulación (Artemis IV Crew Health).
 * Combina contratos de API backend y visualización de figura 3D / dashboard / gráficas.
 */

/** Estado general que calcula el backend en Prisma / Express. */
export type ApiHealthStatus = 'OK' | 'WARNING' | 'CRITICAL';

export interface HealthReading {
  id: string;
  astronautId: string;
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  glucoseMgDl: number;
  temperatureC: number;
  spo2Pct: number;
  sleepHours: number;
  mood: number;
  status: ApiHealthStatus;
  alerts: string[];
  recommendation?: string | null;
  notes?: string | null;
  takenAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  astronaut?: {
    id: string;
    name: string;
    role: string;
  };
}

export interface HealthReadingInput {
  astronautId: string;
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  glucoseMgDl: number;
  temperatureC: number;
  spo2Pct: number;
  sleepHours: number;
  mood: number;
  notes?: string | null;
  takenAt?: string;
}

export interface EvaluationResult {
  status: ApiHealthStatus;
  alerts: string[];
  recommendation: string;
}

export interface AstronautHealthSummary {
  astronaut: {
    id: string;
    name: string;
    role: string;
    mission?: { id: string; name: string };
  };
  latestReading?: HealthReading | null;
  status: ApiHealthStatus;
  alertsSummary: string[];
  totalReadingsCount: number;
}

/** Estado semáforo visual de un indicador. `unknown` = sin medición reciente. */
export type HealthStatus = 'green' | 'amber' | 'red' | 'unknown';

/** Identificadores de los indicadores del MVP (ver docs/NASA_SPACE_APPS_CHALLENGE.md). */
export type IndicatorId =
  | 'heartRate'
  | 'systolic'
  | 'diastolic'
  | 'glucose'
  | 'temperature'
  | 'spo2'
  | 'sleepHours'
  | 'mood'
  | 'resistanceExercise';

/** Zonas clicables de la figura humana. */
export type BodyZoneId = 'heart' | 'brain' | 'blood' | 'bones' | 'sleep';

/** Peligros del vuelo espacial según NASA Human Research Program. */
export type SpaceHazard =
  | 'radiation'
  | 'isolation'
  | 'distance'
  | 'gravity'
  | 'hostileEnvironment';

/** Rango cerrado [min, max]; un extremo `undefined` significa sin límite. */
export interface Range {
  min?: number;
  max?: number;
}

/**
 * Umbrales de un indicador. Un valor es verde si cae en `green`,
 * ámbar si cae en alguno de `amber`, y rojo en cualquier otro caso.
 */
export interface IndicatorThresholds {
  green: Range;
  amber: Range[];
}

export interface IndicatorDefinition {
  id: IndicatorId;
  label: string;
  unit: string;
  zone: BodyZoneId;
  hazards: SpaceHazard[];
  thresholds: IndicatorThresholds;
  /** Paso y límites físicos razonables para inputs y ejes de gráficas. */
  input: { min: number; max: number; step: number };
}

/** Valor de un solo indicador; se obtiene aplanando un `ApiHealthReading` (ver api-adapter.ts). */
export interface IndicatorReading {
  id: string;
  astronautId: string;
  indicator: IndicatorId;
  value: number;
  /** ISO 8601 */
  takenAt: string;
}

export interface IndicatorEvaluation {
  indicator: IndicatorId;
  value: number;
  status: HealthStatus;
}
