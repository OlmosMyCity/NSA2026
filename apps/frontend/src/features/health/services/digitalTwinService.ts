import { ENV } from '@/features/common/config/env';
import { httpClient } from '@/features/common/services/httpClient';
import { summarizeZones } from '../domain/summary';
import { toIndicatorReadings, type ApiHealthReading } from '../domain/api-adapter';
import type { BodyZoneId, SpaceHazard } from '../domain/types';

export type MissionEnvironment =
  | 'SPACECRAFT'
  | 'STATION'
  | 'ROVER'
  | 'LUNAR_BASE'
  | 'MARS_BASE';

export type ShieldingType = 'EVA_SUIT' | 'CREW_CABIN_NOMINAL' | 'STORM_SHELTER';

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

export interface ZoneTwinState {
  zone: BodyZoneId;
  status: 'green' | 'amber' | 'red' | 'unknown';
  riskLevel: ZoneRiskLevel;
  riskScore: 0 | 1 | 2 | 3;
  trend: TrendDirection;
  isOverdue: boolean;
  hazardLoad: {
    total: number;
    topHazard: SpaceHazard;
    breakdown: Record<SpaceHazard, number>;
  };
}

export interface DigitalTwinState {
  evaluatedAt: string;
  environment: MissionEnvironment;
  radiation: { stormScale: NOAAStormScale; shielding: ShieldingType };
  overallStatus: 'green' | 'amber' | 'red' | 'unknown';
  overallRiskLevel: ZoneRiskLevel;
  overdueZones: BodyZoneId[];
  zones: Record<BodyZoneId, ZoneTwinState>;
}

export interface ZoneScoreEstimate {
  zone: BodyZoneId;
  riskScore: number;
  riskLevel: ZoneRiskLevel;
  confidence: number;
}

export interface DecisionOutcome {
  score: Record<BodyZoneId, ZoneScoreEstimate>;
  escalar: boolean;
  escalarProbabilidad: number;
  accion: RecommendedAction;
  confianza: number;
}

export interface DecisionResult {
  score: Record<BodyZoneId, ZoneScoreEstimate>;
  escalar: boolean;
  accion: RecommendedAction;
  confianza: number;
  official: DecisionOutcome;
  modelEstimate: DecisionOutcome;
  discrepancy: {
    hasDiscrepancy: boolean;
    reasons: string[];
    zoneDiscrepancies: BodyZoneId[];
    escalarDiscrepancy: boolean;
    accionDiscrepancy: boolean;
  };
  source: 'gemini-decision-1' | 'cache' | 'rules-fallback';
  disclaimer: 'estimación del modelo, no diagnóstico';
  freeTextMoodEstimate?: {
    moodScore: number;
    rawScore: number;
    confidence: number;
  };
}

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

/** Fallback local determinista para modo mock o sin backend disponible. */
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

  const official: DecisionOutcome = {
    score,
    escalar,
    escalarProbabilidad: escalar ? 0.99 : 0.01,
    accion,
    confianza: 1,
  };

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
      official,
      modelEstimate: official,
      discrepancy: {
        hasDiscrepancy: false,
        reasons: [],
        zoneDiscrepancies: [],
        escalarDiscrepancy: false,
        accionDiscrepancy: false,
      },
      source: 'rules-fallback',
      disclaimer: 'estimación del modelo, no diagnóstico',
    },
  };
}

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

