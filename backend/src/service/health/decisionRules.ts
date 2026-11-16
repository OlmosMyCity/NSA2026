/**
 * @module service/health/decisionRules
 * Deterministic clinical decision rules engine for the Astronaut Digital Twin.
 *
 * Architectural invariant: Deterministic rules in `decideByRules` hold official clinical
 * and operational authority. Any Gemini Decision 1 output is strictly advisory (second-opinion
 * estimate + confidence + discrepancy audit) and never overrides deterministic escalation or action.
 */

import { BODY_ZONES, type BodyZoneId } from "./hazards.js";
import type { DigitalTwinState, ZoneRiskLevel } from "./digitalTwin.js";
import { classifyIndicator } from "./evaluateReading.js";

/** Closed action set shared between deterministic triage rules and Gemini Decision 1. */
export type RecommendedAction =
  | "re_measure"
  | "rest"
  | "exercise"
  | "shelter_shielding"
  | "contact_ground"
  | "no_action";

/** Per-zone risk assessment returned by either deterministic rules or the Gemini model. */
export interface ZoneScoreEstimate {
  zone: BodyZoneId;
  riskScore: number;
  riskLevel: ZoneRiskLevel;
  confidence: number;
}

/** Structured clinical decision outcome across body zones, ground escalation, and action choice. */
export interface DecisionOutcome {
  /** Per-zone risk score (`0..3`), categorical risk level, and confidence. */
  score: Record<BodyZoneId, ZoneScoreEstimate>;
  /** Whether to escalate immediately to the Flight Surgeon on Earth. */
  escalar: boolean;
  /** Escalation probability `P(escalar = true)` in `[0..1]`. */
  escalarProbabilidad: number;
  /** Primary recommended action selected from the closed `RecommendedAction` set. */
  accion: RecommendedAction;
  /** Aggregate decision confidence in `[0..1]`. */
  confianza: number;
}

export const ACTION_DESCRIPTIONS: Record<RecommendedAction, string> = {
  re_measure:
    "Overdue measurement or isolated amber reading requiring a repeat measurement in 5–30 min to confirm.",
  rest: "Sleep deprivation, fatigue, or low mood without acute physical risk; prioritize rest and circadian hygiene.",
  exercise:
    "Bone/muscle deconditioning risk in microgravity with stable vitals; execute ARED/T2 countermeasure protocol.",
  shelter_shielding:
    "Solar storm or elevated radiation hazard without shelter; relocate to Storm Shelter or increase shielding.",
  contact_ground:
    "Critical (red) status or multi-zone deterioration requiring immediate escalation to the Flight Surgeon on Earth.",
  no_action:
    "All parameters nominal, measurements up to date, and no active acute hazards.",
};

/** Maps a numeric risk score (`0..3`) onto discrete `ZoneRiskLevel` categories. */
export function riskScoreToLevel(score: number): ZoneRiskLevel {
  if (score >= 2.3) return "critical";
  if (score >= 1.5) return "elevated";
  if (score >= 0.75) return "watch";
  return "stable";
}

/**
 * Pure deterministic clinical decision engine (official source of truth).
 *
 * Escalation triggers (`escalar = true`) when any of the following hold:
 * - Any zone has `red` status or `critical` risk level
 * - Two or more zones are `amber` with a `worsening` trend
 * - Acute radiation exposure (`S4_SEVERE` or `S5_EXTREME` outside `STORM_SHELTER`)
 * - Acute hypoxia risk (`SpO2 < 95%` under `hostileEnvironment >= 0.75`)
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
    classifyIndicator("spo2", spo2Value) !== "OK" &&
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
    // If only sleep or mood is amber with no overdue measurements or altered vitals, prioritize rest
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

