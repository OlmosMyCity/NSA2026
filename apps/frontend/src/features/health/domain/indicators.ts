import type { BodyZoneId, IndicatorDefinition, IndicatorId } from './types';

/**
 * Catálogo de indicadores con umbrales orientativos para la demo (no son criterio clínico).
 * Los tramos son copia exacta de HEALTH_BANDS en
 * apps/backend/src/application/health/evaluateReading.ts; el test
 * apps/backend/tests/unit/healthRulesParity.test.ts falla si divergen.
 *
 * `resistanceExercise` no está en HEALTH_BANDS (el backend no lo persiste); su tramo
 * coincide con el del gemelo digital (apps/backend/src/application/health/digitalTwin.ts).
 */
export const INDICATORS: Record<IndicatorId, IndicatorDefinition> = {
  heartRate: {
    id: 'heartRate',
    label: 'Heart Rate (resting)',
    unit: 'bpm',
    zone: 'heart',
    hazards: ['gravity'],
    segments: [{ status: 'red', lt: 40 }, { status: 'amber', lt: 50 }, { status: 'green', lte: 90 }, { status: 'amber', lte: 100 }, { status: 'red' }],
    input: { min: 20, max: 220, step: 1 },
  },
  systolic: {
    id: 'systolic',
    label: 'Systolic Blood Pressure',
    unit: 'mmHg',
    zone: 'heart',
    hazards: ['gravity'],
    segments: [{ status: 'red', lt: 90 }, { status: 'green', lt: 130 }, { status: 'amber', lt: 140 }, { status: 'red' }],
    input: { min: 60, max: 250, step: 1 },
  },
  diastolic: {
    id: 'diastolic',
    label: 'Diastolic Blood Pressure',
    unit: 'mmHg',
    zone: 'heart',
    hazards: ['gravity'],
    segments: [{ status: 'green', lt: 85 }, { status: 'amber', lt: 90 }, { status: 'red' }],
    input: { min: 30, max: 150, step: 1 },
  },
  glucose: {
    id: 'glucose',
    label: 'Blood Glucose',
    unit: 'mg/dL',
    zone: 'blood',
    hazards: ['distance', 'hostileEnvironment'],
    segments: [{ status: 'red', lt: 70 }, { status: 'green', lte: 140 }, { status: 'amber', lte: 180 }, { status: 'red' }],
    input: { min: 20, max: 600, step: 1 },
  },
  temperature: {
    id: 'temperature',
    label: 'Body Temperature',
    unit: '°C',
    zone: 'blood',
    hazards: ['radiation', 'hostileEnvironment'],
    segments: [{ status: 'red', lt: 35.5 }, { status: 'amber', lt: 36.1 }, { status: 'green', lte: 37.5 }, { status: 'amber', lte: 38 }, { status: 'red' }],
    input: { min: 30, max: 43, step: 0.1 },
  },
  spo2: {
    id: 'spo2',
    label: 'O₂ Saturation (SpO₂)',
    unit: '%',
    zone: 'blood',
    hazards: ['hostileEnvironment'],
    segments: [{ status: 'red', lt: 92 }, { status: 'amber', lt: 95 }, { status: 'green' }],
    input: { min: 50, max: 100, step: 1 },
  },
  sleepHours: {
    id: 'sleepHours',
    label: 'Sleep Duration',
    unit: 'h/day',
    zone: 'sleep',
    hazards: ['isolation'],
    segments: [{ status: 'red', lt: 6 }, { status: 'amber', lt: 7 }, { status: 'green' }],
    input: { min: 0, max: 24, step: 0.1 },
  },
  mood: {
    id: 'mood',
    label: 'Mood',
    unit: '1–5',
    zone: 'brain',
    hazards: ['isolation', 'distance'],
    segments: [{ status: 'red', lte: 2 }, { status: 'amber', lt: 4 }, { status: 'green' }],
    input: { min: 1, max: 5, step: 1 },
  },
  resistanceExercise: {
    id: 'resistanceExercise',
    label: 'Resistance Exercise',
    unit: 'min/day',
    zone: 'bones',
    hazards: ['gravity'],
    segments: [{ status: 'red', lt: 30 }, { status: 'amber', lt: 60 }, { status: 'green' }],
    input: { min: 0, max: 180, step: 5 },
  },
};

export const INDICATOR_IDS = Object.keys(INDICATORS) as IndicatorId[];

/** Indicadores agrupados por zona de la figura humana. */
export const INDICATORS_BY_ZONE: Record<BodyZoneId, IndicatorId[]> = {
  heart: [],
  brain: [],
  blood: [],
  bones: [],
  sleep: [],
};
for (const def of Object.values(INDICATORS)) INDICATORS_BY_ZONE[def.zone].push(def.id);
