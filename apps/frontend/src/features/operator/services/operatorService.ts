import { ENV } from '@/features/common/config/env';
import { httpClient } from '@/features/common/services/httpClient';
import { mockDb, type MockAstronaut, type MockHealthReading } from '@/features/common/mocks/mockDb';
import { authStorage } from '@/features/common/services/storage';
import { toIndicatorReadings, type ApiHealthReading } from '@/features/health/domain/api-adapter';
import { evaluateFreshness } from '@/features/health/domain/freshness';
import { summarizeZones } from '@/features/health/domain/summary';
import type { BodyZoneId, HealthStatus } from '@/features/health/domain/types';
import { evaluateOperatorReadiness } from '../domain/readiness';
import type {
  CrewLocation,
  CrewVitals,
  OperatorCrewDetail,
  OperatorCrewMember,
  OperatorCrewOverview,
  OperatorCrewStatus,
} from '../domain/types';

const STATUS_PRIORITY: Record<OperatorCrewStatus, number> = { CRITICAL: 0, WARNING: 1, NO_DATA: 2, OK: 3 };
const DETAIL_READINGS = 30;

function toVitals(r: MockHealthReading): CrewVitals {
  return {
    heartRateBpm: r.heartRateBpm,
    systolicMmHg: r.systolicMmHg,
    diastolicMmHg: r.diastolicMmHg,
    spo2Pct: r.spo2Pct,
    temperatureC: r.temperatureC,
    glucoseMgDl: r.glucoseMgDl,
    sleepHours: r.sleepHours,
    mood: r.mood,
  };
}

/** Igual que el backend: solo la tripulación de las misiones asignadas a este operador. */
function ownCrew(): MockAstronaut[] {
  const operatorId = authStorage.getUser()?.id;
  const ownMissionIds = new Set(
    mockDb.missions.filter((m) => !m.deletedAt && m.operatorId === operatorId).map((m) => m.id)
  );
  return mockDb.astronauts.filter((astro) => !astro.deletedAt && ownMissionIds.has(astro.missionId));
}

function readingsOf(astronautId: string): MockHealthReading[] {
  return mockDb.readings
    .filter((r) => r.astronautId === astronautId && !r.deletedAt)
    .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt));
}

function buildMockMember(astro: MockAstronaut, now: number) {
  const mission = mockDb.missions.find((m) => m.id === astro.missionId);
  const readings = readingsOf(astro.id);
  const latest = readings[0];

  const freshness = evaluateFreshness(latest?.takenAt, now);
  const isFresh = freshness.phase === 'fresh' || freshness.phase === 'expiring';
  const flat = latest ? toIndicatorReadings(latest as ApiHealthReading) : [];
  // Aptitud: con vigencia (un dato vencido no da veredicto). Zonas de la ficha: según la última lectura.
  const currentZones = summarizeZones(flat, null, now);
  const lastZones = summarizeZones(flat);
  const zoneStatus = Object.fromEntries(
    Object.values(currentZones).map((z) => [z.zone, z.status])
  ) as Record<BodyZoneId, HealthStatus>;

  const member: OperatorCrewMember = {
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
    vitals: latest ? toVitals(latest) : null,
    readiness: evaluateOperatorReadiness({ zoneStatus, isFresh, hasReadings: !!latest }),
  };

  return { member, readings, latest, lastZones };
}

class OperatorService {
  async getCrewOverview(): Promise<OperatorCrewOverview> {
    if (!ENV.USE_MOCKS) return httpClient.get<OperatorCrewOverview>('/operator/crew');

    const now = Date.now();
    return {
      crew: ownCrew()
        .map((astro) => buildMockMember(astro, now).member)
        .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]),
      serverTime: new Date(now).toISOString(),
      freshnessWindowMin: ENV.FRESHNESS_WINDOW_MIN,
    };
  }

  /** Ficha individual. Un tripulante de otra misión responde como inexistente. */
  async getCrewMember(astronautId: string): Promise<OperatorCrewDetail> {
    if (!ENV.USE_MOCKS) return httpClient.get<OperatorCrewDetail>(`/operator/crew/${astronautId}`);

    const astro = ownCrew().find((a) => a.id === astronautId);
    if (!astro) throw new Error('Crew member not found.');

    const now = Date.now();
    const { member, readings, latest, lastZones } = buildMockMember(astro, now);
    return {
      ...member,
      lastReadingStatus: latest?.status ?? null,
      alerts: latest?.alerts ?? [],
      recommendation: latest?.recommendation ?? null,
      zones: Object.values(lastZones).map((z) => ({ zone: z.zone, status: z.status, trend: 'stable' as const })),
      latestDirective: null,
      history: readings.slice(0, DETAIL_READINGS).map((r) => ({
        id: r.id,
        takenAt: r.takenAt,
        status: r.status,
        ...toVitals(r),
      })),
      serverTime: new Date(now).toISOString(),
      freshnessWindowMin: ENV.FRESHNESS_WINDOW_MIN,
    };
  }
}

export const operatorService = new OperatorService();
