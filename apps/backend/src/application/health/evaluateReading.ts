/**
 * @module application/health/evaluateReading
 * Pure deterministic clinical triage engine enforcing NASA Human Research Program (HRP)
 * biomedical thresholds for Artemis crew health readings.
 *
 * Architectural role: Acts as the authoritative deterministic rule engine for reading
 * classification (`OK`, `WARNING`, `CRITICAL`), triggered alerts, and protocol selection.
 * Alert messages are preserved in Spanish for clinical UI and test assertions.
 */

import { getMedicalProtocol } from "./medicalProtocols.js";

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

/** Severity level assigned to an individual physiological threshold breach. */
export type HealthAlertLevel = "WARNING" | "CRITICAL";

/** Individual clinical alert produced when a vital indicator breaches HRP bounds. */
export interface HealthAlert {
  indicator: string;
  level: HealthAlertLevel;
  protocolId: string;
  message: string;
  value: number;
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
 * Evaluates 7 astronaut physiological and behavioral indicators against NASA Human Research
 * Program (HRP) thresholds for Artemis missions:
 * - Heart rate (bpm): critical `< 40` or `> 100`; warning `40–49` or `91–100`
 * - Blood pressure (mmHg): critical `>= 140` sys or `>= 90` dia or `< 90` sys; warning `130–139` sys or `85–89` dia
 * - Blood glucose (mg/dL): critical `< 70` or `> 180`; warning `141–180`
 * - Body temperature (°C): critical `< 35.5` or `> 38.0`; warning `37.6–38.0`
 * - SpO2 (%): critical `< 92`; warning `92–94`
 * - Sleep (hours): critical `< 6.0`; warning `6.0–6.99`
 * - Mood (1–5): critical `<= 2`; warning `3`
 *
 * Pure domain function with zero side effects or external dependencies; `CRITICAL` alerts
 * take precedence over `WARNING` alerts when selecting the primary `protocolId`.
 */
export function evaluateReading(reading: HealthReadingInput): HealthEvaluationResult {
  const alerts: HealthAlert[] = [];

  // 1. Heart Rate (bpm)
  if (reading.heartRateBpm > 100) {
    alerts.push({
      indicator: "heartRate",
      level: "CRITICAL",
      protocolId: "PROTO_TACHYCARDIA",
      message: `Frecuencia cardiaca crítica (${reading.heartRateBpm} lpm). Riesgo de arritmia o evento cardiovascular en gravedad alterada.`,
      value: reading.heartRateBpm,
    });
  } else if (reading.heartRateBpm < 40) {
    alerts.push({
      indicator: "heartRate",
      level: "CRITICAL",
      protocolId: "PROTO_BRADYCARDIA",
      message: `Bradicardia extrema (${reading.heartRateBpm} lpm). Riesgo de hipoperfusión en gravedad alterada.`,
      value: reading.heartRateBpm,
    });
  } else if (
    (reading.heartRateBpm >= 91 && reading.heartRateBpm <= 100) ||
    (reading.heartRateBpm >= 40 && reading.heartRateBpm <= 49)
  ) {
    alerts.push({
      indicator: "heartRate",
      level: "WARNING",
      protocolId: "PROTO_HEART_RATE_MONITOR",
      message: `Frecuencia cardiaca fuera de rango nominal (${reading.heartRateBpm} lpm). Monitorear actividad física.`,
      value: reading.heartRateBpm,
    });
  }

  // 2. Blood Pressure (mmHg)
  const isHypertensiveCrisis = reading.systolicMmHg >= 140 || reading.diastolicMmHg >= 90;
  const isHypotension = reading.systolicMmHg < 90;
  const isSysWarning = reading.systolicMmHg >= 130 && reading.systolicMmHg <= 139;
  const isDiaWarning = reading.diastolicMmHg >= 85 && reading.diastolicMmHg <= 89;

  if (isHypertensiveCrisis) {
    alerts.push({
      indicator: "bloodPressure",
      level: "CRITICAL",
      protocolId: "PROTO_HYPERTENSIVE_CRISIS",
      message: `Crisis hipertensiva (${reading.systolicMmHg}/${reading.diastolicMmHg} mmHg). Posible redistribución severa de fluidos.`,
      value: reading.systolicMmHg,
    });
  } else if (isHypotension) {
    alerts.push({
      indicator: "bloodPressure",
      level: "CRITICAL",
      protocolId: "PROTO_HYPOTENSION",
      message: `Hipotensión arterial crítica (${reading.systolicMmHg}/${reading.diastolicMmHg} mmHg). Riesgo de síncope ortostático.`,
      value: reading.systolicMmHg,
    });
  } else if (isSysWarning || isDiaWarning) {
    alerts.push({
      indicator: "bloodPressure",
      level: "WARNING",
      protocolId: "PROTO_BLOOD_PRESSURE_BORDERLINE",
      message: `Presión arterial limítrofe (${reading.systolicMmHg}/${reading.diastolicMmHg} mmHg). Hidratación y reposo recomendados.`,
      value: reading.systolicMmHg,
    });
  }

  // 3. Blood Glucose (mg/dL)
  if (reading.glucoseMgDl < 70) {
    alerts.push({
      indicator: "glucose",
      level: "CRITICAL",
      protocolId: "PROTO_HYPOGLYCEMIA",
      message: `Hipoglucemia crítica (${reading.glucoseMgDl} mg/dL). Riesgo de déficit neurológico y desbalance metabólico severo.`,
      value: reading.glucoseMgDl,
    });
  } else if (reading.glucoseMgDl > 180) {
    alerts.push({
      indicator: "glucose",
      level: "CRITICAL",
      protocolId: "PROTO_HYPERGLYCEMIA",
      message: `Hiperglucemia crítica (${reading.glucoseMgDl} mg/dL). Riesgo de desbalance metabólico severo.`,
      value: reading.glucoseMgDl,
    });
  } else if (reading.glucoseMgDl > 140 && reading.glucoseMgDl <= 180) {
    alerts.push({
      indicator: "glucose",
      level: "WARNING",
      protocolId: "PROTO_GLUCOSE_ELEVATED",
      message: `Glucosa elevada (${reading.glucoseMgDl} mg/dL). Revisar ingesta nutricional de la ración espacial.`,
      value: reading.glucoseMgDl,
    });
  }

  // 4. Body Temperature (°C)
  if (reading.temperatureC > 38.0) {
    alerts.push({
      indicator: "temperature",
      level: "CRITICAL",
      protocolId: "PROTO_FEVER",
      message: `Fiebre alta (${reading.temperatureC} °C). Riesgo de infección aguda o respuesta inflamatoria en cabina.`,
      value: reading.temperatureC,
    });
  } else if (reading.temperatureC < 35.5) {
    alerts.push({
      indicator: "temperature",
      level: "CRITICAL",
      protocolId: "PROTO_HYPOTHERMIA",
      message: `Hipotermia crítica (${reading.temperatureC} °C). Verificar control térmico en traje/cabina.`,
      value: reading.temperatureC,
    });
  } else if (reading.temperatureC >= 37.6 && reading.temperatureC <= 38.0) {
    alerts.push({
      indicator: "temperature",
      level: "WARNING",
      protocolId: "PROTO_SUBFEBRILE",
      message: `Febrícula detectada (${reading.temperatureC} °C). Vigilar síntomas inmunológicos y radiación.`,
      value: reading.temperatureC,
    });
  }

  // 5. Oxygen Saturation (SpO2 %)
  if (reading.spo2Pct < 92) {
    alerts.push({
      indicator: "spo2",
      level: "CRITICAL",
      protocolId: "PROTO_HYPOXIA",
      message: `Saturación de O2 crítica (${reading.spo2Pct}%). Hipoxia detectada; verificar presión parcial de O2 en cabina.`,
      value: reading.spo2Pct,
    });
  } else if (reading.spo2Pct >= 92 && reading.spo2Pct <= 94) {
    alerts.push({
      indicator: "spo2",
      level: "WARNING",
      protocolId: "PROTO_SPO2_BORDERLINE",
      message: `SpO2 limítrofe (${reading.spo2Pct}%). Controlar ventilación del módulo y filtros de CO2.`,
      value: reading.spo2Pct,
    });
  }

  // 6. Sleep Hours
  if (reading.sleepHours < 6.0) {
    alerts.push({
      indicator: "sleep",
      level: "CRITICAL",
      protocolId: "PROTO_SLEEP_DEPRIVATION",
      message: `Privación de sueño severa (${reading.sleepHours} h). Riesgo de fatiga operativa y pérdida de concentración en maniobras.`,
      value: reading.sleepHours,
    });
  } else if (reading.sleepHours >= 6.0 && reading.sleepHours < 7.0) {
    alerts.push({
      indicator: "sleep",
      level: "WARNING",
      protocolId: "PROTO_SLEEP_INSUFFICIENT",
      message: `Sueño insuficiente (${reading.sleepHours} h). Ajustar ciclo circadiano y protocolos de iluminación.`,
      value: reading.sleepHours,
    });
  }

  // 7. Mood (1–5 scale)
  if (reading.mood <= 2) {
    alerts.push({
      indicator: "mood",
      level: "CRITICAL",
      protocolId: "PROTO_PSYCHOSOCIAL_DISTRESS",
      message: `Estado de ánimo bajo (${reading.mood}/5). Riesgo psicosocial por aislamiento y confinamiento prolongado.`,
      value: reading.mood,
    });
  } else if (reading.mood === 3) {
    alerts.push({
      indicator: "mood",
      level: "WARNING",
      protocolId: "PROTO_MOOD_SUPPORT",
      message: `Ánimo neutral/decaído (${reading.mood}/5). Fomentar comunicación con familiares y soporte de misión.`,
      value: reading.mood,
    });
  }

  // Overall classification and primary protocol selection
  const criticalAlert = alerts.find((a) => a.level === "CRITICAL");
  const warningAlert = alerts.find((a) => a.level === "WARNING");

  let status: OverallHealthStatus = "OK";
  let protocolId = "PROTO_NOMINAL";

  if (criticalAlert) {
    status = "CRITICAL";
    protocolId = criticalAlert.protocolId;
  } else if (warningAlert) {
    status = "WARNING";
    protocolId = warningAlert.protocolId;
  }

  const protocol = getMedicalProtocol(protocolId);
  const recommendation =
    protocol?.summary ??
    "Parámetros dentro de rangos nominales de misión. Continuar con la rutina programada.";

  return {
    status,
    protocolId,
    alerts,
    recommendation,
  };
}

