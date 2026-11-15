import { BODY_ZONES, type BodyZoneId } from "./hazards.js";
import type { DigitalTwinState, ZoneRiskLevel } from "./digitalTwin.js";

export type RecommendedAction =
  | "re_measure"
  | "rest"
  | "exercise"
  | "shelter_shielding"
  | "contact_ground"
  | "no_action";

export interface ZoneScoreEstimate {
  zone: BodyZoneId;
  riskScore: number;
  riskLevel: ZoneRiskLevel;
  confidence: number;
}

export interface DecisionOutcome {
  /** Nivel de riesgo por zona (0..3 y etiqueta). */
  score: Record<BodyZoneId, ZoneScoreEstimate>;
  /** ¿Conviene escalar al médico de vuelo ahora? */
  escalar: boolean;
  /** Probabilidad P(escalar = true) en [0..1]. */
  escalarProbabilidad: number;
  /** Acción recomendada principal de conjunto cerrado. */
  accion: RecommendedAction;
  /** Confianza agregada [0..1]. */
  confianza: number;
}

export const ACTION_DESCRIPTIONS: Record<RecommendedAction, string> = {
  re_measure:
    "Medición vencida o lectura ámbar aislada que requiere repetir medición en 5-30 min para confirmar.",
  rest: "Privación de sueño, fatiga o ánimo bajo sin riesgo físico agudo; priorizar descanso e higiene circadiana.",
  exercise:
    "Riesgo óseo/muscular o desacondicionamiento en microgravedad con signos vitales estables; ejecutar protocolo ARED/T2.",
  shelter_shielding:
    "Tormenta solar o peligro de radiación elevado sin refugio; trasladarse a Storm Shelter o incrementar blindaje.",
  contact_ground:
    "Estado crítico (rojo) o deterioro multizona que exige escalar de inmediato al Flight Surgeon en Tierra.",
  no_action:
    "Todos los parámetros nominales, mediciones al día y sin peligros agudos activos.",
};

export function riskScoreToLevel(score: number): ZoneRiskLevel {
  if (score >= 2.3) return "critical";
  if (score >= 1.5) return "elevated";
  if (score >= 0.75) return "watch";
  return "stable";
}

/**
 * Motor de decisión puramente determinista (fuente de verdad oficial).
 */
export function decideByRules(state: DigitalTwinState): DecisionOutcome {
  const score = {} as Record<BodyZoneId, ZoneScoreEstimate>;

  let redCount = 0;
  let amberWorseningCount = 0;
  let anyAmber = false;

  for (const zone of BODY_ZONES) {
    const z = state.zones[zone];
    score[zone] = {
      zone,
      riskScore: z.riskScore,
      riskLevel: z.riskLevel,
      confidence: 1,
    };

    if (z.status === "red" || z.riskLevel === "critical") redCount += 1;
    if (z.status === "amber") {
      anyAmber = true;
      if (z.trend === "worsening") amberWorseningCount += 1;
    }
  }

  const acuteRadiationExposed =
    (state.radiation.stormScale === "S4_SEVERE" ||
      state.radiation.stormScale === "S5_EXTREME") &&
    state.radiation.shielding !== "STORM_SHELTER";

  const moderateRadiationExposed =
    (state.radiation.stormScale === "S3_STRONG" ||
      (state.radiation.stormScale === "S2_MODERATE" &&
        state.radiation.shielding === "EVA_SUIT")) &&
    state.radiation.shielding !== "STORM_SHELTER";

  const spo2Value =
    state.zones.blood.indicators.find((i) => i.id === "spo2")?.value ?? null;
  const acuteHypoxiaRisk =
    spo2Value !== null &&
    spo2Value < 95 &&
    state.zones.blood.hazardLoad.breakdown.hostileEnvironment >= 0.75;

  const escalar =
    redCount > 0 ||
    amberWorseningCount >= 2 ||
    acuteRadiationExposed ||
    acuteHypoxiaRisk;

  let accion: RecommendedAction = "no_action";
  if (escalar && acuteRadiationExposed) {
    accion = "shelter_shielding";
  } else if (escalar) {
    accion = "contact_ground";
  } else if (moderateRadiationExposed) {
    accion = "shelter_shielding";
  } else if (anyAmber || state.overdueZones.length > 0) {
    // Si solo sueño/ánimo está en ámbar sin vencidos ni vitales alterados, priorizar descanso
    const vitalOrBloodAmber =
      state.zones.heart.status === "amber" ||
      state.zones.blood.status === "amber";
    if (!vitalOrBloodAmber && state.overdueZones.length === 0) {
      if (
        state.zones.sleep.status === "amber" ||
        state.zones.brain.status === "amber"
      ) {
        accion = "rest";
      } else if (state.zones.bones.status === "amber") {
        accion = "exercise";
      } else {
        accion = "re_measure";
      }
    } else {
      accion = "re_measure";
    }
  }

  return {
    score,
    escalar,
    escalarProbabilidad: escalar ? 0.99 : 0.01,
    accion,
    confianza: 1,
  };
}

