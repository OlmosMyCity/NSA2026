/**
 * @module service/health/digitalTwin
 * Pure deterministic Astronaut Digital Twin engine modeling 5 physiological body zones
 * (`heart`, `brain`, `blood`, `bones`, `sleep`) by combining latest vital indicators,
 * longitudinal trend direction, measurement staleness windows, and NASA HRP hazard loads.
 */

import {
  BODY_ZONES,
  computeZoneHazardLoad,
  type BodyZoneId,
  type MissionEnvironment,
  type RadiationContext,
  type ZoneHazardLoad,
} from "./hazards.js";
import { classifyIndicator, type OverallHealthStatus, type RuleIndicator } from "./evaluateReading.js";

/** Clinical status tier assigned to each indicator and aggregated per body zone. */
export type ZoneHealthStatus = "green" | "amber" | "red" | "unknown";

/** Longitudinal direction relative to each indicator's optimal `nominalTarget`. */
export type TrendDirection = "improving" | "stable" | "worsening";

/** Discrete operational risk classification aligned with triage scoring (`0`–`3`). */
export type ZoneRiskLevel = "stable" | "watch" | "elevated" | "critical";

/** Canonical physiological and behavioral indicator identifiers tracked by the twin. */
export type IndicatorId =
  | "heartRate"
  | "systolic"
  | "diastolic"
  | "glucose"
  | "temperature"
  | "spo2"
  | "sleepHours"
  | "mood"
  | "resistanceExercise";

/** Timestamped biomedical and countermeasure reading consumed by the Digital Twin. */
export interface TimedHealthReading {
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  glucoseMgDl: number;
  temperatureC: number;
  spo2Pct: number;
  sleepHours: number;
  mood: number;
  resistanceExerciseMin?: number | null;
  takenAt: string | Date;
}

/** Latest evaluated state and staleness metadata for a single physiological indicator. */
export interface IndicatorSnapshot {
  id: IndicatorId;
  value: number | null;
  unit: string;
  status: ZoneHealthStatus;
  isOverdue: boolean;
  hoursSinceLast: number | null;
}

/** Aggregated Digital Twin state for one body zone, combining clinical status, trend, staleness, and hazards. */
export interface ZoneTwinState {
  zone: BodyZoneId;
  status: ZoneHealthStatus;
  riskLevel: ZoneRiskLevel;
  /** Discrete risk tier `0..3` corresponding to `stable` / `watch` / `elevated` / `critical`. */
  riskScore: 0 | 1 | 2 | 3;
  trend: TrendDirection;
  isOverdue: boolean;
  indicators: IndicatorSnapshot[];
  hazardLoad: ZoneHazardLoad;
}

/** Input contract for deterministic Digital Twin evaluation. */
export interface DigitalTwinInput {
  readings: TimedHealthReading[];
  environment: MissionEnvironment;
  radiation?: RadiationContext;
  /** Reference evaluation timestamp (epoch ms, ISO string, or `Date`); defaults to `Date.now()`. */
  now?: number | string | Date;
}

/** Complete multi-zone Digital Twin snapshot consumed by `decideByRules` and Gemini Decision 1. */
export interface DigitalTwinState {
  evaluatedAt: string;
  environment: MissionEnvironment;
  radiation: RadiationContext;
  overallStatus: ZoneHealthStatus;
  overallRiskLevel: ZoneRiskLevel;
  overdueZones: BodyZoneId[];
  zones: Record<BodyZoneId, ZoneTwinState>;
}

/** Hypothetical environment, radiation, or vital overrides applied in "What-If" projections. */
export interface WhatIfOverrides {
  environment?: MissionEnvironment;
  radiation?: Partial<RadiationContext>;
  readingOverrides?: Partial<Omit<TimedHealthReading, "takenAt">>;
}

/** Baseline vs. projected Digital Twin comparison returned by `simulateWhatIf`. */
export interface DigitalTwinSimulationResult {
  baseline: DigitalTwinState;
  projected: DigitalTwinState;
  changedZones: BodyZoneId[];
}

