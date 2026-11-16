/**
 * @module domain/health/medicalProtocols
 * Step-by-step onboard action guides for each deterministic `protocolId` emitted
 * by `evaluateReading` / `evaluateVitals`. Each step includes plain-language
 * "how-to" instructions for dizzy or non-physician crewmates (NASA-STD-3001 Vol. 2)
 * plus targeted `recheckFields` for the bounded critical verification loop and
 * warning follow-up sticky reminders.
 */

import type { HealthAlert, IndicatorId, Vitals } from './types';

export interface ProtocolStep {
  action: string;
  howTo?: string;
}

export interface RecheckFieldSpec {
  indicator: IndicatorId;
  field: keyof Vitals;
}

export interface MedicalProtocolGuide {
  protocolId: string;
  title: string;
  recheckIn: string;
  steps: ProtocolStep[];
  recheckFields: RecheckFieldSpec[];
  escalateIf: string;
  reference: string;
}

const HOW_SPO2 =
  'Place a clean, warm finger inside the pulse oximeter and hold still for 30 s until the % stabilizes.';
const HOW_HR =
  'Use the pulse oximeter readout, or press two fingers lightly on the inner wrist for 30 s and multiply beats by 2.';
const HOW_BP =
  'Wrap cuff snugly on a bare upper arm at heart level, rest calmly without speaking, and start the auto-cuff.';
const HOW_TEMP =
  'Place thermometer probe under the tongue for 60 s (or use tympanic ear sensor). Avoid cold/hot drinks right before.';
const HOW_GLUCOSE =
  'Wash finger, prick the side of the fingertip with the glucometer lancet, and touch the test strip to the drop.';

const NASA_STD_3001_V2 = 'NASA-STD-3001 Vol. 2 (Non-Physician CMO Usability)';
const ISS_CMO_ABCDE = 'ISS Medical Checklist · ABCDE Triage & On-Orbit Medical Kit';
const NASA_HRP_COUNTERMEASURES = 'NASA-STD-3001 Vol. 1 & NASA HRP Countermeasures';

