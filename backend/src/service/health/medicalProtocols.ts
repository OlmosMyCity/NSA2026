/**
 * @module service/health/medicalProtocols
 * Standardized NASA HRP biomedical response protocols referenced by deterministic reading
 * evaluations (`evaluateReading`) and clinical incident workflows.
 *
 * Note: Protocol `title`, `summary`, and `immediateActions` strings are preserved in Spanish
 * to satisfy UI display and unit-test contract assertions.
 */

/** Clinical severity classification aligned with Prisma `HealthStatus`. */
export type ProtocolSeverity = "OK" | "WARNING" | "CRITICAL";

/** Deterministic clinical response protocol triggered by vital-sign threshold breaches. */
export interface MedicalProtocol {
  id: string;
  title: string;
  indicator: string;
  severity: ProtocolSeverity;
  summary: string;
  immediateActions: string[];
}

/** Registry of all deterministic biomedical response protocols keyed by `protocolId`. */
export const MEDICAL_PROTOCOLS: Record<string, MedicalProtocol> = {
  PROTO_NOMINAL: {
    id: "PROTO_NOMINAL",
    title: "Monitoreo Biomédico Nominal",
    indicator: "nominal",
    severity: "OK",
    summary: "Parámetros dentro de rangos nominales de misión. Continuar con la rutina programada.",
    immediateActions: [
      "Mantener registro biomédico según cronograma de misión.",
      "Continuar hidratación y ciclo circadiano estándar.",
    ],
  },
  PROTO_HYPOXIA: {
    id: "PROTO_HYPOXIA",
    title: "Protocolo de Hipoxia Aguda",
    indicator: "spo2",
    severity: "CRITICAL",
    summary:
      "ALERTA CRÍTICA [PROTO_HYPOXIA]: Hipoxia detectada (SpO2 < 92%). Notificar al Cirujano de Vuelo, administrar O2 suplementario al 100%, abortar EVA y verificar presión parcial de O2/CO2 en cabina.",
    immediateActions: [
      "Administrar oxígeno suplementario inmediato y verificar sellado de traje/cabina.",
      "Comprobar ppO2 y depuradores de CO2 del soporte vital.",
      "Suspender EVA y notificar al Cirujano de Vuelo.",
    ],
  },
  PROTO_SPO2_BORDERLINE: {
    id: "PROTO_SPO2_BORDERLINE",
    title: "Vigilancia de Saturación de Oxígeno",
    indicator: "spo2",
    severity: "WARNING",
    summary:
      "PRECAUCIÓN [PROTO_SPO2_BORDERLINE]: SpO2 limítrofe (92–94%). Verificar ventilación del módulo, filtros de CO2 y repetir oximetría en 30 minutos.",
    immediateActions: [
      "Revisar flujo de ventilación y cartuchos de CO2.",
      "Repetir lectura de pulso-oximetría en reposo.",
    ],
  },
  PROTO_HYPOGLYCEMIA: {
    id: "PROTO_HYPOGLYCEMIA",
    title: "Protocolo de Hipoglucemia Severa",
    indicator: "glucose",
    severity: "CRITICAL",
    summary:
      "ALERTA CRÍTICA [PROTO_HYPOGLYCEMIA]: Hipoglucemia (< 70 mg/dL). Notificar al Cirujano de Vuelo, administrar 15–20 g de glucosa oral de acción rápida, suspender maniobras críticas y reevaluar en 15 minutos.",
    immediateActions: [
      "Administrar gel/tabletas de glucosa oral (15–20 g) si está consciente.",
      "Suspender EVA o tareas de precisión y reevaluar glucemia capilar a los 15 min.",
      "Notificar al Cirujano de Vuelo.",
    ],
  },
  PROTO_HYPERGLYCEMIA: {
    id: "PROTO_HYPERGLYCEMIA",
    title: "Protocolo de Hiperglucemia Crítica",
    indicator: "glucose",
    severity: "CRITICAL",
    summary:
      "ALERTA CRÍTICA [PROTO_HYPERGLYCEMIA]: Hiperglucemia severa (> 180 mg/dL). Notificar al Cirujano de Vuelo, iniciar hidratación controlada, verificar cetonas y suspender EVA.",
    immediateActions: [
      "Iniciar hidratación oral/IV según indicación del Cirujano de Vuelo.",
      "Evaluar síntomas metabólicos y repetir glucemia en 1 hora.",
    ],
  },
  PROTO_GLUCOSE_ELEVATED: {
    id: "PROTO_GLUCOSE_ELEVATED",
    title: "Control Metabólico y Nutricional",
    indicator: "glucose",
    severity: "WARNING",
    summary:
      "PRECAUCIÓN [PROTO_GLUCOSE_ELEVATED]: Glucosa elevada (141–180 mg/dL). Ajustar ración nutricional, hidratar y reevaluar en 4 horas.",
    immediateActions: [
      "Revisar ingesta de carbohidratos en la ración espacial.",
      "Aumentar hidratación y repetir medición en 4 horas.",
    ],
  },
  PROTO_HYPERTENSIVE_CRISIS: {
    id: "PROTO_HYPERTENSIVE_CRISIS",
    title: "Protocolo de Crisis Hipertensiva",
    indicator: "bloodPressure",
    severity: "CRITICAL",
    summary:
      "ALERTA CRÍTICA [PROTO_HYPERTENSIVE_CRISIS]: Crisis hipertensiva (>= 140/90 mmHg). Notificar al Cirujano de Vuelo, colocar al tripulante en reposo, suspender EVA y evaluar redistribución de fluidos.",
    immediateActions: [
      "Reposo inmediato en cabina y reevaluar presión arterial en 15 minutos.",
      "Suspender actividad física intensa y EVA.",
      "Notificar al Cirujano de Vuelo para valoración farmacológica.",
    ],
  },
  PROTO_HYPOTENSION: {
    id: "PROTO_HYPOTENSION",
    title: "Protocolo de Hipotensión Aguda",
    indicator: "bloodPressure",
    severity: "CRITICAL",
    summary:
      "ALERTA CRÍTICA [PROTO_HYPOTENSION]: Hipotensión severa (sistólica < 90 mmHg). Notificar al Cirujano de Vuelo, aplicar reposición de fluidos/electrolitos y compresión ortostática.",
    immediateActions: [
      "Colocar en posición supina/segura y administrar hidratación con electrolitos.",
      "Activar prendas de compresión y notificar al Cirujano de Vuelo.",
    ],
  },
  PROTO_BLOOD_PRESSURE_BORDERLINE: {
    id: "PROTO_BLOOD_PRESSURE_BORDERLINE",
    title: "Seguimiento Hemodinámico Limítrofe",
    indicator: "bloodPressure",
    severity: "WARNING",
    summary:
      "PRECAUCIÓN [PROTO_BLOOD_PRESSURE_BORDERLINE]: Presión arterial limítrofe. Hidratación, reposo relativo y repetir toma en 4 horas.",
    immediateActions: [
      "Asegurar hidratación oral y reducir carga física.",
      "Repetir toma de presión arterial en 4 horas.",
    ],
  },
  PROTO_TACHYCARDIA: {
    id: "PROTO_TACHYCARDIA",
    title: "Protocolo de Taquicardia Crítica",
    indicator: "heartRate",
    severity: "CRITICAL",
    summary:
      "ALERTA CRÍTICA [PROTO_TACHYCARDIA]: Taquicardia severa (> 100 lpm en reposo). Notificar al Cirujano de Vuelo, registrar ECG de 12 derivaciones, hidratar y suspender EVA.",
    immediateActions: [
      "Capturar trazado ECG y verificar electrolitos/hidratación.",
      "Suspender EVA y notificar al Cirujano de Vuelo.",
    ],
  },
  PROTO_BRADYCARDIA: {
    id: "PROTO_BRADYCARDIA",
    title: "Protocolo de Bradicardia Extrema",
    indicator: "heartRate",
    severity: "CRITICAL",
    summary:
      "ALERTA CRÍTICA [PROTO_BRADYCARDIA]: Bradicardia extrema (< 40 lpm). Notificar al Cirujano de Vuelo, evaluar perfusión y registrar ECG continuo.",
    immediateActions: [
      "Evaluar estado de conciencia y presión arterial inmediata.",
      "Iniciar monitoreo ECG continuo y notificar al Cirujano de Vuelo.",
    ],
  },
  PROTO_HEART_RATE_MONITOR: {
    id: "PROTO_HEART_RATE_MONITOR",
    title: "Vigilancia de Frecuencia Cardiaca",
    indicator: "heartRate",
    severity: "WARNING",
    summary:
      "PRECAUCIÓN [PROTO_HEART_RATE_MONITOR]: Frecuencia cardiaca fuera de rango nominal. Moderar actividad física y repetir control en 4 horas.",
    immediateActions: [
      "Reducir esfuerzo físico y verificar hidratación.",
      "Repetir lectura cardiaca en 4 horas.",
    ],
  },
  PROTO_FEVER: {
    id: "PROTO_FEVER",
    title: "Protocolo de Fiebre Aguda / Infección",
    indicator: "temperature",
    severity: "CRITICAL",
    summary:
      "ALERTA CRÍTICA [PROTO_FEVER]: Fiebre alta (> 38.0 °C). Notificar al Cirujano de Vuelo, aislar sintomáticamente si aplica, iniciar antipirético e hidratación, y suspender EVA.",
    immediateActions: [
      "Administrar antipirético autorizado e hidratación intensiva.",
      "Evaluar foco infeccioso/inmunológico y notificar al Cirujano de Vuelo.",
    ],
  },
  PROTO_HYPOTHERMIA: {
    id: "PROTO_HYPOTHERMIA",
    title: "Protocolo de Hipotermia en Cabina/Traje",
    indicator: "temperature",
    severity: "CRITICAL",
    summary:
      "ALERTA CRÍTICA [PROTO_HYPOTHERMIA]: Hipotermia (< 35.5 °C). Notificar al Cirujano de Vuelo, iniciar recalentamiento activo y revisar control térmico del traje/módulo.",
    immediateActions: [
      "Aplicar recalentamiento activo y aislar térmicamente al tripulante.",
      "Verificar bucle térmico del traje/cabina y notificar al Cirujano de Vuelo.",
    ],
  },
  PROTO_SUBFEBRILE: {
    id: "PROTO_SUBFEBRILE",
    title: "Vigilancia Térmica e Inmunológica",
    indicator: "temperature",
    severity: "WARNING",
    summary:
      "PRECAUCIÓN [PROTO_SUBFEBRILE]: Febrícula (37.6–38.0 °C). Vigilar síntomas inmunológicos, hidratar y reevaluar en 4 horas.",
    immediateActions: [
      "Controlar temperatura cada 4 horas e hidratar.",
      "Vigilar síntomas respiratorios o exposición a radiación.",
    ],
  },
  PROTO_SLEEP_DEPRIVATION: {
    id: "PROTO_SLEEP_DEPRIVATION",
    title: "Protocolo de Fatiga Operativa Severa",
    indicator: "sleep",
    severity: "CRITICAL",
    summary:
      "ALERTA CRÍTICA [PROTO_SLEEP_DEPRIVATION]: Privación de sueño severa (< 6.0 h). Notificar al Cirujano de Vuelo, restringir maniobras críticas/EVA y programar descanso obligatorio.",
    immediateActions: [
      "Retirar de maniobras críticas/EVA hasta completar bloque de sueño reparador.",
      "Notificar al Cirujano de Vuelo y ajustar iluminación circadiana.",
    ],
  },
  PROTO_SLEEP_INSUFFICIENT: {
    id: "PROTO_SLEEP_INSUFFICIENT",
    title: "Ajuste de Ciclo Circadiano",
    indicator: "sleep",
    severity: "WARNING",
    summary:
      "PRECAUCIÓN [PROTO_SLEEP_INSUFFICIENT]: Sueño insuficiente (6.0–6.9 h). Ajustar iluminación circadiana y programar descanso antes del siguiente turno.",
    immediateActions: [
      "Aplicar protocolo de iluminación azul/ámbar y descanso programado.",
    ],
  },
  PROTO_PSYCHOSOCIAL_DISTRESS: {
    id: "PROTO_PSYCHOSOCIAL_DISTRESS",
    title: "Protocolo de Soporte Psicosocial Crítico",
    indicator: "mood",
    severity: "CRITICAL",
    summary:
      "ALERTA CRÍTICA [PROTO_PSYCHOSOCIAL_DISTRESS]: Riesgo psicosocial elevado (ánimo <= 2/5). Notificar al Cirujano de Vuelo y equipo de psicología espacial; habilitar enlace privado con tierra.",
    immediateActions: [
      "Establecer sesión privada con psicología de vuelo y Cirujano de Vuelo.",
      "Reducir carga operativa aislada y habilitar comunicación familiar.",
    ],
  },
  PROTO_MOOD_SUPPORT: {
    id: "PROTO_MOOD_SUPPORT",
    title: "Acompañamiento Psicosocial Preventivo",
    indicator: "mood",
    severity: "WARNING",
    summary:
      "PRECAUCIÓN [PROTO_MOOD_SUPPORT]: Ánimo decaído (3/5). Fomentar comunicación con familiares y soporte de misión.",
    immediateActions: [
      "Programar llamada familiar o actividad grupal de cohesión.",
    ],
  },
};

/** Looks up a deterministic medical protocol by ID, returning `null` if unknown. */
export function getMedicalProtocol(protocolId: string): MedicalProtocol | null {
  return MEDICAL_PROTOCOLS[protocolId] ?? null;
}

/** Returns all registered NASA HRP medical protocols. */
export function listMedicalProtocols(): MedicalProtocol[] {
  return Object.values(MEDICAL_PROTOCOLS);
}
