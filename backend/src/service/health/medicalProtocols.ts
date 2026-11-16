/**
 * @module service/health/medicalProtocols
 * Standardized NASA HRP biomedical response protocols referenced by deterministic reading
 * evaluations (`evaluateReading`) and clinical incident workflows.
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
    title: "Nominal Biomedical Monitoring",
    indicator: "nominal",
    severity: "OK",
    summary: "Parameters within nominal mission ranges. Continue scheduled routine.",
    immediateActions: [
      "Maintain biomedical logging per mission schedule.",
      "Continue standard hydration and circadian cycle.",
    ],
  },
  PROTO_HYPOXIA: {
    id: "PROTO_HYPOXIA",
    title: "Acute Hypoxia Protocol",
    indicator: "spo2",
    severity: "CRITICAL",
    summary:
      "CRITICAL ALERT [PROTO_HYPOXIA]: Hypoxia detected (SpO2 < 92%). Notify the Flight Surgeon, administer 100% supplemental O2, abort EVA, and verify cabin O2/CO2 partial pressure.",
    immediateActions: [
      "Administer immediate supplemental oxygen and verify suit/cabin seal.",
      "Check life-support ppO2 and CO2 scrubbers.",
      "Suspend EVA and notify the Flight Surgeon.",
    ],
  },
  PROTO_SPO2_BORDERLINE: {
    id: "PROTO_SPO2_BORDERLINE",
    title: "Oxygen Saturation Watch",
    indicator: "spo2",
    severity: "WARNING",
    summary:
      "CAUTION [PROTO_SPO2_BORDERLINE]: Borderline SpO2 (92–94%). Verify module ventilation, CO2 filters, and repeat oximetry in 30 minutes.",
    immediateActions: [
      "Inspect ventilation airflow and CO2 scrubber cartridges.",
      "Repeat pulse oximetry reading at rest.",
    ],
  },
  PROTO_HYPOGLYCEMIA: {
    id: "PROTO_HYPOGLYCEMIA",
    title: "Severe Hypoglycemia Protocol",
    indicator: "glucose",
    severity: "CRITICAL",
    summary:
      "CRITICAL ALERT [PROTO_HYPOGLYCEMIA]: Hypoglycemia (< 70 mg/dL). Notify the Flight Surgeon, administer 15–20 g fast-acting oral glucose, suspend critical maneuvers, and re-evaluate in 15 minutes.",
    immediateActions: [
      "Administer oral glucose gel/tablets (15–20 g) if conscious.",
      "Suspend EVA or precision tasks and recheck capillary glucose in 15 min.",
      "Notify the Flight Surgeon.",
    ],
  },
  PROTO_HYPERGLYCEMIA: {
    id: "PROTO_HYPERGLYCEMIA",
    title: "Critical Hyperglycemia Protocol",
    indicator: "glucose",
    severity: "CRITICAL",
    summary:
      "CRITICAL ALERT [PROTO_HYPERGLYCEMIA]: Severe hyperglycemia (> 180 mg/dL). Notify the Flight Surgeon, initiate controlled hydration, check ketones, and suspend EVA.",
    immediateActions: [
      "Initiate oral/IV hydration per Flight Surgeon guidance.",
      "Assess metabolic symptoms and repeat glucose check in 1 hour.",
    ],
  },
  PROTO_GLUCOSE_ELEVATED: {
    id: "PROTO_GLUCOSE_ELEVATED",
    title: "Metabolic & Nutritional Control",
    indicator: "glucose",
    severity: "WARNING",
    summary:
      "CAUTION [PROTO_GLUCOSE_ELEVATED]: Elevated glucose (141–180 mg/dL). Adjust nutritional ration, hydrate, and re-evaluate in 4 hours.",
    immediateActions: [
      "Review carbohydrate intake in the space ration.",
      "Increase hydration and repeat measurement in 4 hours.",
    ],
  },
  PROTO_HYPERTENSIVE_CRISIS: {
    id: "PROTO_HYPERTENSIVE_CRISIS",
    title: "Hypertensive Crisis Protocol",
    indicator: "bloodPressure",
    severity: "CRITICAL",
    summary:
      "CRITICAL ALERT [PROTO_HYPERTENSIVE_CRISIS]: Hypertensive crisis (>= 140/90 mmHg). Notify the Flight Surgeon, place crewmember at rest, suspend EVA, and assess fluid redistribution.",
    immediateActions: [
      "Immediate cabin rest and recheck blood pressure in 15 minutes.",
      "Suspend strenuous physical activity and EVA.",
      "Notify the Flight Surgeon for pharmacological evaluation.",
    ],
  },
  PROTO_HYPOTENSION: {
    id: "PROTO_HYPOTENSION",
    title: "Acute Hypotension Protocol",
    indicator: "bloodPressure",
    severity: "CRITICAL",
    summary:
      "CRITICAL ALERT [PROTO_HYPOTENSION]: Severe hypotension (systolic < 90 mmHg). Notify the Flight Surgeon, initiate fluid/electrolyte replacement, and apply orthostatic compression.",
    immediateActions: [
      "Place in supine/safe position and administer electrolyte hydration.",
      "Activate compression garments and notify the Flight Surgeon.",
    ],
  },
  PROTO_BLOOD_PRESSURE_BORDERLINE: {
    id: "PROTO_BLOOD_PRESSURE_BORDERLINE",
    title: "Borderline Hemodynamic Monitoring",
    indicator: "bloodPressure",
    severity: "WARNING",
    summary:
      "CAUTION [PROTO_BLOOD_PRESSURE_BORDERLINE]: Borderline blood pressure. Hydrate, maintain relative rest, and repeat reading in 4 hours.",
    immediateActions: [
      "Ensure oral hydration and reduce physical workload.",
      "Repeat blood pressure check in 4 hours.",
    ],
  },
  PROTO_TACHYCARDIA: {
    id: "PROTO_TACHYCARDIA",
    title: "Critical Tachycardia Protocol",
    indicator: "heartRate",
    severity: "CRITICAL",
    summary:
      "CRITICAL ALERT [PROTO_TACHYCARDIA]: Severe tachycardia (> 100 bpm at rest). Notify the Flight Surgeon, record a 12-lead ECG, hydrate, and suspend EVA.",
    immediateActions: [
      "Capture ECG trace and verify electrolytes/hydration.",
      "Suspend EVA and notify the Flight Surgeon.",
    ],
  },
  PROTO_BRADYCARDIA: {
    id: "PROTO_BRADYCARDIA",
    title: "Extreme Bradycardia Protocol",
    indicator: "heartRate",
    severity: "CRITICAL",
    summary:
      "CRITICAL ALERT [PROTO_BRADYCARDIA]: Extreme bradycardia (< 40 bpm). Notify the Flight Surgeon, assess perfusion, and record continuous ECG.",
    immediateActions: [
      "Assess level of consciousness and immediate blood pressure.",
      "Start continuous ECG monitoring and notify the Flight Surgeon.",
    ],
  },
  PROTO_HEART_RATE_MONITOR: {
    id: "PROTO_HEART_RATE_MONITOR",
    title: "Heart Rate Surveillance",
    indicator: "heartRate",
    severity: "WARNING",
    summary:
      "CAUTION [PROTO_HEART_RATE_MONITOR]: Heart rate outside nominal range. Moderate physical activity and repeat check in 4 hours.",
    immediateActions: [
      "Reduce physical exertion and verify hydration.",
      "Repeat heart rate reading in 4 hours.",
    ],
  },
  PROTO_FEVER: {
    id: "PROTO_FEVER",
    title: "Acute Fever / Infection Protocol",
    indicator: "temperature",
    severity: "CRITICAL",
    summary:
      "CRITICAL ALERT [PROTO_FEVER]: High fever (> 38.0 °C). Notify the Flight Surgeon, apply symptomatic isolation if indicated, start antipyretic and hydration, and suspend EVA.",
    immediateActions: [
      "Administer authorized antipyretic and intensive hydration.",
      "Assess infectious/immune focus and notify the Flight Surgeon.",
    ],
  },
  PROTO_HYPOTHERMIA: {
    id: "PROTO_HYPOTHERMIA",
    title: "Cabin/Suit Hypothermia Protocol",
    indicator: "temperature",
    severity: "CRITICAL",
    summary:
      "CRITICAL ALERT [PROTO_HYPOTHERMIA]: Hypothermia (< 35.5 °C). Notify the Flight Surgeon, begin active rewarming, and inspect suit/module thermal control.",
    immediateActions: [
      "Apply active rewarming and thermally insulate the crewmember.",
      "Verify suit/cabin thermal loop and notify the Flight Surgeon.",
    ],
  },
  PROTO_MILD_HYPOTHERMIA: {
    id: "PROTO_MILD_HYPOTHERMIA",
    title: "Mild Hypothermia Watch",
    indicator: "temperature",
    severity: "WARNING",
    summary:
      "CAUTION [PROTO_MILD_HYPOTHERMIA]: Mild hypothermia (35.5–36.0 °C). Inspect suit/cabin thermoregulation, add warming layers, and re-evaluate in 2 hours.",
    immediateActions: [
      "Check cabin temperature and suit thermal regulation system.",
      "Add thermal layers and provide warm fluids.",
      "Repeat measurement in 2 hours; escalate if temperature drops below 35.5 °C.",
    ],
  },
  PROTO_SUBFEBRILE: {
    id: "PROTO_SUBFEBRILE",
    title: "Thermal & Immune Surveillance",
    indicator: "temperature",
    severity: "WARNING",
    summary:
      "CAUTION [PROTO_SUBFEBRILE]: Subfebrile temperature (> 37.5–38.0 °C). Monitor immune symptoms, hydrate, and re-evaluate in 4 hours.",
    immediateActions: [
      "Monitor temperature every 4 hours and maintain hydration.",
      "Watch for respiratory symptoms or radiation exposure.",
    ],
  },
  PROTO_SLEEP_DEPRIVATION: {
    id: "PROTO_SLEEP_DEPRIVATION",
    title: "Severe Operational Fatigue Protocol",
    indicator: "sleep",
    severity: "CRITICAL",
    summary:
      "CRITICAL ALERT [PROTO_SLEEP_DEPRIVATION]: Severe sleep deprivation (< 6.0 h). Notify the Flight Surgeon, restrict critical maneuvers/EVA, and schedule mandatory recovery rest.",
    immediateActions: [
      "Stand down from critical maneuvers/EVA until completing a recovery sleep block.",
      "Notify the Flight Surgeon and adjust circadian lighting.",
    ],
  },
  PROTO_SLEEP_INSUFFICIENT: {
    id: "PROTO_SLEEP_INSUFFICIENT",
    title: "Circadian Cycle Adjustment",
    indicator: "sleep",
    severity: "WARNING",
    summary:
      "CAUTION [PROTO_SLEEP_INSUFFICIENT]: Insufficient sleep (6.0–6.9 h). Adjust circadian lighting and schedule rest before the next shift.",
    immediateActions: [
      "Apply blue/amber circadian lighting protocol and scheduled rest.",
    ],
  },
  PROTO_PSYCHOSOCIAL_DISTRESS: {
    id: "PROTO_PSYCHOSOCIAL_DISTRESS",
    title: "Critical Psychosocial Support Protocol",
    indicator: "mood",
    severity: "CRITICAL",
    summary:
      "CRITICAL ALERT [PROTO_PSYCHOSOCIAL_DISTRESS]: Elevated psychosocial risk (mood <= 2/5). Notify the Flight Surgeon and space psychology team; enable a private ground link.",
    immediateActions: [
      "Schedule a private session with flight psychology and the Flight Surgeon.",
      "Reduce isolated workload and enable family communication.",
    ],
  },
  PROTO_MOOD_SUPPORT: {
    id: "PROTO_MOOD_SUPPORT",
    title: "Preventive Psychosocial Support",
    indicator: "mood",
    severity: "WARNING",
    summary:
      "CAUTION [PROTO_MOOD_SUPPORT]: Low mood (3/5). Encourage family communication and mission support.",
    immediateActions: [
      "Schedule a family call or team cohesion activity.",
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
