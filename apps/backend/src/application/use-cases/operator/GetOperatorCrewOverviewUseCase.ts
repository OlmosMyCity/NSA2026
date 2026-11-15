import { CrewLocation } from "@prisma/client";
import { IOperatorCrewRepository, OperatorCrewRecord } from "../../../domain/repository/IOperatorCrewRepository.js";
import { evaluateDigitalTwin, type ZoneHealthStatus } from "../../health/digitalTwin.js";
import { evaluateFreshness, resolveFreshnessWindowMs } from "../../health/freshness.js";
import { BODY_ZONES, type BodyZoneId } from "../../health/hazards.js";
import {
  evaluateAllDestinations,
  type Destination,
  type DestinationReadiness,
  type ReadinessVerdict,
} from "../../health/readiness.js";

export type OperatorCrewStatus = "CRITICAL" | "WARNING" | "OK" | "NO_DATA";

/** Motivo apto para el operador: explica el veredicto sin revelar qué hallazgo clínico lo causó. */
export type OperatorReadinessNote =
  | "CLEARED"
  | "MEDICAL_CAUTION"
  | "MEDICAL_HOLD"
  | "READING_EXPIRED"
  | "NO_READINGS"
  | "PROTECTIVE_SHELTER";

export interface OperatorDestinationReadiness {
  destination: Destination;
  verdict: ReadinessVerdict;
  note: OperatorReadinessNote;
}

/**
 * Lo único que ve el operador (mínimo necesario): estado, ubicación, aptitud y fecha.
 * Este tipo no tiene campos clínicos a propósito: ni valores, ni alertas, ni notas.
 */
export interface OperatorCrewMember {
  astronautId: string;
  name: string;
  crewRole: string;
  photoUrl: string | null;
  missionId: string;
  missionName: string;
  status: OperatorCrewStatus;
  location: CrewLocation | null;
  locationUpdatedAt: string | null;
  lastReadingAt: string | null;
  expiresAt: string | null;
  isFresh: boolean;
  readiness: OperatorDestinationReadiness[];
}

export interface OperatorCrewOverview {
  crew: OperatorCrewMember[];
  serverTime: string;
  freshnessWindowMin: number;
}

const STATUS_PRIORITY: Record<OperatorCrewStatus, number> = {
  CRITICAL: 0,
  WARNING: 1,
  NO_DATA: 2,
  OK: 3,
};

function toOperatorNote(readiness: DestinationReadiness, hasReadings: boolean): OperatorReadinessNote {
  if (readiness.reasonCode === "PROTECTIVE_SHELTER") return "PROTECTIVE_SHELTER";
  if (readiness.verdict === "NO_DATA") return hasReadings ? "READING_EXPIRED" : "NO_READINGS";
  if (readiness.verdict === "NOT_FIT") return "MEDICAL_HOLD";
  if (readiness.verdict === "FIT_WITH_CAUTION") return "MEDICAL_CAUTION";
  return "CLEARED";
}

function toOperatorCrewMember(record: OperatorCrewRecord, now: Date): OperatorCrewMember {
  const latest = record.recentReadings[0] ?? null;
  const freshness = evaluateFreshness(latest?.takenAt, now);

  const twin = evaluateDigitalTwin({
    readings: record.recentReadings,
    environment: record.environment,
    now,
  });
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
    readiness: evaluateAllDestinations({ zoneStatus, isFresh: freshness.isFresh }).map((r) => ({
      destination: r.destination,
      verdict: r.verdict,
      note: toOperatorNote(r, latest !== null),
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
        .map((record) => toOperatorCrewMember(record, now))
        .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]),
      serverTime: now.toISOString(),
      freshnessWindowMin: resolveFreshnessWindowMs() / 60_000,
    };
  }
}
