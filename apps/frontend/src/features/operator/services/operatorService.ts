import { ENV } from '@/features/common/config/env';
import { httpClient } from '@/features/common/services/httpClient';
import { mockDb } from '@/features/common/mocks/mockDb';
import { authStorage } from '@/features/common/services/storage';
import { toIndicatorReadings, type ApiHealthReading } from '@/features/health/domain/api-adapter';
import { evaluateFreshness } from '@/features/health/domain/freshness';
import { summarizeZones } from '@/features/health/domain/summary';
import type { BodyZoneId, HealthStatus } from '@/features/health/domain/types';
import { evaluateOperatorReadiness } from '../domain/readiness';
import type { CrewLocation, OperatorCrewMember, OperatorCrewOverview, OperatorCrewStatus } from '../domain/types';

const STATUS_PRIORITY: Record<OperatorCrewStatus, number> = { CRITICAL: 0, WARNING: 1, NO_DATA: 2, OK: 3 };

function buildMockOverview(): OperatorCrewOverview {
  const now = Date.now();

  // Igual que el backend: solo la tripulación de las misiones asignadas a este operador.
  const operatorId = authStorage.getUser()?.id;
  const ownMissionIds = new Set(
    mockDb.missions.filter((m) => !m.deletedAt && m.operatorId === operatorId).map((m) => m.id)
  );

  const crew: OperatorCrewMember[] = mockDb.astronauts
    .filter((astro) => !astro.deletedAt && ownMissionIds.has(astro.missionId))
    .map((astro): OperatorCrewMember => {
      const mission = mockDb.missions.find((m) => m.id === astro.missionId);
      const latest = mockDb.readings
        .filter((r) => r.astronautId === astro.id && !r.deletedAt)
        .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt))[0];

      const freshness = evaluateFreshness(latest?.takenAt, now);
      const isFresh = freshness.phase === 'fresh' || freshness.phase === 'expiring';
      const zones = summarizeZones(latest ? toIndicatorReadings(latest as ApiHealthReading) : [], now);
      const zoneStatus = Object.fromEntries(
        Object.values(zones).map((z) => [z.zone, z.status])
      ) as Record<BodyZoneId, HealthStatus>;

      return {
        astronautId: astro.id,
        name: astro.name,
        crewRole: astro.role,
        photoUrl: astro.photoUrl ?? null,
        missionId: astro.missionId,
        missionName: mission?.name ?? 'Unassigned mission',
        status: latest && isFresh ? latest.status : 'NO_DATA',
        location: (astro.currentLocation as CrewLocation | undefined) ?? null,
        locationUpdatedAt: astro.locationUpdatedAt ?? null,
        lastReadingAt: latest?.takenAt ?? null,
        expiresAt: freshness.expiresAt ? new Date(freshness.expiresAt).toISOString() : null,
        isFresh,
        readiness: evaluateOperatorReadiness({ zoneStatus, isFresh, hasReadings: !!latest }),
      };
    })
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);

  return { crew, serverTime: new Date(now).toISOString(), freshnessWindowMin: ENV.FRESHNESS_WINDOW_MIN };
}

class OperatorService {
  async getCrewOverview(): Promise<OperatorCrewOverview> {
    if (ENV.USE_MOCKS) return buildMockOverview();
    return httpClient.get<OperatorCrewOverview>('/operator/crew');
  }
}

export const operatorService = new OperatorService();
