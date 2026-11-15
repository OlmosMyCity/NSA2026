/**
 * Service layer for the Flight Surgeon administrative triage console.
 * Fetches prioritized crew clinical telemetry and dispatches medical directives
 * to either the in-memory mock store or the backend `/admin` endpoints.
 *
 * @module services/adminTriageService
 */

import { ENV } from '@/config/env';
import { httpClient } from '@/services/httpClient';
import { mockDb } from '@/mocks/mockDb';
import {
  ActiveRadiationIncidentSummary,
  CrewMemberTriage,
  FlightSurgeonMetrics,
} from '../domain/admin/types';

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

        return {
          astronautId: astro.id,
          astronautName: astro.name,
          missionId: astro.missionId,
          missionName: mission ? mission.name : 'Crewed Spaceflight Mission',
          role: astro.role,
          environment: mission ? mission.environment : 'SPACECRAFT',
          status: (latest ? latest.status : 'OK') as 'CRITICAL' | 'WARNING' | 'OK',
          heartRate: latest ? latest.heartRateBpm : 70,
          bloodPressure: latest
            ? `${latest.systolicMmHg}/${latest.diastolicMmHg}`
            : '120/80',
          spo2: latest ? latest.spo2Pct : 98,
          glucose: latest ? latest.glucoseMgDl : 90,
          temperature: latest ? latest.temperatureC : 36.6,
          sleepHours: latest ? latest.sleepHours : 7.5,
          mood: latest ? latest.mood : 4,
          alerts: latest ? latest.alerts : [],
          recommendation: latest ? latest.recommendation : 'Parámetros biomédicos estables.',
          lastReadingAt: latest ? latest.takenAt : new Date().toISOString(),
          photoUrl: astro.photoUrl,
        };
      });

      // Sort by triage severity: CRITICAL first, then WARNING, then OK
      crew.sort((a, b) => {
        const score = { CRITICAL: 3, WARNING: 2, OK: 1 };
        return score[b.status] - score[a.status];
      });

      const metrics: FlightSurgeonMetrics = {
        totalCrew: crew.length,
        criticalCount: crew.filter((c) => c.status === 'CRITICAL').length,
        warningCount: crew.filter((c) => c.status === 'WARNING').length,
        nominalCount: crew.filter((c) => c.status === 'OK').length,
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
