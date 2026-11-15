/**
 * @module entity/HealthReading
 * Domain DTOs, filters, and entity shapes for astronaut biomedical telemetry readings.
 */

import { HealthStatus } from "@prisma/client";
import { HealthAlert } from "../service/health/evaluateReading.js";
import { PaginatedResult } from "./Mission.js";

export { PaginatedResult };

/** Query filters for paginated health reading queries. */
export interface HealthReadingFilters {
  page?: number;
  limit?: number;
  astronautId?: string;
  status?: HealthStatus;
  from?: Date;
  to?: Date;
  /** Incluir lecturas invalidadas (auditoría). Por defecto solo las válidas. */
  includeInvalid?: boolean;
}

/**
 * Input payload for recording a biomedical health reading.
 * Units: `heartRateBpm` (bpm), `systolicMmHg`/`diastolicMmHg` (mmHg), `glucoseMgDl` (mg/dL),
 * `temperatureC` (°C), `spo2Pct` (%), `sleepHours` (hours), `mood` (1–5 scale).
 */
export interface CreateHealthReadingDTO {
  astronautId: string;
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  glucoseMgDl: number;
  temperatureC: number;
  spo2Pct: number;
  sleepHours: number;
  mood: number;
  notes?: string | null;
  takenAt?: Date;
  recordedById?: string | null;
}

/**
 * P1 — Los datos de salud solo se agregan.
 * Una lectura no se edita ni se borra: se invalida con un motivo, o se corrige
 * registrando una lectura nueva que la reemplaza (supersedesId).
 */
export interface InvalidateHealthReadingDTO {
  reason: string;
  invalidatedById: string | null;
}

export interface CorrectHealthReadingDTO extends Omit<CreateHealthReadingDTO, "astronautId"> {
  reason: string;
}

/** Datos ya evaluados que el repositorio persiste para una lectura nueva. */
export interface NewHealthReadingData {
  astronautId: string;
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  glucoseMgDl: number;
  temperatureC: number;
  spo2Pct: number;
  sleepHours: number;
  mood: number;
  status: HealthStatus;
  alerts: object;
  recommendation: string;
  notes?: string | null;
  takenAt?: Date;
  recordedById?: string | null;
}

/** Persisted biomedical reading including deterministic clinical status, alerts, and soft-delete metadata. */
export interface HealthReadingEntity {
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
  status: HealthStatus;
  alerts: HealthAlert[];
  recommendation: string | null;
  notes: string | null;
  takenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  /** @deprecated usar isValid */
  deletedAt: Date | null;
  isValid: boolean;
  invalidatedAt: Date | null;
  invalidatedReason: string | null;
  invalidatedById: string | null;
  recordedById?: string | null;
  supersedesId: string | null;
}
