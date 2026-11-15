import { CrewTriageRecord, ICrewTriageRepository } from "../../../domain/repository/ICrewTriageRepository.js";

/** `NO_DATA`: el tripulante no tiene lecturas. Nunca se presenta como `OK`. */
export type TriageStatus = "CRITICAL" | "WARNING" | "OK" | "NO_DATA";

export interface CrewMemberTriage {
  astronautId: string;
  astronautName: string;
  missionId: string;
  missionName: string;
  role: string;
  environment: string | null;
  status: TriageStatus;
  heartRate: number | null;
  bloodPressure: string | null;
  spo2: number | null;
  glucose: number | null;
  temperature: number | null;
  sleepHours: number | null;
  mood: number | null;
  alerts: string[];
  recommendation: string | null;
  lastReadingAt: string | null;
  photoUrl: string | null;
}

export interface TriageMetrics {
  totalCrew: number;
  criticalCount: number;
  warningCount: number;
  nominalCount: number;
  noDataCount: number;
}

export interface TriageOverview {
  crew: CrewMemberTriage[];
  metrics: TriageMetrics;
}

/** Sin datos va antes que nominal: no saber es más urgente que estar bien. */
const TRIAGE_PRIORITY: Record<TriageStatus, number> = {
  CRITICAL: 0,
  WARNING: 1,
  NO_DATA: 2,
  OK: 3,
};

function normalizeAlertMessages(alerts: unknown): string[] {
  if (!Array.isArray(alerts)) return [];
  return alerts.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "message" in item) {
      return String((item as { message: unknown }).message);
    }
    return JSON.stringify(item);
  });
}

function toCrewMemberTriage(record: CrewTriageRecord): CrewMemberTriage {
  const latest = record.latestReading;

  return {
    astronautId: record.astronautId,
    astronautName: record.astronautName,
    missionId: record.missionId,
    missionName: record.missionName ?? "Misión sin asignar",
    role: record.crewRole,
    environment: record.environment,
    status: latest ? latest.status : "NO_DATA",
    heartRate: latest?.heartRateBpm ?? null,
    bloodPressure: latest ? `${latest.systolicMmHg}/${latest.diastolicMmHg}` : null,
    spo2: latest?.spo2Pct ?? null,
    glucose: latest?.glucoseMgDl ?? null,
    temperature: latest?.temperatureC ?? null,
    sleepHours: latest?.sleepHours ?? null,
    mood: latest?.mood ?? null,
    alerts: latest ? normalizeAlertMessages(latest.alerts) : [],
    recommendation: latest?.recommendation ?? null,
    lastReadingAt: latest ? latest.takenAt.toISOString() : null,
    photoUrl: record.photoUrl,
  };
}

export class GetTriageOverviewUseCase {
  constructor(private readonly crewRepo: ICrewTriageRepository) {}

  async execute(): Promise<TriageOverview> {
    const records = await this.crewRepo.listCrewWithLatestReading();
    const crew = records
      .map(toCrewMemberTriage)
      .sort((a, b) => TRIAGE_PRIORITY[a.status] - TRIAGE_PRIORITY[b.status]);

    const count = (status: TriageStatus): number => crew.filter((c) => c.status === status).length;

    return {
      crew,
      metrics: {
        totalCrew: crew.length,
        criticalCount: count("CRITICAL"),
        warningCount: count("WARNING"),
        nominalCount: count("OK"),
        noDataCount: count("NO_DATA"),
      },
    };
  }
}