interface IndicatorSpec {
  id: IndicatorId;
  zone: BodyZoneId;
  unit: string;
  /** Maximum age in hours before a measurement is considered overdue. */
  overdueHours: number;
  /** Optimal physiological center used to determine whether shifts move toward or away from nominal. */
  nominalTarget: number;
  /** Minimum absolute distance shift from prior mean required to trigger `improving` or `worsening`. */
  significantDelta: number;
  extract: (r: TimedHealthReading) => number | null | undefined;
  evaluate: (v: number) => Exclude<ZoneHealthStatus, "unknown">;
}

const INDICATOR_SPECS: Record<IndicatorId, IndicatorSpec> = {
  heartRate: {
    id: "heartRate",
    zone: "heart",
    unit: "lpm",
    overdueHours: 12,
    nominalTarget: 70,
    significantDelta: 6,
    extract: (r) => r.heartRateBpm,
    evaluate: (v) => bandStatus("heartRate", v),
  },
  systolic: {
    id: "systolic",
    zone: "heart",
    unit: "mmHg",
    overdueHours: 12,
    nominalTarget: 115,
    significantDelta: 7,
    extract: (r) => r.systolicMmHg,
    evaluate: (v) => bandStatus("systolic", v),
  },
  diastolic: {
    id: "diastolic",
    zone: "heart",
    unit: "mmHg",
    overdueHours: 12,
    nominalTarget: 75,
    significantDelta: 5,
    extract: (r) => r.diastolicMmHg,
    evaluate: (v) => bandStatus("diastolic", v),
  },
  glucose: {
    id: "glucose",
    zone: "blood",
    unit: "mg/dL",
    overdueHours: 24,
    nominalTarget: 95,
    significantDelta: 12,
    extract: (r) => r.glucoseMgDl,
    evaluate: (v) => bandStatus("glucose", v),
  },
  temperature: {
    id: "temperature",
    zone: "blood",
    unit: "°C",
    overdueHours: 12,
    nominalTarget: 36.6,
    significantDelta: 0.3,
    extract: (r) => r.temperatureC,
    evaluate: (v) => bandStatus("temperature", v),
  },
  spo2: {
    id: "spo2",
    zone: "blood",
    unit: "%",
    overdueHours: 12,
    nominalTarget: 98,
    significantDelta: 1.5,
    extract: (r) => r.spo2Pct,
    evaluate: (v) => bandStatus("spo2", v),
  },
  sleepHours: {
    id: "sleepHours",
    zone: "sleep",
    unit: "h/day",
    overdueHours: 24,
    nominalTarget: 8,
    significantDelta: 0.7,
    extract: (r) => r.sleepHours,
    evaluate: (v) => bandStatus("sleepHours", v),
  },
  mood: {
    id: "mood",
    zone: "brain",
    unit: "1–5",
    overdueHours: 24,
    nominalTarget: 5,
    significantDelta: 0.8,
    extract: (r) => r.mood,
    evaluate: (v) => bandStatus("mood", v),
  },
  resistanceExercise: {
    id: "resistanceExercise",
    zone: "bones",
    unit: "min/day",
    overdueHours: 48,
    nominalTarget: 75,
    significantDelta: 15,
    extract: (r) => r.resistanceExerciseMin,
    evaluate: (v) => {
      if (v < 30) return "red";
      if (v < 60) return "amber";
      return "green";
    },
  },
};

/** Los indicadores medidos usan la tabla clínica única (HEALTH_BANDS) de evaluateReading. */
const BAND_TO_ZONE: Record<OverallHealthStatus, Exclude<ZoneHealthStatus, "unknown">> = {
  OK: "green",
  WARNING: "amber",
  CRITICAL: "red",
};

function bandStatus(indicator: RuleIndicator, value: number): Exclude<ZoneHealthStatus, "unknown"> {
  return BAND_TO_ZONE[classifyIndicator(indicator, value)];
}

const ZONE_INDICATORS: Record<BodyZoneId, IndicatorId[]> = {
  heart: ["heartRate", "systolic", "diastolic"],
  brain: ["mood"],
  blood: ["glucose", "temperature", "spo2"],
  bones: ["resistanceExercise"],
  sleep: ["sleepHours"],
};

const STATUS_SEVERITY: Record<ZoneHealthStatus, number> = {
  unknown: 0,
  green: 1,
  amber: 2,
  red: 3,
};

