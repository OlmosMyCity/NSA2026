/**
 * Service layer for the Flight Surgeon administrative triage console.
 * Fetches prioritized crew clinical telemetry and dispatches medical directives
 * to either the in-memory mock store or the backend `/admin` endpoints.
 *
 * @module features/admin/services/adminTriageService
 */

import { ENV } from '@/features/common/config/env';
import { httpClient } from '@/features/common/services/httpClient';
import { mockDb } from '@/features/common/mocks/mockDb';
import { evaluateFreshness } from '@/features/health/domain/freshness';
import {
  ActiveRadiationIncidentSummary,
  CrewMemberTriage,
  FlightSurgeonMetrics,
  TriageStatus,
} from '../domain/types';

class AdminTriageService {
  /**
   * Returns crew members ordered by clinical severity (CRITICAL -> WARNING -> OK),
   * aggregate fleet triage counts, and any active solar radiation incident context.
   */
  async getTriageOverview(): Promise<{
    crew: CrewMemberTriage[];
    metrics: FlightSurgeonMetrics;
    stormScale?: string;
    activeRadiationIncident?: ActiveRadiationIncidentSummary | null;
  }> {
    if (ENV.USE_MOCKS) {
      const astronauts = mockDb.astronauts;
      const readings = mockDb.readings;
      const missions = mockDb.missions;

      const crew: CrewMemberTriage[] = astronauts.map((astro) => {
        const mission = missions.find((m) => m.id === astro.missionId);
        const astroReadings = readings
          .filter((r) => r.astronautId === astro.id && !r.deletedAt)
          .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());

        const latest = astroReadings[0];
        const freshness = evaluateFreshness(latest?.takenAt, Date.now());

        return {
          astronautId: astro.id,
          astronautName: astro.name,
          missionId: astro.missionId,
          missionName: mission ? mission.name : 'Unassigned mission',
          role: astro.role,
          environment: mission ? mission.environment : null,
          status: (latest ? latest.status : 'NO_DATA') as TriageStatus,
          heartRate: latest ? latest.heartRateBpm : null,
          bloodPressure: latest ? `${latest.systolicMmHg}/${latest.diastolicMmHg}` : null,
          spo2: latest ? latest.spo2Pct : null,
          glucose: latest ? latest.glucoseMgDl : null,
          temperature: latest ? latest.temperatureC : null,
          sleepHours: latest ? latest.sleepHours : null,
          mood: latest ? latest.mood : null,
          alerts: latest ? latest.alerts : [],
          recommendation: latest ? latest.recommendation : null,
          lastReadingAt: latest ? latest.takenAt : null,
          isFresh: freshness.phase === 'fresh' || freshness.phase === 'expiring',
          expiresAt: freshness.expiresAt ? new Date(freshness.expiresAt).toISOString() : null,
          photoUrl: astro.photoUrl,
        };
      });

      // Sort by triage severity: CRITICAL, WARNING, NO_DATA, then OK
      crew.sort((a, b) => {
        const score: Record<TriageStatus, number> = { CRITICAL: 4, WARNING: 3, NO_DATA: 2, OK: 1 };
        return score[b.status] - score[a.status];
      });

      const metrics: FlightSurgeonMetrics = {
        totalCrew: crew.length,
        criticalCount: crew.filter((c) => c.status === 'CRITICAL').length,
        warningCount: crew.filter((c) => c.status === 'WARNING').length,
        nominalCount: crew.filter((c) => c.status === 'OK').length,
        noDataCount: crew.filter((c) => c.status === 'NO_DATA').length,
      };

      return { crew, metrics };
    }

    return httpClient.get('/admin/triage');
  }

  /**
   * Transmits a Flight Surgeon medical directive or countermeasure order for an astronaut.
   * In mock mode, prepends the directive to the astronaut's most recent reading record.
   */
  async sendClinicalDirectives(
    astronautId: string,
    directives: string
  ): Promise<{ success: boolean; message: string }> {
    if (ENV.USE_MOCKS) {
      // Attach the medical directive to the astronaut's latest health reading
      const reading = mockDb.readings
        .filter((r) => r.astronautId === astronautId)
        .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];

      if (reading) {
        reading.recommendation = `[FLIGHT SURGEON]: ${directives}`;
        mockDb.save();
      }

      return {
        success: true,
        message: 'Countermeasure and clinical directive transmitted to capsule.',
      };
    }

    return httpClient.post(`/admin/astronauts/${astronautId}/directives`, { directives });
  }
}

export const adminTriageService = new AdminTriageService();
