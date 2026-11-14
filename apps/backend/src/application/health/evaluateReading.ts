export interface HealthReadingInput {
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  glucoseMgDl: number;
  temperatureC: number;
  spo2Pct: number;
  sleepHours: number;
  mood: number; // 1 a 5
}

export type HealthAlertLevel = "WARNING" | "CRITICAL";

export interface HealthAlert {
  indicator: string;
  level: HealthAlertLevel;
  message: string;
  value: number;
}

export type OverallHealthStatus = "OK" | "WARNING" | "CRITICAL";

export interface HealthEvaluationResult {
  status: OverallHealthStatus;
  alerts: HealthAlert[];
  recommendation: string;
}

/**
 * Evalúa los 7 indicadores vitales de un astronauta según los estándares
 * del Human Research Program (HRP) de la NASA para misiones Artemis.
 *
 * Función de dominio puro (sin efectos secundarios ni dependencias externas).
 */
export function evaluateReading(reading: HealthReadingInput): HealthEvaluationResult {
  const alerts: HealthAlert[] = [];

  // 1. Frecuencia Cardiaca (lpm)
  if (reading.heartRateBpm > 100 || reading.heartRateBpm < 40) {
    alerts.push({
      indicator: "heartRate",
      level: "CRITICAL",
      message: `Frecuencia cardiaca crítica (${reading.heartRateBpm} lpm). Riesgo de arritmia o evento cardiovascular en gravedad alterada.`,
      value: reading.heartRateBpm,
    });
  } else if (
    (reading.heartRateBpm >= 91 && reading.heartRateBpm <= 100) ||
    (reading.heartRateBpm >= 40 && reading.heartRateBpm <= 49)
  ) {
    alerts.push({
      indicator: "heartRate",
      level: "WARNING",
      message: `Frecuencia cardiaca fuera de rango nominal (${reading.heartRateBpm} lpm). Monitorear actividad física.`,
      value: reading.heartRateBpm,
    });
  }

  // 2. Presión Arterial (mmHg)
  const isSysCritical = reading.systolicMmHg >= 140 || reading.systolicMmHg < 90;
  const isDiaCritical = reading.diastolicMmHg >= 90;
  const isSysWarning = reading.systolicMmHg >= 130 && reading.systolicMmHg <= 139;
  const isDiaWarning = reading.diastolicMmHg >= 85 && reading.diastolicMmHg <= 89;

  if (isSysCritical || isDiaCritical) {
    alerts.push({
      indicator: "bloodPressure",
      level: "CRITICAL",
      message: `Presión arterial crítica (${reading.systolicMmHg}/${reading.diastolicMmHg} mmHg). Posible redistribución severa de fluidos.`,
      value: reading.systolicMmHg,
    });
  } else if (isSysWarning || isDiaWarning) {
    alerts.push({
      indicator: "bloodPressure",
      level: "WARNING",
      message: `Presión arterial limítrofe (${reading.systolicMmHg}/${reading.diastolicMmHg} mmHg). Hidratación y reposo recomendados.`,
      value: reading.systolicMmHg,
    });
  }

  // 3. Glucosa en Sangre (mg/dL)
  if (reading.glucoseMgDl < 70 || reading.glucoseMgDl > 180) {
    alerts.push({
      indicator: "glucose",
      level: "CRITICAL",
      message: `Nivel de glucosa crítico (${reading.glucoseMgDl} mg/dL). Riesgo de hipoglucemia o desbalance metabólico severo.`,
      value: reading.glucoseMgDl,
    });
  } else if (reading.glucoseMgDl > 140 && reading.glucoseMgDl <= 180) {
    alerts.push({
      indicator: "glucose",
      level: "WARNING",
      message: `Glucosa elevada (${reading.glucoseMgDl} mg/dL). Revisar ingesta nutricional de la ración espacial.`,
      value: reading.glucoseMgDl,
    });
  }

  // 4. Temperatura Corporal (°C)
  if (reading.temperatureC > 38.0 || reading.temperatureC < 35.5) {
    alerts.push({
      indicator: "temperature",
      level: "CRITICAL",
      message: `Temperatura corporal crítica (${reading.temperatureC} °C). Riesgo de infección aguda o hipotermia en traje/cabina.`,
      value: reading.temperatureC,
    });
  } else if (reading.temperatureC >= 37.6 && reading.temperatureC <= 38.0) {
    alerts.push({
      indicator: "temperature",
      level: "WARNING",
      message: `Febrícula detectada (${reading.temperatureC} °C). Vigilar síntomas inmunológicos y radiación.`,
      value: reading.temperatureC,
    });
  }

  // 5. Saturación de O2 (SpO2 %)
  if (reading.spo2Pct < 92) {
    alerts.push({
      indicator: "spo2",
      level: "CRITICAL",
      message: `Saturación de O2 crítica (${reading.spo2Pct}%). Hipoxia detectada; verificar presión parcial de O2 en cabina.`,
      value: reading.spo2Pct,
    });
  } else if (reading.spo2Pct >= 92 && reading.spo2Pct <= 94) {
    alerts.push({
      indicator: "spo2",
      level: "WARNING",
      message: `SpO2 limítrofe (${reading.spo2Pct}%). Controlar ventilación del módulo y filtros de CO2.`,
      value: reading.spo2Pct,
    });
  }

  // 6. Horas de Sueño
  if (reading.sleepHours < 6.0) {
    alerts.push({
      indicator: "sleep",
      level: "CRITICAL",
      message: `Privación de sueño severa (${reading.sleepHours} h). Riesgo de fatiga operativa y pérdida de concentración en maniobras.`,
      value: reading.sleepHours,
    });
  } else if (reading.sleepHours >= 6.0 && reading.sleepHours < 7.0) {
    alerts.push({
      indicator: "sleep",
      level: "WARNING",
      message: `Sueño insuficiente (${reading.sleepHours} h). Ajustar ciclo circadiano y protocolos de iluminación.`,
      value: reading.sleepHours,
    });
  }

  // 7. Estado de Ánimo (escala 1-5)
  if (reading.mood <= 2) {
    alerts.push({
      indicator: "mood",
      level: "CRITICAL",
      message: `Estado de ánimo bajo (${reading.mood}/5). Riesgo psicosocial por aislamiento y confinamiento prolongado.`,
      value: reading.mood,
    });
  } else if (reading.mood === 3) {
    alerts.push({
      indicator: "mood",
      level: "WARNING",
      message: `Ánimo neutral/decaído (${reading.mood}/5). Fomentar comunicación con familiares y soporte de misión.`,
      value: reading.mood,
    });
  }

  // Clasificación Global
  const hasCritical = alerts.some((a) => a.level === "CRITICAL");
  const hasWarning = alerts.some((a) => a.level === "WARNING");

  let status: OverallHealthStatus = "OK";
  let recommendation = "Parámetros dentro de rangos nominales de misión. Continuar con la rutina programada.";

  if (hasCritical) {
    status = "CRITICAL";
    recommendation =
      "ALERTA CRÍTICA: Notificar de inmediato al Cirujano de Vuelo (Flight Surgeon) en Control de Misión. Suspender actividades extravehiculares (EVA) y proceder al protocolo de contención médica.";
  } else if (hasWarning) {
    status = "WARNING";
    recommendation =
      "PRECAUCIÓN: Uno o más parámetros fuera de rango nominal. Repetir medición en 4 horas, verificar hidratación y descanso antes del siguiente turno.";
  }

  return {
    status,
    alerts,
    recommendation,
  };
}

