import type { HealthStatus, IndicatorId, IndicatorReading, ApiHealthStatus } from './types';

export interface ApiHealthAlert {
  indicator: string;
  level: 'WARNING' | 'CRITICAL';
  message: string;
  value: number;
}

/** Contrato de `HealthReading` del backend: una fila con todos los indicadores. */
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
  resistanceExerciseMin?: number | null;
  status: ApiHealthStatus;
  alerts: Array<ApiHealthAlert | string>;
  recommendation?: string | null;
  notes?: string | null;
  takenAt: string;
}

/** Campo del backend que corresponde a cada indicador del frontend. */
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

export const API_STATUS: Record<ApiHealthStatus, HealthStatus> = {
  OK: 'green',
  WARNING: 'amber',
  CRITICAL: 'red',
};

/** Aplana una fila del backend en una medición por indicador (omite valores ausentes). */
export function toIndicatorReadings(row: ApiHealthReading): IndicatorReading[] {
  return (Object.keys(API_FIELD) as IndicatorId[]).flatMap((indicator) => {
    const value = row[API_FIELD[indicator]];
    return typeof value === 'number'
      ? [{ id: `${row.id}:${indicator}`, astronautId: row.astronautId, indicator, value, takenAt: row.takenAt }]
      : [];
  });
}
