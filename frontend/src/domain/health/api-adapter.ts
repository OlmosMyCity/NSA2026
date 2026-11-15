/**
 * @module domain/health/api-adapter
 * Translates wide backend `HealthReading` payloads into flattened per-indicator
 * telemetry points and frontend traffic-light status tokens.
 */

import type { HealthAlert, HealthStatus, IndicatorId, IndicatorReading, ApiHealthStatus } from './types';

export type ApiHealthAlert = HealthAlert;

/** Backend `HealthReading` contract: one wide row containing all vital-sign fields. */
export interface ApiHealthReading {
  id: string;
  astronautId: string;
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  glucoseMgDl: number;
  temperatureC: number;
  spo2Pct: number;
  sleepHours: number;
  mood: number;
  /** No lo persiste el backend; solo lo usan los escenarios What-If del gemelo digital. */
  resistanceExerciseMin?: number | null;
  status: ApiHealthStatus;
  alerts: ApiHealthAlert[];
  recommendation?: string | null;
  notes?: string | null;
  takenAt: string;
}

/** Maps each frontend `IndicatorId` to its corresponding field on `ApiHealthReading`. */
export const API_FIELD: Record<IndicatorId, keyof ApiHealthReading> = {
  heartRate: 'heartRateBpm',
  systolic: 'systolicMmHg',
  diastolic: 'diastolicMmHg',
  glucose: 'glucoseMgDl',
  temperature: 'temperatureC',
  spo2: 'spo2Pct',
  sleepHours: 'sleepHours',
  mood: 'mood',
  resistanceExercise: 'resistanceExerciseMin',
};

/** Maps backend `ApiHealthStatus` enum values to frontend traffic-light `HealthStatus` tokens. */
export const API_STATUS: Record<ApiHealthStatus, HealthStatus> = {
  OK: 'green',
  WARNING: 'amber',
  CRITICAL: 'red',
};

/** Flattens a wide backend reading row into per-indicator `IndicatorReading` items, omitting missing values. */
export function toIndicatorReadings(row: ApiHealthReading): IndicatorReading[] {
  return (Object.keys(API_FIELD) as IndicatorId[]).flatMap((indicator) => {
    const value = row[API_FIELD[indicator]];
    return typeof value === 'number'
      ? [{ id: `${row.id}:${indicator}`, astronautId: row.astronautId, indicator, value, takenAt: row.takenAt }]
      : [];
  });
}
