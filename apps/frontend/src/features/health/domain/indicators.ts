/**
 * @module health/domain/indicators
 * Canonical catalog of the 9 monitored physiological and behavioral indicators,
 * mapping each metric to one of the 5 Digital Twin zones (`heart`, `brain`, `blood`,
 * `bones`, `sleep`), associated NASA HRP hazards, and deterministic threshold bands.
 */

import type { BodyZoneId, IndicatorDefinition, IndicatorId } from './types';

/**
 * Indicator catalog with mission-demo reference thresholds
 * (illustrative operational baselines, not clinical diagnostic criteria).
 * Source: `docs/NASA_SPACE_APPS_CHALLENGE.md` §2.
 */
export const INDICATORS: Record<IndicatorId, IndicatorDefinition> = {
  heartRate: {
    id: 'heartRate',
    label: 'Heart Rate (resting)',
    unit: 'bpm',
    zone: 'heart',
    hazards: ['gravity'],
    thresholds: { green: { min: 50, max: 90 }, amber: [{ min: 40, max: 49 }, { min: 91, max: 100 }] },
    input: { min: 20, max: 220, step: 1 },
  },
  systolic: {
    id: 'systolic',
    label: 'Systolic Blood Pressure',
    unit: 'mmHg',
    zone: 'heart',
    hazards: ['gravity'],
    thresholds: { green: { min: 90, max: 129 }, amber: [{ min: 130, max: 139 }] },
    input: { min: 60, max: 250, step: 1 },
  },
  diastolic: {
    id: 'diastolic',
    label: 'Diastolic Blood Pressure',
    unit: 'mmHg',
    zone: 'heart',
    hazards: ['gravity'],
    thresholds: { green: { max: 84 }, amber: [{ min: 85, max: 89 }] },
    input: { min: 30, max: 150, step: 1 },
  },
  glucose: {
    id: 'glucose',
    label: 'Blood Glucose',
    unit: 'mg/dL',
    zone: 'blood',
    hazards: ['distance', 'hostileEnvironment'],
    thresholds: { green: { min: 70, max: 140 }, amber: [{ min: 140.01, max: 180 }] },
    input: { min: 20, max: 600, step: 1 },
  },
  temperature: {
    id: 'temperature',
    label: 'Body Temperature',
    unit: '°C',
    zone: 'blood',
    hazards: ['radiation', 'hostileEnvironment'],
    thresholds: { green: { min: 36.1, max: 37.5 }, amber: [{ min: 35.5, max: 36.09 }, { min: 37.51, max: 38.0 }] },
    input: { min: 30, max: 43, step: 0.1 },
  },
  spo2: {
    id: 'spo2',
    label: 'O₂ Saturation (SpO₂)',
    unit: '%',
    zone: 'blood',
    hazards: ['hostileEnvironment'],
    thresholds: { green: { min: 95 }, amber: [{ min: 92, max: 94.99 }] },
    input: { min: 50, max: 100, step: 1 },
  },
  sleepHours: {
    id: 'sleepHours',
    label: 'Sleep Duration',
    unit: 'h/day',
    zone: 'sleep',
    hazards: ['isolation'],
    thresholds: { green: { min: 7 }, amber: [{ min: 6, max: 6.99 }] },
    input: { min: 0, max: 24, step: 0.5 },
  },
  mood: {
    id: 'mood',
    label: 'Mood',
    unit: '1–5',
    zone: 'brain',
    hazards: ['isolation', 'distance'],
    thresholds: { green: { min: 4, max: 5 }, amber: [{ min: 3, max: 3 }] },
    input: { min: 1, max: 5, step: 1 },
  },
  resistanceExercise: {
    id: 'resistanceExercise',
    label: 'Resistance Exercise',
    unit: 'min/day',
    zone: 'bones',
    hazards: ['gravity'],
    thresholds: { green: { min: 60 }, amber: [{ min: 30, max: 59.99 }] },
    input: { min: 0, max: 180, step: 5 },
  },
};

export const INDICATOR_IDS = Object.keys(INDICATORS) as IndicatorId[];

/** Indicator IDs grouped by their target 3D anatomical zone. */
export const INDICATORS_BY_ZONE: Record<BodyZoneId, IndicatorId[]> = {
  heart: [],
  brain: [],
  blood: [],
  bones: [],
  sleep: [],
};
for (const def of Object.values(INDICATORS)) INDICATORS_BY_ZONE[def.zone].push(def.id);
