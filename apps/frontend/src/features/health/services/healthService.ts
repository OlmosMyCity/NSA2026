/**
 * @module health/services/healthService
 * Crew biomedical telemetry client supporting live REST endpoints and local
 * `mockDb` fallback mode (`ENV.USE_MOCKS`).
 */

import { ENV } from '@/features/common/config/env';
import { httpClient } from '@/features/common/services/httpClient';
import { mockDb, MockHealthReading } from '@/features/common/mocks/mockDb';
import {
  HealthReading,
  HealthReadingInput,
  EvaluationResult,
  AstronautHealthSummary,
  ApiHealthStatus,
} from '../domain/types';
import type { ApiHealthReading } from '../domain/api-adapter';
import { buildMockHistory } from '../mocks/healthHistory';

interface Paginated<T> {
  data: T[];
  pagination: { total: number; currentPage: number; limit: number; totalPages: number };
}

class HealthService {
  /**
   * Synchronously evaluates the 7 core physiological indicators against NASA HRP
   * thresholds for immediate client-side preview before submission.
   */
  evaluate(input: Omit<HealthReadingInput, 'astronautId'>): EvaluationResult {
    return mockDb.evaluateReading(input);
  }

  /** Persists a new biomedical reading (or appends to `mockDb` in mock mode). */
  async createReading(input: HealthReadingInput): Promise<HealthReading> {
    const evaluation = this.evaluate(input);

    if (ENV.USE_MOCKS) {
      const newReading: MockHealthReading = {
        id: `read-${Date.now()}`,
        astronautId: input.astronautId,
        heartRateBpm: input.heartRateBpm,
        systolicMmHg: input.systolicMmHg,
        diastolicMmHg: input.diastolicMmHg,
        glucoseMgDl: input.glucoseMgDl,
        temperatureC: input.temperatureC,
        spo2Pct: input.spo2Pct,
        sleepHours: input.sleepHours,
        mood: input.mood,
        status: evaluation.status,
        alerts: evaluation.alerts,
        recommendation: evaluation.recommendation,
        notes: input.notes || null,
        takenAt: input.takenAt || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDb.readings.unshift(newReading);
      mockDb.save();

      const astro = mockDb.astronauts.find((a) => a.id === input.astronautId);
      return {
        ...newReading,
        astronaut: astro ? { id: astro.id, name: astro.name, role: astro.role } : undefined,
      } as HealthReading;
    }

    return httpClient.post<HealthReading>('/readings', input);
  }

  /** Fetches readings for one astronaut sorted oldest-to-newest for trend charts and the digital twin. */
  async listReadingsForAstronaut(astronautId: string, limit = 100): Promise<ApiHealthReading[]> {
    if (ENV.USE_MOCKS) return buildMockHistory(astronautId);

    const res = await httpClient.get<Paginated<ApiHealthReading>>('/readings', {
      params: { astronautId, limit },
    });
    return [...res.data].sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
  }

  /**
   * Lists telemetry readings. Accepts either a direct `astronautId` (returns
   * chronological array) or filter/pagination parameters.
   */
  async listReadings(astronautId: string, limit?: number): Promise<ApiHealthReading[]>;
  async listReadings(params?: Record<string, string | number>): Promise<{
    data: HealthReading[];
    pagination: { total: number; currentPage: number; limit: number; totalPages: number };
  }>;
  async listReadings(
    paramOrAstronautId?: string | Record<string, string | number>,
    limit = 100
  ): Promise<any> {
    if (typeof paramOrAstronautId === 'string') {
      return this.listReadingsForAstronaut(paramOrAstronautId, limit);
    }

    const params = paramOrAstronautId;
    if (ENV.USE_MOCKS) {
      const page = Number(params?.page) || 1;
      const lim = Number(params?.limit) || 10;
      let filtered = [...mockDb.readings];

      if (params?.astronautId) {
        filtered = filtered.filter((r) => r.astronautId === params.astronautId);
      }
      if (params?.status) {
        filtered = filtered.filter((r) => r.status === params.status);
      }

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / lim));
      const startIndex = (page - 1) * lim;
      const paginated = filtered.slice(startIndex, startIndex + lim);

      const data = paginated.map((r) => {
        const astro = mockDb.astronauts.find((a) => a.id === r.astronautId);
        return {
          ...r,
          astronaut: astro ? { id: astro.id, name: astro.name, role: astro.role } : undefined,
        };
      });

      return {
        data: data as HealthReading[],
        pagination: { total, currentPage: page, limit: lim, totalPages },
      };
    }

    return httpClient.get('/readings', { params });
  }

  /** Retrieves the astronaut's mission assignment, latest reading, and alert summary. */
  async getAstronautSummary(astronautId: string): Promise<AstronautHealthSummary> {
    if (ENV.USE_MOCKS) {
      const astro = mockDb.astronauts.find((a) => a.id === astronautId);
      if (!astro) throw new Error('Astronaut not found.');

      const astroReadings = mockDb.readings
        .filter((r) => r.astronautId === astronautId)
        .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());

      const latest = astroReadings[0] || null;
      const status: ApiHealthStatus = latest ? (latest.status as ApiHealthStatus) : 'OK';

      const mission = mockDb.missions.find((m) => m.id === astro.missionId);

      return {
        astronaut: {
          id: astro.id,
          name: astro.name,
          role: astro.role,
          mission: mission ? { id: mission.id, name: mission.name } : undefined,
        },
        latestReading: latest as HealthReading | null,
        status,
        alertsSummary: latest ? latest.alerts : [],
        totalReadingsCount: astroReadings.length,
      };
    }

    return httpClient.get<AstronautHealthSummary>(`/astronauts/${astronautId}/summary`);
  }
}

export const healthService = new HealthService();
