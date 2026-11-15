import { HealthReading, HealthStatus } from "@prisma/client";
import {
  HealthReadingFilters,
  InvalidateHealthReadingDTO,
  NewHealthReadingData,
  PaginatedResult,
} from "../models/HealthReading.js";

export interface AstronautHealthSummary {
  astronautId: string;
  astronautName: string;
  missionName: string;
  currentStatus: HealthStatus;
  latestReading: HealthReading | null;
  systems: {
    cardiovascular: { status: HealthStatus; hr: number; bp: string };
    metabolic: { status: HealthStatus; glucose: number };
    respiratoryImmune: { status: HealthStatus; spo2: number; temp: number };
    sleepRecovery: { status: HealthStatus; avgSleepHours7d: number };
    behavioral: { status: HealthStatus; currentMood: number };
  };
  recentHistory7d: HealthReading[];
  astronaut?: {
    id: string;
    name: string;
    role: string;
    mission?: { id: string; name: string };
  };
  status?: HealthStatus;
  alertsSummary?: string[];
  totalReadingsCount?: number;
}

export interface IHealthReadingRepository {
  findMany(filters: HealthReadingFilters): Promise<PaginatedResult<HealthReading>>;
  findById(id: string): Promise<HealthReading | null>;
  create(data: NewHealthReadingData): Promise<HealthReading>;
  /** P1: marca la lectura como inválida (definitivo). No se borra ni se editan sus valores. */
  invalidate(id: string, data: InvalidateHealthReadingDTO): Promise<HealthReading>;
  /** P1: crea la lectura corregida e invalida la original en una sola transacción. */
  createCorrection(
    supersedesId: string,
    reading: NewHealthReadingData,
    invalidation: InvalidateHealthReadingDTO
  ): Promise<HealthReading>;
  getAstronautHealthSummary(astronautId: string): Promise<AstronautHealthSummary | null>;
}
