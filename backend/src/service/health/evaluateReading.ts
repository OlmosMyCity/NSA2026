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
          message: `Frecuencia cardiaca fuera de rango nominal (${r.heartRateBpm} lpm). Monitorear actividad física.`,
        };
      }
      return sideOf("heartRate", r.heartRateBpm) === "high"
        ? {
            protocolId: "PROTO_TACHYCARDIA",
            message: `Frecuencia cardiaca crítica (${r.heartRateBpm} lpm). Riesgo de arritmia o evento cardiovascular en gravedad alterada.`,
          }
        : {
            protocolId: "PROTO_BRADYCARDIA",
            message: `Bradicardia extrema (${r.heartRateBpm} lpm). Riesgo de hipoperfusión en gravedad alterada.`,
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
          message: `Presión arterial limítrofe (${bp}). Hidratación y reposo recomendados.`,
        };
      }
      const hypertensive =
        classifyIndicator("diastolic", r.diastolicMmHg) === "CRITICAL" ||
        (classifyIndicator("systolic", r.systolicMmHg) === "CRITICAL" && sideOf("systolic", r.systolicMmHg) === "high");
      return hypertensive
        ? {
            protocolId: "PROTO_HYPERTENSIVE_CRISIS",
            message: `Crisis hipertensiva (${bp}). Posible redistribución severa de fluidos.`,
          }
        : {
            protocolId: "PROTO_HYPOTENSION",
            message: `Hipotensión arterial crítica (${bp}). Riesgo de síncope ortostático.`,
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
          message: `Glucosa elevada (${r.glucoseMgDl} mg/dL). Revisar ingesta nutricional de la ración espacial.`,
        };
      }
      return sideOf("glucose", r.glucoseMgDl) === "low"
        ? {
            protocolId: "PROTO_HYPOGLYCEMIA",
            message: `Hipoglucemia crítica (${r.glucoseMgDl} mg/dL). Riesgo de déficit neurológico y desbalance metabólico severo.`,
          }
        : {
            protocolId: "PROTO_HYPERGLYCEMIA",
            message: `Hiperglucemia crítica (${r.glucoseMgDl} mg/dL). Riesgo de desbalance metabólico severo.`,
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
              message: `Hipotermia leve (${r.temperatureC} °C). Revisar termorregulación del traje/cabina y repetir la medición.`,
            }
          : {
              protocolId: "PROTO_SUBFEBRILE",
              message: `Febrícula detectada (${r.temperatureC} °C). Vigilar síntomas inmunológicos y radiación.`,
            };
      }
      return low
        ? {
            protocolId: "PROTO_HYPOTHERMIA",
            message: `Hipotermia crítica (${r.temperatureC} °C). Verificar control térmico en traje/cabina.`,
          }
        : {
            protocolId: "PROTO_FEVER",
            message: `Fiebre alta (${r.temperatureC} °C). Riesgo de infección aguda o respuesta inflamatoria en cabina.`,
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
            message: `Saturación de O2 crítica (${r.spo2Pct}%). Hipoxia detectada; verificar presión parcial de O2 en cabina.`,
          }
        : {
            protocolId: "PROTO_SPO2_BORDERLINE",
            message: `SpO2 limítrofe (${r.spo2Pct}%). Controlar ventilación del módulo y filtros de CO2.`,
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
            message: `Privación de sueño severa (${r.sleepHours} h). Riesgo de fatiga operativa y pérdida de concentración en maniobras.`,
          }
        : {
            protocolId: "PROTO_SLEEP_INSUFFICIENT",
            message: `Sueño insuficiente (${r.sleepHours} h). Ajustar ciclo circadiano y protocolos de iluminación.`,
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
            message: `Estado de ánimo bajo (${r.mood}/5). Riesgo psicosocial por aislamiento y confinamiento prolongado.`,
          }
        : {
            protocolId: "PROTO_MOOD_SUPPORT",
            message: `Ánimo neutral/decaído (${r.mood}/5). Fomentar comunicación con familiares y soporte de misión.`,
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
    "Parámetros dentro de rangos nominales de misión. Continuar con la rutina programada.";

  return { status, protocolId, alerts, recommendation };
}
