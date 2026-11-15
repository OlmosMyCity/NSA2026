import { CrewLocation, HealthReading } from "@prisma/client";
import { IOperatorCrewRepository, OperatorCrewRecord } from "../../../domain/repository/IOperatorCrewRepository.js";
import { NotFoundError } from "../../../domain/errors/AppError.js";
import { normalizeAlertMessages } from "../admin/GetTriageOverviewUseCase.js";
import {
  evaluateDigitalTwin,
  type DigitalTwinState,
  type TrendDirection,
  type ZoneHealthStatus,
} from "../../health/digitalTwin.js";
import { evaluateFreshness, resolveFreshnessWindowMs } from "../../health/freshness.js";
import { BODY_ZONES, type BodyZoneId } from "../../health/hazards.js";
import {
  evaluateAllDestinations,
  type Destination,
  type ReadinessReason,
  type ReadinessVerdict,
} from "../../health/readiness.js";

/**
 * Supervisión desde Tierra. El operador ve la información completa de la tripulación
 * de las misiones que tiene asignadas —estado, ubicación, aptitud y valores clínicos—
 * y nada de las demás: el alcance por misión se aplica en la consulta.
 */

export type OperatorCrewStatus = "CRITICAL" | "WARNING" | "OK" | "NO_DATA";

export type OperatorReadinessReason = ReadinessReason | "NO_READINGS";

export interface OperatorDestinationReadiness {
  destination: Destination;
  verdict: ReadinessVerdict;
  reasonCode: OperatorReadinessReason;
}

export interface CrewVitals {
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  spo2Pct: number;
  temperatureC: number;
  glucoseMgDl: number;
  sleepHours: number;
  mood: number;
}

export interface OperatorCrewMember {
  astronautId: string;
  name: string;
  crewRole: string;
  photoUrl: string | null;
  missionId: string;
  missionName: string;
  /** Estado actual: `NO_DATA` si no hay lectura o si los signos vivos vencieron. */
  status: OperatorCrewStatus;
  location: CrewLocation | null;
  locationUpdatedAt: string | null;
  lastReadingAt: string | null;
  expiresAt: string | null;
  isFresh: boolean;
  /** Valores de la última lectura. Si `isFresh` es `false` son históricos, no el estado actual. */
  vitals: CrewVitals | null;
  readiness: OperatorDestinationReadiness[];
}

export interface OperatorCrewOverview {
  crew: OperatorCrewMember[];
  serverTime: string;
  freshnessWindowMin: number;
}

export interface OperatorZoneSummary {
  zone: BodyZoneId;
  status: ZoneHealthStatus;
  trend: TrendDirection;
}

export interface OperatorReadingEntry extends CrewVitals {
  id: string;
  takenAt: string;
  status: Exclude<OperatorCrewStatus, "NO_DATA">;
}

export interface OperatorCrewDetail extends OperatorCrewMember {
  /** Estado que el triaje asignó a la última lectura, aunque ya haya vencido. */
  lastReadingStatus: Exclude<OperatorCrewStatus, "NO_DATA"> | null;
  alerts: string[];
  recommendation: string | null;
  /** Estado por zona según la última lectura (histórico si venció). */
  zones: OperatorZoneSummary[];
  latestDirective: { content: string; createdAt: string; acknowledgedAt: string | null } | null;
  /** De la más reciente a la más antigua. */
  history: OperatorReadingEntry[];
  serverTime: string;
  freshnessWindowMin: number;
}

const STATUS_PRIORITY: Record<OperatorCrewStatus, number> = {
  CRITICAL: 0,
  WARNING: 1,
  NO_DATA: 2,
  OK: 3,
};

function toVitals(reading: HealthReading): CrewVitals {
  return {
    heartRateBpm: reading.heartRateBpm,
    systolicMmHg: reading.systolicMmHg,
    diastolicMmHg: reading.diastolicMmHg,
    spo2Pct: reading.spo2Pct,
    temperatureC: reading.temperatureC,
    glucoseMgDl: reading.glucoseMgDl,
    sleepHours: reading.sleepHours,
    mood: reading.mood,
  };
}

