/**
 * @module service/health/evaluateReading
 * Pure deterministic clinical triage engine enforcing NASA Human Research Program (HRP)
 * biomedical thresholds for Artemis crew health readings.
 *
 * Architectural role: Acts as the authoritative deterministic rule engine for reading
 * classification (`OK`, `WARNING`, `CRITICAL`), triggered alerts, and protocol selection.
 * Alert messages are preserved in Spanish for clinical UI and test assertions.
 */

import { getMedicalProtocol } from "./medicalProtocols.js";
import type { HealthAlert, HealthAlertLevel } from "../../entity/HealthReading.js";

export type { HealthAlert, HealthAlertLevel };

/** Raw vital-sign and behavioral metrics for a single biomedical reading. */
export interface HealthReadingInput {
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  glucoseMgDl: number;
  temperatureC: number;
  spo2Pct: number;
  sleepHours: number;
  mood: number; // 1 to 5 scale
}

/** Aggregate health classification derived from all evaluated vital indicators. */
export type OverallHealthStatus = "OK" | "WARNING" | "CRITICAL";

/** Output of `evaluateReading` pairing overall status, primary protocol ID, alerts, and guidance. */
export interface HealthEvaluationResult {
  status: OverallHealthStatus;
  protocolId: string;
  alerts: HealthAlert[];
  recommendation: string;
}

/**
 * Tramo de un indicador. Los tramos se recorren en orden ascendente y gana el primero
 * cuyo límite superior contiene el valor (`lt` excluye el límite, `lte` lo incluye).
 * El último tramo no tiene límite, así que la tabla no puede dejar huecos.
 *
 * Esta tabla es la fuente de verdad clínica: la usan evaluateReading, el resumen del
 * repositorio, el gemelo digital y las reglas de decisión. El frontend mantiene una copia
 * en frontend/src/domain/health/indicators.ts y el test
 * tests/unit/healthRulesParity.test.ts verifica que ambas coincidan.
 */
export interface StatusBand {
  level: OverallHealthStatus;
  lt?: number;
  lte?: number;
}

export type RuleIndicator =
  | "heartRate"
  | "systolic"
  | "diastolic"
  | "glucose"
  | "temperature"
  | "spo2"
  | "sleepHours"
  | "mood";

export const HEALTH_BANDS: Record<RuleIndicator, StatusBand[]> = {
  heartRate: [
    { level: "CRITICAL", lt: 40 },
    { level: "WARNING", lt: 50 },
    { level: "OK", lte: 90 },
    { level: "WARNING", lte: 100 },
    { level: "CRITICAL" },
  ],
  systolic: [
    { level: "CRITICAL", lt: 90 },
    { level: "OK", lt: 130 },
    { level: "WARNING", lt: 140 },
    { level: "CRITICAL" },
  ],
  diastolic: [{ level: "OK", lt: 85 }, { level: "WARNING", lt: 90 }, { level: "CRITICAL" }],
  glucose: [
    { level: "CRITICAL", lt: 70 },
    { level: "OK", lte: 140 },
    { level: "WARNING", lte: 180 },
    { level: "CRITICAL" },
  ],
  temperature: [
    { level: "CRITICAL", lt: 35.5 },
    { level: "WARNING", lt: 36.1 }, // hipotermia leve
    { level: "OK", lte: 37.5 },
    { level: "WARNING", lte: 38.0 }, // febrícula
    { level: "CRITICAL" },
  ],
  spo2: [{ level: "CRITICAL", lt: 92 }, { level: "WARNING", lt: 95 }, { level: "OK" }],
  sleepHours: [{ level: "CRITICAL", lt: 6 }, { level: "WARNING", lt: 7 }, { level: "OK" }],
  mood: [{ level: "CRITICAL", lte: 2 }, { level: "WARNING", lt: 4 }, { level: "OK" }],
};

const SEVERITY: Record<OverallHealthStatus, number> = { OK: 0, WARNING: 1, CRITICAL: 2 };

const inBand = (b: StatusBand, value: number) =>
  (b.lt !== undefined && value < b.lt) ||
  (b.lte !== undefined && value <= b.lte) ||
  (b.lt === undefined && b.lte === undefined);

export function classifyIndicator(indicator: RuleIndicator, value: number): OverallHealthStatus {
  return HEALTH_BANDS[indicator].find((b) => inBand(b, value))?.level ?? "CRITICAL";
}

export function worstLevel(...levels: OverallHealthStatus[]): OverallHealthStatus {
  return levels.reduce((worst, l) => (SEVERITY[l] > SEVERITY[worst] ? l : worst), "OK" as OverallHealthStatus);
}