export const MEDICAL_PROTOCOLS: Record<string, MedicalProtocolGuide> = {
  PROTO_HYPOXIA: {
    protocolId: 'PROTO_HYPOXIA',
    title: 'Hypoxia Response (SpO₂ < 92%)',
    recheckIn: '5 min',
    steps: [
      {
        action: 'Check airway and breathing; seat or stabilize the crewmember.',
        howTo: 'Ensure mouth/nose are clear and breathing is effortless; loosen tight collar or helmet seal.',
      },
      {
        action: 'Check module cabin O₂ and CO₂ levels on the ECLSS panel.',
        howTo: 'Confirm cabin pressure is nominal and CO₂ scrubbers are running with no cabin alarm.',
      },
      {
        action: 'Administer supplemental oxygen from the On-Orbit Medical Kit.',
        howTo: 'Connect O₂ mask or nasal cannula from the Emergency Medical Pack and open regulator flow.',
      },
      {
        action: 'Re-measure SpO₂ on a warm finger and watch alertness.',
        howTo: HOW_SPO2,
      },
    ],
    recheckFields: [
      { indicator: 'spo2', field: 'spo2Pct' },
      { indicator: 'heartRate', field: 'heartRateBpm' },
    ],
    escalateIf:
      'SpO₂ stays < 92% on O₂ or confusion/bluish lips appear — move to clean-air module and alert Flight Surgeon.',
    reference: `${ISS_CMO_ABCDE} · ${NASA_STD_3001_V2}`,
  },
  PROTO_SPO2_BORDERLINE: {
    protocolId: 'PROTO_SPO2_BORDERLINE',
    title: 'Borderline SpO₂ Check (92–94%)',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Re-seat the pulse oximeter on a warm, clean finger.',
        howTo: HOW_SPO2,
      },
      {
        action: 'Verify cabin airflow and CO₂ scrubber status.',
        howTo: 'Check module ventilation fans are unobstructed and not blowing stale air.',
      },
      {
        action: 'Rest calmly and take slow, deep nasal breaths.',
        howTo: 'Inhale 4 s through nose, exhale 6 s slowly for 2–3 minutes before re-checking.',
      },
    ],
    recheckFields: [{ indicator: 'spo2', field: 'spo2Pct' }],
    escalateIf: 'SpO₂ drops below 92% or shortness of breath develops.',
    reference: `${ISS_CMO_ABCDE} · NASA HRP Hostile Closed Environments`,
  },
  PROTO_HYPOTENSION: {
    protocolId: 'PROTO_HYPOTENSION',
    title: 'Critical Hypotension (Systolic < 90 mmHg)',
    recheckIn: '5 min',
    steps: [
      {
        action: 'Lay crewmember flat (or elevate legs if under gravity) immediately.',
        howTo: 'Keep head level with heart to prevent fainting; secure them gently if in 0-G.',
      },
      {
        action: 'Check responsiveness and measure Heart Rate & Blood Pressure again.',
        howTo: `${HOW_BP} ${HOW_HR}`,
      },
      {
        action: 'Start oral electrolyte hydration if awake and able to swallow.',
        howTo: 'Give 250–500 mL electrolyte drink in small sips. Do NOT give fluids if drowsy or nauseated.',
      },
      {
        action: 'Suspend EVA/exertion and prepare IV pack if symptoms persist.',
        howTo: 'Locate the Gray IV Supply Pack in the Medical Kit in case Flight Surgeon orders IV fluids.',
      },
    ],
    recheckFields: [
      { indicator: 'systolic', field: 'systolicMmHg' },
      { indicator: 'diastolic', field: 'diastolicMmHg' },
      { indicator: 'heartRate', field: 'heartRateBpm' },
    ],
    escalateIf: 'Fainting, chest pain, or systolic stays < 90 mmHg after positioning and fluids.',
    reference: `${ISS_CMO_ABCDE} · ${NASA_STD_3001_V2}`,
  },
  PROTO_HYPERTENSIVE_CRISIS: {
    protocolId: 'PROTO_HYPERTENSIVE_CRISIS',
    title: 'Hypertensive Crisis (≥ 140/90 mmHg)',
    recheckIn: '10 min',
    steps: [
      {
        action: 'Stop all physical exertion and rest calmly for 5 minutes.',
        howTo: 'Have the crewmember sit or tether still in a quiet area with uncrossed legs.',
      },
      {
        action: 'Repeat Blood Pressure on the opposite arm to confirm.',
        howTo: HOW_BP,
      },
      {
        action: 'Ask about severe headache, blurred vision, or chest tightness.',
        howTo: 'If any neurological or chest symptom is present, treat as urgent and contact Flight Surgeon.',
      },
    ],
    recheckFields: [
      { indicator: 'systolic', field: 'systolicMmHg' },
      { indicator: 'diastolic', field: 'diastolicMmHg' },
    ],
    escalateIf: 'BP remains ≥ 140/90 mmHg on repeat check or any chest/vision symptom is present.',
    reference: `${NASA_HRP_COUNTERMEASURES} · ${NASA_STD_3001_V2}`,
  },
  PROTO_BLOOD_PRESSURE_BORDERLINE: {
    protocolId: 'PROTO_BLOOD_PRESSURE_BORDERLINE',
    title: 'Borderline Blood Pressure',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Rest quietly for 5 minutes without caffeine or exercise.',
        howTo: 'Sit or tether comfortably before taking a confirmatory cuff reading.',
      },
      {
        action: 'Drink 500 mL water/electrolytes and avoid sudden posture changes.',
      },
      {
        action: 'Re-check Blood Pressure and note any dizziness or headache.',
        howTo: HOW_BP,
      },
    ],
    recheckFields: [
      { indicator: 'systolic', field: 'systolicMmHg' },
      { indicator: 'diastolic', field: 'diastolicMmHg' },
    ],
    escalateIf: 'Systolic rises ≥ 140 mmHg, drops < 90 mmHg, or dizziness worsens.',
    reference: NASA_HRP_COUNTERMEASURES,
  },
  PROTO_TACHYCARDIA: {
    protocolId: 'PROTO_TACHYCARDIA',
    title: 'Critical Tachycardia (Resting HR > 100 bpm)',
    recheckIn: '5 min',
    steps: [
      {
        action: 'Stop physical activity and rest calmly for 5 minutes.',
        howTo: 'Remove heavy gear/restraints and keep breathing slow and steady.',
      },
      {
        action: 'Measure Heart Rate & SpO₂ (blood oxygen) with the pulse oximeter.',
        howTo: HOW_SPO2,
      },
      {
        action: 'Measure Body Temperature to rule out fever or infection.',
        howTo: HOW_TEMP,
      },
      {
        action: 'Give 250 mL oral water/electrolytes if alert and without chest pain.',
        howTo: 'Skip oral fluids if feeling nauseated, dizzy, or having chest discomfort.',
      },
    ],
    recheckFields: [
      { indicator: 'heartRate', field: 'heartRateBpm' },
      { indicator: 'spo2', field: 'spo2Pct' },
      { indicator: 'temperature', field: 'temperatureC' },
    ],
    escalateIf: 'Resting HR stays > 100 bpm after rest, or chest pain, SpO₂ < 92%, or fainting occurs.',
    reference: `${ISS_CMO_ABCDE} · ${NASA_STD_3001_V2}`,
  },
  PROTO_BRADYCARDIA: {
    protocolId: 'PROTO_BRADYCARDIA',
    title: 'Critical Bradycardia (HR < 40 bpm)',
    recheckIn: '5 min',
    steps: [
      {
        action: 'Check alertness, dizziness, or near-fainting immediately.',
        howTo: 'Ask the crewmember their name and location; keep them secured horizontally.',
      },
      {
        action: 'Confirm Heart Rate manually at the wrist and check Blood Pressure.',
        howTo: `${HOW_HR} ${HOW_BP}`,
      },
      {
        action: 'Suspend solo operations and keep a buddy nearby.',
      },
    ],
    recheckFields: [
      { indicator: 'heartRate', field: 'heartRateBpm' },
      { indicator: 'systolic', field: 'systolicMmHg' },
    ],
    escalateIf: 'Dizziness, systolic < 90 mmHg, or HR remains < 40 bpm on manual verification.',
    reference: `${ISS_CMO_ABCDE} · ${NASA_STD_3001_V2}`,
  },
  PROTO_HEART_RATE_MONITOR: {
    protocolId: 'PROTO_HEART_RATE_MONITOR',
    title: 'Heart Rate Outside Nominal Band',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Rest quietly for 5 minutes and repeat Heart Rate measurement.',
        howTo: HOW_HR,
      },
      {
        action: 'Check hydration intake and recent EVA or ARED/T2 exercise timing.',
      },
    ],
    recheckFields: [{ indicator: 'heartRate', field: 'heartRateBpm' }],
    escalateIf: 'HR crosses < 40 or > 100 bpm or dizziness/chest symptoms develop.',
    reference: NASA_HRP_COUNTERMEASURES,
  },
  PROTO_HYPOGLYCEMIA: {
    protocolId: 'PROTO_HYPOGLYCEMIA',
    title: 'Critical Hypoglycemia (< 70 mg/dL)',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Check consciousness and ability to swallow safely.',
        howTo: 'Ensure crewmember is awake and able to hold and drink safely before giving anything by mouth.',
      },
      {
        action: 'If awake: give 15–20 g fast-acting sugar (glucose gel/juice).',
        howTo: 'Use 1 glucose gel packet or ~150 mL fruit juice from the Medical/Ration Kit.',
      },
      {
        action: 'If drowsy or unable to swallow: give NO oral fluids; alert CMO for IV dextrose.',
      },
      {
        action: 'Re-check blood glucose after 15 minutes.',
        howTo: HOW_GLUCOSE,
      },
    ],
    recheckFields: [{ indicator: 'glucose', field: 'glucoseMgDl' }],
    escalateIf: 'Confusion, seizure, unresponsiveness, or glucose stays < 70 mg/dL after carb dose.',
    reference: `${ISS_CMO_ABCDE} · ${NASA_STD_3001_V2}`,
  },
  PROTO_HYPERGLYCEMIA: {
    protocolId: 'PROTO_HYPERGLYCEMIA',
    title: 'Critical Hyperglycemia (> 180 mg/dL)',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Confirm with a fresh clean fingerstick glucose reading.',
        howTo: HOW_GLUCOSE,
      },
      {
        action: 'Encourage plain water hydration if awake and not nauseated.',
      },
      {
        action: 'Check Body Temperature for possible infection or metabolic stress.',
        howTo: HOW_TEMP,
      },
    ],
    recheckFields: [
      { indicator: 'glucose', field: 'glucoseMgDl' },
      { indicator: 'temperature', field: 'temperatureC' },
    ],
    escalateIf: 'Vomiting, rapid breathing, confusion, or glucose remains > 180 mg/dL.',
    reference: `${NASA_HRP_COUNTERMEASURES} · ${NASA_STD_3001_V2}`,
  },
  PROTO_GLUCOSE_ELEVATED: {
    protocolId: 'PROTO_GLUCOSE_ELEVATED',
    title: 'Elevated Blood Glucose (141–180 mg/dL)',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Confirm whether this was fasting or right after a meal.',
      },
      {
        action: 'Drink plain water and choose low-sugar rations on next meal.',
      },
      {
        action: 'Re-check glucose with a clean fingerstick if unexpected.',
        howTo: HOW_GLUCOSE,
      },
    ],
    recheckFields: [{ indicator: 'glucose', field: 'glucoseMgDl' }],
    escalateIf: 'Glucose exceeds 180 mg/dL or excessive thirst/fatigue appears.',
    reference: NASA_HRP_COUNTERMEASURES,
  },
  PROTO_HYPOTHERMIA: {
    protocolId: 'PROTO_HYPOTHERMIA',
    title: 'Critical Hypothermia (< 35.5 °C)',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Move crewmember out of cold suit/airlock into a warm, dry cabin zone.',
      },
      {
        action: 'Remove damp layers and apply thermal blankets / active warming.',
      },
      {
        action: 'Re-check Body Temperature and Heart Rate after warming starts.',
        howTo: `${HOW_TEMP} ${HOW_HR}`,
      },
    ],
    recheckFields: [
      { indicator: 'temperature', field: 'temperatureC' },
      { indicator: 'heartRate', field: 'heartRateBpm' },
    ],
    escalateIf: 'Shivering stops, confusion/lethargy appears, or temp fails to rise above 35.5 °C.',
    reference: `${ISS_CMO_ABCDE} · ${NASA_STD_3001_V2}`,
  },
  PROTO_MILD_HYPOTHERMIA: {
    protocolId: 'PROTO_MILD_HYPOTHERMIA',
    title: 'Mild Hypothermia (35.5–36.0 °C)',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Add thermal layers and verify cabin/suit thermal loop settings.',
      },
      {
        action: 'Provide warm fluids and re-measure Body Temperature.',
        howTo: HOW_TEMP,
      },
    ],
    recheckFields: [{ indicator: 'temperature', field: 'temperatureC' }],
    escalateIf: 'Temperature drops below 35.5 °C or shivering worsens.',
    reference: NASA_HRP_COUNTERMEASURES,
  },
  PROTO_FEVER: {
    protocolId: 'PROTO_FEVER',
    title: 'High Fever (> 38.0 °C)',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Confirm Body Temperature and ask crewmember to wear a mask if respiratory symptoms exist.',
        howTo: HOW_TEMP,
      },
      {
        action: 'Check Heart Rate and SpO₂, and inspect active NOAA solar storm alerts.',
        howTo: HOW_SPO2,
      },
      {
        action: 'Increase oral hydration and administer authorized antipyretic per CMO kit.',
      },
    ],
    recheckFields: [
      { indicator: 'temperature', field: 'temperatureC' },
      { indicator: 'heartRate', field: 'heartRateBpm' },
      { indicator: 'spo2', field: 'spo2Pct' },
    ],
    escalateIf: 'Temp stays > 38.0 °C, breathing difficulty appears, or mental status changes.',
    reference: `${NASA_HRP_COUNTERMEASURES} · NASA HRP Immune & Radiation Risks`,
  },
  PROTO_SUBFEBRILE: {
    protocolId: 'PROTO_SUBFEBRILE',
    title: 'Subfebrile Temperature (37.6–38.0 °C)',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Rest 15 minutes (away from hot drinks/exercise) and confirm temperature.',
        howTo: HOW_TEMP,
      },
      {
        action: 'Increase oral hydration and log any sore throat, cough, or fatigue.',
      },
    ],
    recheckFields: [{ indicator: 'temperature', field: 'temperatureC' }],
    escalateIf: 'Temperature rises above 38.0 °C or chills/cough develop.',
    reference: NASA_HRP_COUNTERMEASURES,
  },
  PROTO_SLEEP_DEPRIVATION: {
    protocolId: 'PROTO_SLEEP_DEPRIVATION',
    title: 'Severe Sleep Deprivation (< 6 h)',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Stand down from safety-critical EVA, robotics, or precision docking/EDL tasks.',
      },
      {
        action: 'Have a rested buddy double-check any active operational checklists.',
      },
      {
        action: 'Schedule an immediate protected recovery sleep block and dim cabin blue light.',
      },
    ],
    recheckFields: [{ indicator: 'sleepHours', field: 'sleepHours' }],
    escalateIf: 'Micro-sleeps, errors, or cognitive impairment occur during duty.',
    reference: 'NASA HRP Risk of Performance Decrements Due to Inadequate Sleep',
  },
  PROTO_SLEEP_INSUFFICIENT: {
    protocolId: 'PROTO_SLEEP_INSUFFICIENT',
    title: 'Insufficient Sleep (6–6.9 h)',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Apply solid-state circadian lighting schedule (bright morning, dim pre-sleep).',
      },
      {
        action: 'Avoid caffeine within 6 hours of the next scheduled sleep window.',
      },
    ],
    recheckFields: [{ indicator: 'sleepHours', field: 'sleepHours' }],
    escalateIf: 'Sleep drops < 6 h for two consecutive cycles.',
    reference: 'NASA-STD-3001 Vol. 1 · NASA HRP Circadian Alignment',
  },
  PROTO_PSYCHOSOCIAL_DISTRESS: {
    protocolId: 'PROTO_PSYCHOSOCIAL_DISTRESS',
    title: 'Psychosocial Distress (Mood ≤ 2/5)',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Initiate a calm, private crew check-in without judgment.',
        howTo: 'Ask how they are coping and confirm sleep, hydration, and recent workload.',
      },
      {
        action: 'Reduce non-essential isolated tasks for the current shift.',
      },
      {
        action: 'Enable asynchronous family/Earth behavioral health support link.',
      },
    ],
    recheckFields: [{ indicator: 'mood', field: 'mood' }],
    escalateIf: 'Severe withdrawal, panic, or safety concern — notify Flight Surgeon immediately.',
    reference: 'NASA HRP Behavioral Health & Performance (BHP)',
  },
  PROTO_MOOD_SUPPORT: {
    protocolId: 'PROTO_MOOD_SUPPORT',
    title: 'Behavioral & Mood Support (Mood 3/5)',
    recheckIn: '15 min',
    steps: [
      {
        action: 'Schedule brief crew social/recreation time or Earth family link.',
      },
      {
        action: 'Confirm regular aerobic/resistive exercise and circadian light exposure.',
      },
    ],
    recheckFields: [{ indicator: 'mood', field: 'mood' }],
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

/** Collects deduplicated vital fields that must be re-measured across active protocols. */
export function getRecheckFieldsForProtocols(protocols: MedicalProtocolGuide[]): RecheckFieldSpec[] {
  const seen = new Set<keyof Vitals>();
  const fields: RecheckFieldSpec[] = [];
  for (const protocol of protocols) {
    for (const spec of protocol.recheckFields) {
      if (seen.has(spec.field)) continue;
      seen.add(spec.field);
      fields.push(spec);
    }
  }
  return fields;
}
