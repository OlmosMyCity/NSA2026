import { CircleCheck, CircleHelp, CircleSlash, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { IndicatorId } from '@/domain/health/types';
import type {
  CrewVitals,
  OperatorCrewStatus,
  OperatorReadinessReason,
  ReadinessVerdict,
} from './types';

/** Textos y colores compartidos por la lista y la ficha del operador. */

export const STATUS_META: Record<OperatorCrewStatus, { label: string; color: string; border: string }> = {
  CRITICAL: { label: 'Critical', color: 'var(--status-critical)', border: 'var(--status-critical-border)' },
  WARNING: { label: 'Watch', color: 'var(--status-caution)', border: 'var(--status-caution-border)' },
  OK: { label: 'Nominal', color: 'var(--status-nominal)', border: 'var(--border-subtle)' },
  NO_DATA: { label: 'No current data', color: 'var(--color-stem)', border: 'var(--border-subtle)' },
};

export const VERDICT_META: Record<ReadinessVerdict, { label: string; color: string; Icon: LucideIcon }> = {
  FIT: { label: 'Fit', color: 'var(--status-nominal)', Icon: CircleCheck },
  FIT_WITH_CAUTION: { label: 'Fit with caution', color: 'var(--status-caution)', Icon: TriangleAlert },
  NOT_FIT: { label: 'Not fit', color: 'var(--status-critical)', Icon: CircleSlash },
  NO_DATA: { label: 'Unknown', color: 'var(--color-stem)', Icon: CircleHelp },
};

export const REASON_TEXT: Record<OperatorReadinessReason, string> = {
  ALL_NOMINAL: 'All zones nominal',
  RECOVERY_WATCH: 'Sleep or musculoskeletal indicators on watch',
  VITAL_WATCH: 'Heart, blood or neuro indicators on watch',
  CRITICAL_FINDING: 'Critical finding in at least one zone',
  READING_EXPIRED: 'Reading expired · awaiting a new measurement',
  NO_READINGS: 'No readings on record',
  PROTECTIVE_SHELTER: 'Always available · protective measure',
};

/** Orden de los valores clínicos y a qué indicador corresponde cada campo. */
export const VITAL_FIELDS: { field: keyof CrewVitals; indicator: IndicatorId; short: string }[] = [
  { field: 'heartRateBpm', indicator: 'heartRate', short: 'HR' },
  { field: 'systolicMmHg', indicator: 'systolic', short: 'Systolic' },
  { field: 'diastolicMmHg', indicator: 'diastolic', short: 'Diastolic' },
  { field: 'spo2Pct', indicator: 'spo2', short: 'SpO₂' },
  { field: 'temperatureC', indicator: 'temperature', short: 'Temp' },
  { field: 'glucoseMgDl', indicator: 'glucose', short: 'Glucose' },
  { field: 'sleepHours', indicator: 'sleepHours', short: 'Sleep' },
  { field: 'mood', indicator: 'mood', short: 'Mood' },
];

export function timeAgo(iso: string, nowMs: number): string {
  const minutes = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