/** Lado del rango nominal donde cae un valor fuera de él: debajo ("low") o encima ("high"). */
function sideOf(indicator: RuleIndicator, value: number): "low" | "high" {
  const bands = HEALTH_BANDS[indicator];
  const okIndex = bands.findIndex((b) => b.level === "OK");
  const matched = bands.findIndex((b) => inBand(b, value));
  return matched < okIndex ? "low" : "high";
}

interface AlertOutcome {
  protocolId: string;
  message: string;
}

/**
 * Alertas que se persisten en `HealthReading.alerts`. El nivel siempre sale de HEALTH_BANDS;
 * aquí solo se elige el protocolo médico y el mensaje según el nivel y el lado del rango.
 */
const ALERT_RULES: Array<{
  indicator: string;
  level: (r: HealthReadingInput) => OverallHealthStatus;
  value: (r: HealthReadingInput) => number;
  outcome: (r: HealthReadingInput, level: HealthAlertLevel) => AlertOutcome;
}> = [
  {
    indicator: "heartRate",
    level: (r) => classifyIndicator("heartRate", r.heartRateBpm),
    value: (r) => r.heartRateBpm,
    outcome: (r, level) => {
      if (level === "WARNING") {
        return {
          protocolId: "PROTO_HEART_RATE_MONITOR",
          message: `Heart rate outside nominal range (${r.heartRateBpm} bpm). Monitor physical activity.`,
        };
      }
      return sideOf("heartRate", r.heartRateBpm) === "high"
        ? {
            protocolId: "PROTO_TACHYCARDIA",
            message: `Critical heart rate (${r.heartRateBpm} bpm). Risk of arrhythmia or cardiovascular event in altered gravity.`,
          }
        : {
            protocolId: "PROTO_BRADYCARDIA",
            message: `Extreme bradycardia (${r.heartRateBpm} bpm). Risk of hypoperfusion in altered gravity.`,
          };
    },
  },
  {
    indicator: "bloodPressure",
    level: (r) => worstLevel(classifyIndicator("systolic", r.systolicMmHg), classifyIndicator("diastolic", r.diastolicMmHg)),
    value: (r) => r.systolicMmHg,
    outcome: (r, level) => {
      const bp = `${r.systolicMmHg}/${r.diastolicMmHg} mmHg`;
      if (level === "WARNING") {
        return {
          protocolId: "PROTO_BLOOD_PRESSURE_BORDERLINE",
          message: `Borderline blood pressure (${bp}). Hydration and rest recommended.`,
        };
      }
      const hypertensive =
        classifyIndicator("diastolic", r.diastolicMmHg) === "CRITICAL" ||
        (classifyIndicator("systolic", r.systolicMmHg) === "CRITICAL" && sideOf("systolic", r.systolicMmHg) === "high");
      return hypertensive
        ? {
            protocolId: "PROTO_HYPERTENSIVE_CRISIS",
            message: `Hypertensive crisis (${bp}). Possible severe fluid redistribution.`,
          }
        : {
            protocolId: "PROTO_HYPOTENSION",
            message: `Critical hypotension (${bp}). Risk of orthostatic syncope.`,
          };
    },
  },
  {
    indicator: "glucose",
    level: (r) => classifyIndicator("glucose", r.glucoseMgDl),
    value: (r) => r.glucoseMgDl,
    outcome: (r, level) => {
      if (level === "WARNING") {
        return {
          protocolId: "PROTO_GLUCOSE_ELEVATED",
          message: `Elevated blood glucose (${r.glucoseMgDl} mg/dL). Review space ration nutritional intake.`,
        };
      }
      return sideOf("glucose", r.glucoseMgDl) === "low"
        ? {
            protocolId: "PROTO_HYPOGLYCEMIA",
            message: `Critical hypoglycemia (${r.glucoseMgDl} mg/dL). Risk of neurological deficit and severe metabolic imbalance.`,
          }
        : {
            protocolId: "PROTO_HYPERGLYCEMIA",
            message: `Critical hyperglycemia (${r.glucoseMgDl} mg/dL). Risk of severe metabolic imbalance.`,
          };
    },
  },
  {
    indicator: "temperature",
    level: (r) => classifyIndicator("temperature", r.temperatureC),
    value: (r) => r.temperatureC,
    outcome: (r, level) => {
      const low = sideOf("temperature", r.temperatureC) === "low";
      if (level === "WARNING") {
        return low
          ? {
              protocolId: "PROTO_MILD_HYPOTHERMIA",
              message: `Mild hypothermia (${r.temperatureC} °C). Check suit/cabin thermal regulation and repeat measurement.`,
            }
          : {
              protocolId: "PROTO_SUBFEBRILE",
              message: `Subfebrile temperature detected (${r.temperatureC} °C). Monitor immune symptoms and radiation exposure.`,
            };
      }
      return low
        ? {
            protocolId: "PROTO_HYPOTHERMIA",
            message: `Critical hypothermia (${r.temperatureC} °C). Verify thermal control in suit/cabin.`,
          }
        : {
            protocolId: "PROTO_FEVER",
            message: `High fever (${r.temperatureC} °C). Risk of acute infection or inflammatory response in cabin.`,
          };
    },
  },
  {
    indicator: "spo2",
    level: (r) => classifyIndicator("spo2", r.spo2Pct),
    value: (r) => r.spo2Pct,
    outcome: (r, level) =>
      level === "CRITICAL"
        ? {
            protocolId: "PROTO_HYPOXIA",
            message: `Critical O2 saturation (${r.spo2Pct}%). Hypoxia detected; verify cabin O2 partial pressure.`,
          }
        : {
            protocolId: "PROTO_SPO2_BORDERLINE",
            message: `Borderline SpO2 (${r.spo2Pct}%). Check module ventilation and CO2 scrubbers.`,
          },
  },
  {
    indicator: "sleep",
    level: (r) => classifyIndicator("sleepHours", r.sleepHours),
    value: (r) => r.sleepHours,
    outcome: (r, level) =>
      level === "CRITICAL"
        ? {
            protocolId: "PROTO_SLEEP_DEPRIVATION",
            message: `Severe sleep deprivation (${r.sleepHours} h). Risk of operational fatigue and impaired focus during maneuvers.`,
          }
        : {
            protocolId: "PROTO_SLEEP_INSUFFICIENT",
            message: `Insufficient sleep (${r.sleepHours} h). Adjust circadian cycle and lighting protocols.`,
          },
  },
  {
    indicator: "mood",
    level: (r) => classifyIndicator("mood", r.mood),
    value: (r) => r.mood,
    outcome: (r, level) =>
      level === "CRITICAL"
        ? {
            protocolId: "PROTO_PSYCHOSOCIAL_DISTRESS",
            message: `Low mood (${r.mood}/5). Psychosocial risk due to prolonged isolation and confinement.`,
          }
        : {
            protocolId: "PROTO_MOOD_SUPPORT",
            message: `Neutral/low mood (${r.mood}/5). Encourage family communication and mission support.`,
          },
  },
];

