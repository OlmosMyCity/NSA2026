import { HealthStatus } from "@prisma/client";
import { HealthAlert } from "../../application/health/evaluateReading.js";
import { PaginatedResult } from "./Mission.js";

export { PaginatedResult };

export interface HealthReadingFilters {
  page?: number;
  limit?: number;
  astronautId?: string;
  status?: HealthStatus;
  from?: Date;
  to?: Date;
}

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
}

export interface UpdateHealthReadingDTO {
  heartRateBpm?: number;
  systolicMmHg?: number;
  diastolicMmHg?: number;
  glucoseMgDl?: number;
  temperatureC?: number;
  spo2Pct?: number;
  sleepHours?: number;
  mood?: number;
  notes?: string | null;
  recommendation?: string | null;
  takenAt?: Date;
}

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
  deletedAt: Date | null;
}
