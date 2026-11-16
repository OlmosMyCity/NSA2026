/**
 * @module domain/health/medicalProtocols
 * Step-by-step onboard action guides for each deterministic `protocolId` emitted
 * by `evaluateReading` / `evaluateVitals`. Written for non-physician crewmates
 * (NASA-STD-3001 Vol. 2 usability for buddy/CMO triage) and grounded in
 * NASA-STD-3001, ISS Medical Checklist principles, and NASA HRP hazard protocols.
 */

import type { HealthAlert } from './types';

export interface MedicalProtocolGuide {
  protocolId: string;
  title: string;
  recheckIn: string;
  steps: string[];
  escalateIf: string;
  reference: string;
}

const NASA_STD_3001_V2 = 'NASA-STD-3001 Vol. 2 (Non-Physician CMO Usability)';
const ISS_CMO_ABCDE = 'ISS Medical Checklist · ABCDE Triage & On-Orbit Medical Kit';
const NASA_HRP_COUNTERMEASURES = 'NASA-STD-3001 Vol. 1 & NASA HRP Countermeasures';

export const MEDICAL_PROTOCOLS: Record<string, MedicalProtocolGuide> = {
  PROTO_HYPOXIA: {
    protocolId: 'PROTO_HYPOXIA',
    title: 'Hypoxia Response (SpO₂ < 92%)',
    recheckIn: '5 min',
    steps: [
      'Check airway and breathing; seat or stabilize the crewmember.',
      'Verify module cabin pressure and O₂ / CO₂ partial pressure telemetry.',
      'Administer supplemental oxygen from the On-Orbit Medical Kit.',
      'Recheck pulse oximetry on a warm finger and monitor consciousness.',
    ],
    escalateIf: 'SpO₂ remains < 92% on O₂ or confusion/cyanosis appears — initiate module airlock/clean-cabin move and alert Flight Surgeon.',
    reference: `${ISS_CMO_ABCDE} · ${NASA_STD_3001_V2}`,
  },
  PROTO_SPO2_BORDERLINE: {
    protocolId: 'PROTO_SPO2_BORDERLINE',
    title: 'Borderline SpO₂ Check (92–94%)',
    recheckIn: '15 min',
    steps: [
      'Ensure the pulse oximeter sensor is seated cleanly on a warm finger.',
      'Inspect cabin ventilation, airflow, and CO₂ scrubber status.',
      'Have the crewmember rest and perform slow, deep nasal breathing.',
    ],
    escalateIf: 'SpO₂ drops below 92% or shortness of breath develops.',
    reference: `${ISS_CMO_ABCDE} · NASA HRP Hostile Closed Environments`,
  },
  PROTO_HYPOTENSION: {
    protocolId: 'PROTO_HYPOTENSION',
    title: 'Critical Hypotension (Systolic < 90 mmHg)',
    recheckIn: '5 min',
    steps: [
      'Place crewmember supine (or elevate legs if in partial/1-G) to restore cerebral perfusion.',
      'Check airway, responsiveness, and signs of allergic reaction or bleeding.',
      'Start oral electrolyte/fluid loading if conscious (or prepare IV pack per CMO kit).',
      'Suspend any EVA or strenuous tasks and monitor BP + HR every 5 min.',
    ],
    escalateIf: 'Syncope, chest pain, or BP stays < 90 mmHg after positioning and fluids.',
    reference: `${ISS_CMO_ABCDE} · ${NASA_STD_3001_V2}`,
  },
  PROTO_HYPERTENSIVE_CRISIS: {
    protocolId: 'PROTO_HYPERTENSIVE_CRISIS',
    title: 'Hypertensive Crisis (≥ 140/90 mmHg)',
    recheckIn: '10 min',
    steps: [
      'Pause physical exertion immediately and rest seated/neutral for 5 min.',
      'Repeat blood pressure measurement on the opposite arm to confirm.',
      'Screen for headache, blurred vision, chest pain, or neurological deficit.',
    ],
    escalateIf: 'BP remains ≥ 140/90 mmHg on repeat check or any neuro/chest symptom is present.',
    reference: `${NASA_HRP_COUNTERMEASURES} · ${NASA_STD_3001_V2}`,
  },
  PROTO_BLOOD_PRESSURE_BORDERLINE: {
    protocolId: 'PROTO_BLOOD_PRESSURE_BORDERLINE',
    title: 'Borderline Blood Pressure',
    recheckIn: '2 h',
    steps: [
      'Rest quietly for 5 minutes without caffeine or exercise before re-checking.',
      'Complete 500 mL hydration and avoid sudden posture changes.',
      'Log any headache, dizziness, or post-EVA orthostatic symptoms.',
    ],
    escalateIf: 'Systolic rises ≥ 140 mmHg, drops < 90 mmHg, or dizziness worsens.',
    reference: NASA_HRP_COUNTERMEASURES,
  },
  PROTO_TACHYCARDIA: {
    protocolId: 'PROTO_TACHYCARDIA',
    title: 'Critical Tachycardia (HR > 100 bpm)',
    recheckIn: '5 min',
    steps: [
      'Stop exertion immediately and place crewmember at rest.',
      'Cross-check BP, SpO₂, and temperature to rule out shock, hypoxia, or fever.',
      'Administer oral hydration if alert and without chest pain.',
    ],
    escalateIf: 'Resting HR stays > 100 bpm after 10 min rest, or chest pain/syncope occurs.',
    reference: `${ISS_CMO_ABCDE} · ${NASA_STD_3001_V2}`,
  },
  PROTO_BRADYCARDIA: {
    protocolId: 'PROTO_BRADYCARDIA',
    title: 'Critical Bradycardia (HR < 40 bpm)',
    recheckIn: '5 min',
    steps: [
      'Assess responsiveness, dizziness, or near-fainting immediately.',
      'Verify pulse manually (radial/carotid) and cross-check blood pressure.',
      'Keep crewmember horizontal/secured and suspend solo operations.',
    ],
    escalateIf: 'Dizziness, hypotension, or HR remains < 40 bpm on manual verification.',
    reference: `${ISS_CMO_ABCDE} · ${NASA_STD_3001_V2}`,
  },
  PROTO_HEART_RATE_MONITOR: {
    protocolId: 'PROTO_HEART_RATE_MONITOR',
    title: 'Heart Rate Outside Nominal Band',
    recheckIn: '30 min',
    steps: [
      'Verify reading after 5 minutes of seated/resting baseline.',
      'Check hydration intake and recent EVA or ARED/T2 exercise timing.',
      'Repeat measurement and log any palpitations or lightheadedness.',
    ],
    escalateIf: 'HR crosses < 40 or > 100 bpm or symptoms develop.',
    reference: NASA_HRP_COUNTERMEASURES,
  },
  PROTO_HYPOGLYCEMIA: {
    protocolId: 'PROTO_HYPOGLYCEMIA',
    title: 'Critical Hypoglycemia (< 70 mg/dL)',
    recheckIn: '15 min',
    steps: [
      'Check consciousness and ability to swallow safely.',
      'If alert: give 15–20 g fast-acting carbohydrates (glucose gel/juice from ration kit).',
      'If unable to swallow safely: do NOT give oral fluids; notify CMO/Flight Surgeon for IV dextrose.',
      'Recheck blood glucose in 15 minutes and repeat carb dose if still < 70 mg/dL.',
    ],
    escalateIf: 'Confusion, seizure, unresponsiveness, or glucose stays < 70 mg/dL after 15 min.',
    reference: `${ISS_CMO_ABCDE} · ${NASA_STD_3001_V2}`,
  },
  PROTO_HYPERGLYCEMIA: {
    protocolId: 'PROTO_HYPERGLYCEMIA',
    title: 'Critical Hyperglycemia (> 180 mg/dL)',
    recheckIn: '1 h',
    steps: [
      'Confirm reading with a clean fingerstick and check time since last meal.',
      'Encourage water/electrolyte hydration if conscious and not nauseated.',
      'Monitor temperature and alertness for signs of infection or metabolic stress.',
    ],
    escalateIf: 'Vomiting, rapid breathing, confusion, or glucose remains > 180 mg/dL.',
    reference: `${NASA_HRP_COUNTERMEASURES} · ${NASA_STD_3001_V2}`,
  },
  PROTO_GLUCOSE_ELEVATED: {
    protocolId: 'PROTO_GLUCOSE_ELEVATED',
    title: 'Elevated Blood Glucose (141–180 mg/dL)',
    recheckIn: '2 h',
    steps: [
      'Note whether reading was fasting or post-meal in the log observations.',
      'Prioritize water intake and balanced low-glycemic ration on next meal.',
      'Recheck glucose in 2 hours.',
    ],
    escalateIf: 'Glucose exceeds 180 mg/dL or excessive thirst/fatigue appears.',
    reference: NASA_HRP_COUNTERMEASURES,
  },
  PROTO_HYPOTHERMIA: {
    protocolId: 'PROTO_HYPOTHERMIA',
    title: 'Critical Hypothermia (< 35.5 °C)',
    recheckIn: '15 min',
    steps: [
      'Move crewmember out of cold suit/airlock into a warm, dry cabin zone.',
      'Remove damp layers and apply thermal blankets / active warming.',
      'Check suit/habitat thermal loop and provide warm fluids if fully alert.',
    ],
    escalateIf: 'Shivering stops, confusion/lethargy appears, or temp fails to rise.',
    reference: `${ISS_CMO_ABCDE} · ${NASA_STD_3001_V2}`,
  },
  PROTO_MILD_HYPOTHERMIA: {
    protocolId: 'PROTO_MILD_HYPOTHERMIA',
    title: 'Mild Hypothermia (35.5–36.0 °C)',
    recheckIn: '30 min',
    steps: [
      'Confirm core temperature with a repeat oral/tympanic reading.',
      'Add thermal insulation layer and check cabin/suit thermal regulation.',
      'Provide warm hydration and recheck in 30 minutes.',
    ],
    escalateIf: 'Temperature drops below 35.5 °C or shivering worsens.',
    reference: NASA_HRP_COUNTERMEASURES,
  },
  PROTO_FEVER: {
    protocolId: 'PROTO_FEVER',
    title: 'High Fever (> 38.0 °C)',
    recheckIn: '1 h',
    steps: [
      'Isolate/mask if infectious symptoms are present to protect closed-cabin crew.',
      'Cross-check NOAA solar storm status and acute radiation symptoms (nausea/fatigue).',
      'Increase oral hydration and log temperature every hour.',
    ],
    escalateIf: 'Temp stays > 38.0 °C, breathing difficulty appears, or mental status changes.',
    reference: `${NASA_HRP_COUNTERMEASURES} · NASA HRP Immune & Radiation Risks`,
  },
  PROTO_SUBFEBRILE: {
    protocolId: 'PROTO_SUBFEBRILE',
    title: 'Subfebrile Temperature (37.6–38.0 °C)',
    recheckIn: '2 h',
    steps: [
      'Confirm temperature after 15 minutes of rest.',
      'Check hydration, recent intense exercise, and any sore throat or fatigue.',
      'Monitor for upward trend over the next 2 hours.',
    ],
    escalateIf: 'Temperature rises above 38.0 °C or chills/cough develop.',
    reference: NASA_HRP_COUNTERMEASURES,
  },
  PROTO_SLEEP_DEPRIVATION: {
    protocolId: 'PROTO_SLEEP_DEPRIVATION',
    title: 'Severe Sleep Deprivation (< 6 h)',
    recheckIn: 'Next shift',
    steps: [
      'Defer safety-critical EVA, robotics, or precision docking/EDL tasks if possible.',
      'Schedule an immediate protected recovery sleep block and dim cabin blue light.',
      'Have a rested buddy double-check any required operational checklists.',
    ],
    escalateIf: 'Micro-sleeps, errors, or cognitive impairment occur during duty.',
    reference: 'NASA HRP Risk of Performance Decrements Due to Inadequate Sleep',
  },
  PROTO_SLEEP_INSUFFICIENT: {
    protocolId: 'PROTO_SLEEP_INSUFFICIENT',
    title: 'Insufficient Sleep (6–6.9 h)',
    recheckIn: '24 h',
    steps: [
      'Apply solid-state circadian lighting schedule (bright morning, dim pre-sleep).',
      'Avoid caffeine within 6 hours of scheduled sleep window.',
      'Aim for ≥ 7 hours on the next rest cycle.',
    ],
    escalateIf: 'Sleep drops < 6 h for two consecutive cycles.',
    reference: 'NASA-STD-3001 Vol. 1 · NASA HRP Circadian Alignment',
  },
  PROTO_PSYCHOSOCIAL_DISTRESS: {
    protocolId: 'PROTO_PSYCHOSOCIAL_DISTRESS',
    title: 'Psychosocial Distress (Mood ≤ 2/5)',
    recheckIn: '4 h',
    steps: [
      'Initiate a private, supportive crew check-in without judgment.',
      'Reduce non-essential workload and verify sleep + nutrition status.',
      'Enable asynchronous family/Earth support message or behavioral health audio.',
    ],
    escalateIf: 'Severe withdrawal, panic, or safety concern — notify Flight Surgeon immediately.',
    reference: 'NASA HRP Behavioral Health & Performance (BHP)',
  },
  PROTO_MOOD_SUPPORT: {
    protocolId: 'PROTO_MOOD_SUPPORT',
    title: 'Behavioral & Mood Support (Mood 3/5)',
    recheckIn: '24 h',
    steps: [
      'Schedule brief crew social/recreation time or Earth family link.',
      'Confirm regular aerobic/resistive exercise and circadian light exposure.',
    ],
    escalateIf: 'Mood drops to ≤ 2/5 or persists across multiple days.',
    reference: 'NASA HRP Behavioral Health & Performance (BHP)',
  },
};

/**
 * Resolves deduplicated guided protocols for active alerts, ordered with
 * `CRITICAL` alerts first so the crew sees life-safety actions at the top.
 */
export function getMedicalProtocolsForAlerts(alerts: HealthAlert[]): MedicalProtocolGuide[] {
  const ordered = [...alerts].sort((a, b) =>
    a.level === b.level ? 0 : a.level === 'CRITICAL' ? -1 : 1
  );
  const seen = new Set<string>();
  const guides: MedicalProtocolGuide[] = [];

  for (const alert of ordered) {
    if (!alert.protocolId || seen.has(alert.protocolId)) continue;
    const guide = MEDICAL_PROTOCOLS[alert.protocolId];
    if (!guide) continue;
    seen.add(alert.protocolId);
    guides.push(guide);
  }

  return guides;
}