function evaluateTwin(record: OperatorCrewRecord, now: Date): DigitalTwinState {
  return evaluateDigitalTwin({ readings: record.recentReadings, environment: record.environment, now });
}

function toOperatorCrewMember(record: OperatorCrewRecord, twin: DigitalTwinState, now: Date): OperatorCrewMember {
  const latest = record.recentReadings[0] ?? null;
  const freshness = evaluateFreshness(latest?.takenAt, now);
  const zoneStatus = Object.fromEntries(
    BODY_ZONES.map((zone) => [zone, twin.zones[zone].status])
  ) as Record<BodyZoneId, ZoneHealthStatus>;

  return {
    astronautId: record.astronautId,
    name: record.astronautName,
    crewRole: record.crewRole,
    photoUrl: record.photoUrl,
    missionId: record.missionId,
    missionName: record.missionName,
    // Un dato vencido nunca se presenta como estado actual.
    status: latest && freshness.isFresh ? latest.status : "NO_DATA",
    location: record.currentLocation,
    locationUpdatedAt: record.locationUpdatedAt?.toISOString() ?? null,
    lastReadingAt: latest ? latest.takenAt.toISOString() : null,
    expiresAt: freshness.expiresAt?.toISOString() ?? null,
    isFresh: freshness.isFresh,
    vitals: latest ? toVitals(latest) : null,
    readiness: evaluateAllDestinations({ zoneStatus, isFresh: freshness.isFresh }).map((r) => ({
      destination: r.destination,
      verdict: r.verdict,
      reasonCode: r.verdict === "NO_DATA" && !latest ? "NO_READINGS" : r.reasonCode,
    })),
  };
}

export class GetOperatorCrewOverviewUseCase {
  constructor(
    private readonly crewRepo: IOperatorCrewRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(operatorId: string): Promise<OperatorCrewOverview> {
    const now = this.now();
    const records = await this.crewRepo.listCrewForOperator(operatorId);

    return {
      crew: records
        .map((record) => toOperatorCrewMember(record, evaluateTwin(record, now), now))
        .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]),
      serverTime: now.toISOString(),
      freshnessWindowMin: resolveFreshnessWindowMs() / 60_000,
    };
  }
}

export class GetOperatorCrewMemberUseCase {
  constructor(
    private readonly crewRepo: IOperatorCrewRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(operatorId: string, astronautId: string): Promise<OperatorCrewDetail> {
    const now = this.now();
    const record = await this.crewRepo.findCrewMemberForOperator(operatorId, astronautId);
    // Un tripulante de otra misión responde igual que uno inexistente: no se revela que existe.
    if (!record) throw new NotFoundError("Astronauta", astronautId);

    const twin = evaluateTwin(record, now);
    const latest = record.recentReadings[0] ?? null;
    const directive = record.latestDirective;

    return {
      ...toOperatorCrewMember(record, twin, now),
      lastReadingStatus: latest?.status ?? null,
      alerts: latest ? normalizeAlertMessages(latest.alerts) : [],
      recommendation: latest?.recommendation ?? null,
      zones: BODY_ZONES.map((zone) => ({
        zone,
        status: twin.zones[zone].status,
        trend: twin.zones[zone].trend,
      })),
      latestDirective: directive
        ? {
            content: directive.content,
            createdAt: directive.createdAt.toISOString(),
            acknowledgedAt: directive.acknowledgedAt?.toISOString() ?? null,
          }
        : null,
      history: record.recentReadings.map((reading) => ({
        id: reading.id,
        takenAt: reading.takenAt.toISOString(),
        status: reading.status,
        ...toVitals(reading),
      })),
      serverTime: now.toISOString(),
      freshnessWindowMin: resolveFreshnessWindowMs() / 60_000,
    };
  }
}
