/**
 * @module domain/health/types
 * Crew health domain model for the Artemis IV physiological digital twin.
 * Combines backend telemetry API contracts with 3D anatomical zone, dashboard,
 * and longitudinal trend visualization primitives.
 */

/** Overall triage severity status computed by the backend rule engine. */
export type ApiHealthStatus = 'OK' | 'WARNING' | 'CRITICAL';

/** Persisted crew biomedical telemetry reading returned by the API. */
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
  /** Subjective behavioral mood score on a 1 (critical stress) to 5 (excellent) scale. */
  mood: number;
  status: ApiHealthStatus;
  alerts: string[];
  recommendation?: string | null;
  notes?: string | null;
  /** ISO 8601 timestamp when measurements were captured. */
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

/** Input payload for recording or locally evaluating a crew health reading. */
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

/** Deterministic clinical assessment produced for a reading. */
export interface EvaluationResult {
  status: ApiHealthStatus;
  alerts: string[];
  recommendation: string;
}

/** Aggregated astronaut telemetry overview including latest reading and alert count. */
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

/** Visual traffic-light status for an indicator. `unknown` denotes no recent measurement. */
export type HealthStatus = 'green' | 'amber' | 'red' | 'unknown';

/** MVP physiological and behavioral indicator identifiers (see `docs/NASA_SPACE_APPS_CHALLENGE.md`). */
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

/** Five selectable physiological zones on the 3D anatomical twin. */
export type BodyZoneId = 'heart' | 'brain' | 'blood' | 'bones' | 'sleep';

/** Five canonical human spaceflight hazards defined by the NASA Human Research Program (HRP). */
export type SpaceHazard =
  | 'radiation'
  | 'isolation'
  | 'distance'
  | 'gravity'
  | 'hostileEnvironment';

/** Closed numeric interval `[min, max]`; an `undefined` bound represents an open-ended limit. */
export interface Range {
  min?: number;
  max?: number;
}

/**
 * Deterministic threshold specification for an indicator.
 * Values evaluate to `green` inside `green`, `amber` inside any interval in `amber`,
 * and `red` outside both.
 */
export interface IndicatorThresholds {
  green: Range;
  amber: Range[];
}

/** Static metadata, zone mapping, HRP hazard links, and threshold bounds for an indicator. */
export interface IndicatorDefinition {
  id: IndicatorId;
  label: string;
  unit: string;
  zone: BodyZoneId;
  hazards: SpaceHazard[];
  thresholds: IndicatorThresholds;
  /** Step granularity and plausible physiological limits for form inputs and chart axes. */
  input: { min: number; max: number; step: number };
}

/** Single-indicator telemetry point flattened from an `ApiHealthReading` (see `api-adapter.ts`). */
export interface IndicatorReading {
  id: string;
  astronautId: string;
  indicator: IndicatorId;
  value: number;
  /** ISO 8601 timestamp */
  takenAt: string;
}

/** Result of evaluating a single indicator value against its deterministic thresholds. */
export interface IndicatorEvaluation {
  indicator: IndicatorId;
  value: number;
  status: HealthStatus;
}
