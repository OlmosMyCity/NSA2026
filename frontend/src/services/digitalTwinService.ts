/**
 * @module services/digitalTwinService
 * Client contract and evaluator for the 5-zone Physiological Digital Twin
 * (`heart`, `brain`, `blood`, `bones`, `sleep`).
 *
 * Architecture:
 * - **Dual-layer decision model**: Deterministic threshold rules remain the
 *   authoritative verdict (`official`), while Gemini Decision 1 (`gemini-decision-1`)
 *   provides an optional/cached AI second opinion (`modelEstimate`) with explicit
 *   discrepancy reporting and a non-diagnostic disclaimer.
 * - **Zero-token What-If separation**: Interactive slider/environment edits in the
 *   UI evaluate locally with zero AI tokens; this service is called only on initial
 *   load or when the user explicitly clicks "Run triage".
 * - **Offline / mock resilience**: Falls back to `localFallbackEvaluate` when
 *   `ENV.USE_MOCKS` is active or the backend `/astronauts/digital-twin/evaluate`
 *   endpoint is unavailable.
 */

import { ENV } from '@/config/env';
import { httpClient } from '@/services/httpClient';
import { summarizeZones } from '../domain/health/summary';
import { toIndicatorReadings, type ApiHealthReading } from '../domain/health/api-adapter';
import type { BodyZoneId, SpaceHazard } from '../domain/health/types';

/** Operational habitat/vehicle context influencing NASA HRP hazard weights. */
export type MissionEnvironment =
  | 'SPACECRAFT'
  | 'STATION'
  | 'ROVER'
  | 'LUNAR_BASE'
  | 'MARS_BASE';

/** Structural radiation shielding configuration (`g/cm²` aluminum-equivalent tiers). */
export type ShieldingType = 'EVA_SUIT' | 'CREW_CABIN_NOMINAL' | 'STORM_SHELTER';

/** NOAA Solar Radiation Storm scale (S0 quiet sun through S5 extreme proton event). */
export type NOAAStormScale =
  | 'S0_NOMINAL'
  | 'S1_MINOR'
  | 'S2_MODERATE'
  | 'S3_STRONG'
  | 'S4_SEVERE'
  | 'S5_EXTREME';

export type TrendDirection = 'improving' | 'stable' | 'worsening';
export type ZoneRiskLevel = 'stable' | 'watch' | 'elevated' | 'critical';
export type RecommendedAction =
  | 're_measure'
  | 'rest'
  | 'exercise'
  | 'shelter_shielding'
  | 'contact_ground'
  | 'no_action';

/** Evaluated physiological state and NASA HRP 5-hazard load overlay for a single twin zone. */
export interface ZoneTwinState {
  zone: BodyZoneId;
  status: 'green' | 'amber' | 'red' | 'unknown';
  riskLevel: ZoneRiskLevel;
  riskScore: 0 | 1 | 2 | 3;
  trend: TrendDirection;
  isOverdue: boolean;
  /** Normalized `[0, 1]` hazard exposure breakdown across the 5 NASA HRP stressors. */
  hazardLoad: {
    total: number;
    topHazard: SpaceHazard;
    breakdown: Record<SpaceHazard, number>;
  };
}

/** Complete 5-zone Digital Twin snapshot for a given mission and radiation context. */
export interface DigitalTwinState {
  evaluatedAt: string;
  environment: MissionEnvironment;
  radiation: { stormScale: NOAAStormScale; shielding: ShieldingType };
  overallStatus: 'green' | 'amber' | 'red' | 'unknown';
  overallRiskLevel: ZoneRiskLevel;
  overdueZones: BodyZoneId[];
  zones: Record<BodyZoneId, ZoneTwinState>;
}

/** Per-zone risk assessment emitted by either deterministic rules or the AI model. */
export interface ZoneScoreEstimate {
  zone: BodyZoneId;
  riskScore: number;
  riskLevel: ZoneRiskLevel;
  confidence: number;
}

export interface DecisionResult {
  score: Record<BodyZoneId, ZoneScoreEstimate>;
  escalar: boolean;
  accion: RecommendedAction;
  confianza: number;
  freeTextMoodEstimate?: {
    moodScore: number;
    rawScore: number;
    confidence: number;
  };
}

/** Stateless evaluation payload sent to `/astronauts/digital-twin/evaluate` for real or What-If telemetry. */
export interface EvaluateTwinPayload {
  readings: ApiHealthReading[];
  environment: MissionEnvironment;
  radiation: { stormScale: NOAAStormScale; shielding: ShieldingType };
  freeTextMood?: string;
}

