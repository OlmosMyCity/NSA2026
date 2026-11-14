import { HealthReading, HealthStatus } from "@prisma/client";
import {
  HealthReadingFilters,
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
  create(data: {
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
  }): Promise<HealthReading>;
  update(
    id: string,
    data: {
      heartRateBpm?: number;
      systolicMmHg?: number;
      diastolicMmHg?: number;
      glucoseMgDl?: number;
      temperatureC?: number;
      spo2Pct?: number;
      sleepHours?: number;
      mood?: number;
      status?: HealthStatus;
      alerts?: object;
      recommendation?: string | null;
      notes?: string | null;
      takenAt?: Date;
    }
  ): Promise<HealthReading | null>;
  softDelete(id: string): Promise<boolean>;
  getAstronautHealthSummary(astronautId: string): Promise<AstronautHealthSummary | null>;
}