/**
 * Evaluates 7 astronaut physiological and behavioral indicators against the shared
 * `HEALTH_BANDS` table (NASA HRP thresholds for Artemis missions):
 * - Heart rate (bpm): critical `< 40` or `> 100`; warning `40–49` or `91–100`
 * - Blood pressure (mmHg): critical sys `< 90` or `>= 140`, or dia `>= 90`; warning sys `130–139` or dia `85–89`
 * - Blood glucose (mg/dL): critical `< 70` or `> 180`; warning `141–180`
 * - Body temperature (°C): critical `< 35.5` or `> 38.0`; warning `35.5–36.0` or `37.6–38.0`
 * - SpO2 (%): critical `< 92`; warning `92–94`
 * - Sleep (hours): critical `< 6.0`; warning `6.0–6.99`
 * - Mood (1–5): critical `<= 2`; warning `< 4`
 *
 * Pure domain function with zero side effects or external dependencies; `CRITICAL` alerts
 * take precedence over `WARNING` alerts when selecting the primary `protocolId`.
 */
export function evaluateReading(reading: HealthReadingInput): HealthEvaluationResult {
  const alerts: HealthAlert[] = [];
  for (const rule of ALERT_RULES) {
    const level = rule.level(reading);
    if (level === "OK") continue;
    alerts.push({ indicator: rule.indicator, level, ...rule.outcome(reading, level), value: rule.value(reading) });
  }

  // Clasificación global y protocolo principal: la primera alerta crítica, o la primera de aviso.
  const status = worstLevel(...alerts.map((a) => a.level));
  const main = alerts.find((a) => a.level === "CRITICAL") ?? alerts.find((a) => a.level === "WARNING");
  const protocolId = main?.protocolId ?? "PROTO_NOMINAL";
  const recommendation =
    getMedicalProtocol(protocolId)?.summary ??
    "Parameters within nominal mission ranges. Continue scheduled routine.";

  return { status, protocolId, alerts, recommendation };
}