const RISK_LEVEL_BY_SCORE: Record<0 | 1 | 2 | 3, ZoneRiskLevel> = {
  0: "stable",
  1: "watch",
  2: "elevated",
  3: "critical",
};

function toTimestampMs(value: number | string | Date | undefined): number {
  if (value === undefined) return Date.now();
  if (typeof value === "number") return value;
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

function worstStatus(statuses: ZoneHealthStatus[]): ZoneHealthStatus {
  return statuses.reduce<ZoneHealthStatus>(
    (worst, current) =>
      STATUS_SEVERITY[current] > STATUS_SEVERITY[worst] ? current : worst,
    "unknown",
  );
}

/**
 * Computes an indicator trend by comparing the latest reading against the mean of up to
 * 6 preceding readings using Euclidean distance to `nominalTarget`.
 */
function computeIndicatorTrend(
  spec: IndicatorSpec,
  sortedAsc: TimedHealthReading[],
): TrendDirection {
  const values = sortedAsc
    .map((r) => spec.extract(r))
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (values.length < 2) return "stable";

  const latest = values[values.length - 1];
  const prevSlice = values.slice(
    Math.max(0, values.length - 7),
    values.length - 1,
  );
  const prevAvg = prevSlice.reduce((sum, v) => sum + v, 0) / prevSlice.length;

  const latestDist = Math.abs(latest - spec.nominalTarget);
  const prevDist = Math.abs(prevAvg - spec.nominalTarget);
  const distDelta = latestDist - prevDist;

  if (Math.abs(distDelta) < spec.significantDelta) return "stable";
  return distDelta > 0 ? "worsening" : "improving";
}

function combineZoneTrend(directions: TrendDirection[]): TrendDirection {
  if (directions.includes("worsening")) return "worsening";
  if (directions.includes("improving")) return "improving";
  return "stable";
}

/**
 * Maps clinical status, longitudinal trend, measurement staleness, and environmental
 * hazard load onto the discrete triage risk score (`0..3`).
 */
function computeZoneRiskScore(
  status: ZoneHealthStatus,
  trend: TrendDirection,
  isOverdue: boolean,
  hazardTotal: number,
): 0 | 1 | 2 | 3 {
  if (status === "red") return 3;

  if (status === "amber") {
    if (trend === "worsening" && (isOverdue || hazardTotal >= 0.7)) return 3;
    return 2;
  }

  if (status === "unknown") {
    return hazardTotal >= 0.75 ? 2 : 1;
  }

  // status === "green"
  if (isOverdue || trend === "worsening" || hazardTotal >= 0.75) {
    return 1;
  }

  return 0;
}

/**
 * Pure deterministic Astronaut Digital Twin evaluation engine (zero side effects).
 */
export function evaluateDigitalTwin(input: DigitalTwinInput): DigitalTwinState {
  const nowMs = toTimestampMs(input.now);
  const radiation: RadiationContext = input.radiation ?? {
    stormScale: "S0_NOMINAL",
    shielding: "CREW_CABIN_NOMINAL",
  };

  const sortedAsc = [...input.readings].sort(
    (a, b) => toTimestampMs(a.takenAt) - toTimestampMs(b.takenAt),
  );

  const zones = {} as Record<BodyZoneId, ZoneTwinState>;
  const overdueZones: BodyZoneId[] = [];

  for (const zone of BODY_ZONES) {
    const indicatorIds = ZONE_INDICATORS[zone];
    const snapshots: IndicatorSnapshot[] = [];
    const trends: TrendDirection[] = [];

    for (const id of indicatorIds) {
      const spec = INDICATOR_SPECS[id];
      // Locate the most recent reading containing a finite numeric value for this indicator
      let latestReading: TimedHealthReading | null = null;
      let latestValue: number | null = null;

      for (let i = sortedAsc.length - 1; i >= 0; i--) {
        const candidate = spec.extract(sortedAsc[i]);
        if (typeof candidate === "number" && Number.isFinite(candidate)) {
          latestReading = sortedAsc[i];
          latestValue = candidate;
          break;
        }
      }

      if (latestReading === null || latestValue === null) {
        snapshots.push({
          id,
          value: null,
          unit: spec.unit,
          status: "unknown",
          isOverdue: true,
          hoursSinceLast: null,
        });
        continue;
      }

      const ageHours = Math.max(
        0,
        Number(
          ((nowMs - toTimestampMs(latestReading.takenAt)) / 3_600_000).toFixed(
            1,
          ),
        ),
      );
      const isOverdue = ageHours > spec.overdueHours;

      snapshots.push({
        id,
        value: latestValue,
        unit: spec.unit,
        status: spec.evaluate(latestValue),
        isOverdue,
        hoursSinceLast: ageHours,
      });
      trends.push(computeIndicatorTrend(spec, sortedAsc));
    }

    const status = worstStatus(snapshots.map((s) => s.status));
    const isOverdue = snapshots.some((s) => s.isOverdue);
    if (isOverdue) overdueZones.push(zone);

    const trend = combineZoneTrend(trends);
    const hazardLoad = computeZoneHazardLoad(
      zone,
      input.environment,
      radiation,
    );
    const riskScore = computeZoneRiskScore(
      status,
      trend,
      isOverdue,
      hazardLoad.total,
    );

    zones[zone] = {
      zone,
      status,
      riskScore,
      riskLevel: RISK_LEVEL_BY_SCORE[riskScore],
      trend,
      isOverdue,
      indicators: snapshots,
      hazardLoad,
    };
  }

  const overallStatus = worstStatus(BODY_ZONES.map((z) => zones[z].status));
  const maxRiskScore = Math.max(
    ...BODY_ZONES.map((z) => zones[z].riskScore),
  ) as 0 | 1 | 2 | 3;

  return {
    evaluatedAt: new Date(nowMs).toISOString(),
    environment: input.environment,
    radiation,
    overallStatus,
    overallRiskLevel: RISK_LEVEL_BY_SCORE[maxRiskScore],
    overdueZones,
    zones,
  };
}

/**
 * "What-If" projection mode: simulates the Digital Twin state under hypothetical habitat,
 * radiation/shielding, or vital-sign overrides without mutating persisted telemetry.
 */
export function simulateWhatIf(
  baseInput: DigitalTwinInput,
  overrides: WhatIfOverrides,
): DigitalTwinSimulationResult {
  const baseline = evaluateDigitalTwin(baseInput);
  const nowMs = toTimestampMs(baseInput.now);

  let projectedReadings = [...baseInput.readings];

  if (
    overrides.readingOverrides &&
    Object.keys(overrides.readingOverrides).length > 0
  ) {
    const sortedAsc = [...baseInput.readings].sort(
      (a, b) => toTimestampMs(a.takenAt) - toTimestampMs(b.takenAt),
    );
    const latest = sortedAsc[sortedAsc.length - 1] ?? {
      heartRateBpm: 72,
      systolicMmHg: 118,
      diastolicMmHg: 76,
      glucoseMgDl: 95,
      temperatureC: 36.6,
      spo2Pct: 98,
      sleepHours: 7.5,
      mood: 4,
      resistanceExerciseMin: 60,
      takenAt: new Date(nowMs).toISOString(),
    };

    const syntheticLatest: TimedHealthReading = {
      ...latest,
      ...overrides.readingOverrides,
      takenAt: new Date(nowMs).toISOString(),
    };

    projectedReadings = [...sortedAsc.slice(0, -1), syntheticLatest];
  }

  const projected = evaluateDigitalTwin({
    ...baseInput,
    readings: projectedReadings,
    environment: overrides.environment ?? baseInput.environment,
    radiation: {
      stormScale:
        overrides.radiation?.stormScale ??
        baseInput.radiation?.stormScale ??
        "S0_NOMINAL",
      shielding:
        overrides.radiation?.shielding ??
        baseInput.radiation?.shielding ??
        "CREW_CABIN_NOMINAL",
      fluxPfu: overrides.radiation?.fluxPfu ?? baseInput.radiation?.fluxPfu,
    },
  });

  const changedZones = BODY_ZONES.filter(
    (z) =>
      baseline.zones[z].status !== projected.zones[z].status ||
      baseline.zones[z].riskScore !== projected.zones[z].riskScore ||
      baseline.zones[z].hazardLoad.total !==
        projected.zones[z].hazardLoad.total,
  );

  return {
    baseline,
    projected,
    changedZones,
  };
}