const RISK_BY_STATUS: Record<'green' | 'amber' | 'red' | 'unknown', { score: 0 | 1 | 2 | 3; level: ZoneRiskLevel }> = {
  green: { score: 0, level: 'stable' },
  unknown: { score: 1, level: 'watch' },
  amber: { score: 2, level: 'elevated' },
  red: { score: 3, level: 'critical' },
};

/**
 * Deterministic local fallback used in mock mode or when the backend endpoint
 * is unreachable. Evaluates all 5 zones via `summarizeZones`, overlays S4/S5
 * unshielded storm risk onto the blood/radiation model, and yields matching
 * `official` and `modelEstimate` verdicts under `rules-fallback`.
 */
function localFallbackEvaluate(payload: EvaluateTwinPayload): {
  twin: DigitalTwinState;
  decision: DecisionResult;
} {
  const flat = payload.readings.flatMap(toIndicatorReadings);
  const zonesSummary = summarizeZones(flat);
  const zones = {} as Record<BodyZoneId, ZoneTwinState>;
  const score = {} as Record<BodyZoneId, ZoneScoreEstimate>;

  let anyRed = false;
  let anyAmber = false;
  const stormHigh =
    (payload.radiation.stormScale === 'S4_SEVERE' || payload.radiation.stormScale === 'S5_EXTREME') &&
    payload.radiation.shielding !== 'STORM_SHELTER';

  for (const zone of ['heart', 'brain', 'blood', 'bones', 'sleep'] as BodyZoneId[]) {
    const st = zonesSummary[zone].status;
    if (st === 'red') anyRed = true;
    if (st === 'amber') anyAmber = true;
    const mapped = RISK_BY_STATUS[st];
    zones[zone] = {
      zone,
      status: st,
      riskScore: mapped.score,
      riskLevel: mapped.level,
      trend: 'stable',
      isOverdue: st === 'unknown',
      hazardLoad: {
        total: stormHigh && zone === 'blood' ? 0.92 : 0.45,
        topHazard: stormHigh ? 'radiation' : 'gravity',
        breakdown: {
          radiation: stormHigh ? 0.92 : 0.35,
          isolation: 0.45,
          distance: 0.4,
          gravity: 0.55,
          hostileEnvironment: 0.5,
        },
      },
    };
    score[zone] = {
      zone,
      riskScore: mapped.score,
      riskLevel: mapped.level,
      confidence: 1,
    };
  }

  const escalar = anyRed || stormHigh;
  const accion: RecommendedAction = stormHigh
    ? 'shelter_shielding'
    : escalar
      ? 'contact_ground'
      : anyAmber
        ? 're_measure'
        : 'no_action';

  return {
    twin: {
      evaluatedAt: new Date().toISOString(),
      environment: payload.environment,
      radiation: payload.radiation,
      overallStatus: anyRed ? 'red' : anyAmber ? 'amber' : 'green',
      overallRiskLevel: anyRed ? 'critical' : anyAmber ? 'elevated' : 'stable',
      overdueZones: [],
      zones,
    },
    decision: {
      score,
      escalar,
      accion,
      confianza: 1,
    },
  };
}

/**
 * Evaluates a Digital Twin telemetry and environment snapshot via the backend
 * Gemini Decision 1 + deterministic rules endpoint, falling back locally on
 * mock mode or network failure.
 */
export async function evaluateDigitalTwinRemote(
  payload: EvaluateTwinPayload
): Promise<{ twin: DigitalTwinState; decision: DecisionResult }> {
  if (ENV.USE_MOCKS) {
    return localFallbackEvaluate(payload);
  }

  try {
    return await httpClient.post<{ twin: DigitalTwinState; decision: DecisionResult }>(
      '/astronauts/digital-twin/evaluate',
      {
        readings: payload.readings.map((r) => ({
          heartRateBpm: r.heartRateBpm,
          systolicMmHg: r.systolicMmHg,
          diastolicMmHg: r.diastolicMmHg,
          glucoseMgDl: r.glucoseMgDl,
          temperatureC: r.temperatureC,
          spo2Pct: r.spo2Pct,
          sleepHours: r.sleepHours,
          mood: r.mood,
          takenAt: r.takenAt,
        })),
        environment: payload.environment,
        radiation: payload.radiation,
        freeTextMood: payload.freeTextMood?.trim() || undefined,
      }
    );
  } catch {
    return localFallbackEvaluate(payload);
  }
}

