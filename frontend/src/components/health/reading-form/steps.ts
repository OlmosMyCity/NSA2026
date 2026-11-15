import { Activity, Moon, Thermometer, type LucideIcon } from 'lucide-react';
import type { IndicatorId, Vitals } from '../../../domain/health/types';

export interface VitalStep {
  label: string;
  icon: LucideIcon;
  protocolTitle: string;
  protocol: string;
  fields: Array<{ indicator: IndicatorId; field: keyof Vitals }>;
}

/** Pasos del asistente: cada campo se dibuja desde el catálogo INDICATORS. */
export const VITAL_STEPS: VitalStep[] = [
  {
    label: '1. Cardiovascular',
    icon: Activity,
    protocolTitle: 'Cardiovascular Protocol (Fluid Shift Risk)',
    protocol: 'Remain seated at rest for 5 minutes prior to measurement. Position the cuff on the left arm at heart level.',
    fields: [
      { indicator: 'heartRate', field: 'heartRateBpm' },
      { indicator: 'systolic', field: 'systolicMmHg' },
      { indicator: 'diastolic', field: 'diastolicMmHg' },
    ],
  },
  {
    label: '2. Metabolic',
    icon: Thermometer,
    protocolTitle: 'Metabolic & Thermal Protocol (Radiation & Immunity)',
    protocol:
      'Sanitize the fingertip before lancing. Body temperature is recorded via the helmet tympanic sensor or cabin infrared thermometer.',
    fields: [
      { indicator: 'glucose', field: 'glucoseMgDl' },
      { indicator: 'temperature', field: 'temperatureC' },
    ],
  },
  {
    label: '3. Life Support',
    icon: Moon,
    protocolTitle: 'Habitat & Behavioral Protocol (Isolation & Confinement)',
    protocol:
      'Place the pulse oximeter on your index finger. Enter actual hours slept in the past 24-hour cycle and rate your mood.',
    fields: [
      { indicator: 'spo2', field: 'spo2Pct' },
      { indicator: 'sleepHours', field: 'sleepHours' },
      { indicator: 'mood', field: 'mood' },
    ],
  },
];

export const ASSESSMENT_STEP_LABEL = '4. Assessment';

export const DEFAULT_VITALS: Vitals = {
  heartRateBpm: 72,
  systolicMmHg: 120,
  diastolicMmHg: 80,
  glucoseMgDl: 95,
  temperatureC: 36.6,
  spo2Pct: 98,
  sleepHours: 7.5,
  mood: 4,
};

export const MOOD_OPTIONS = [
  [5, 'Excellent (High motivation)'],
  [4, 'Good (Nominal focus)'],
  [3, 'Fair (Moderate fatigue)'],
  [2, 'Low (Mood decline)'],
  [1, 'Critical (Severe stress)'],
] as const;
