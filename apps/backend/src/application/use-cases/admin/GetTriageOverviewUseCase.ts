import { RadiationEngineState } from "@nsa2026/radiation-engine";
import { correlateTriageWithRadiation, isS3OrHigherStorm } from "../../health/correlation.js";
import { evaluateFreshness } from "../../health/freshness.js";
import { CrewTriageRecord, ICrewTriageRepository } from "../../../domain/repository/ICrewTriageRepository.js";

/** `NO_DATA`: el tripulante no tiene lecturas. Nunca se presenta como `OK`. */
export type TriageStatus = "CRITICAL" | "WARNING" | "OK" | "NO_DATA";

export interface LatestDirectiveSummary {
  id: string;
  content: string;
  incidentId: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

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
  priorityBoosted: boolean;
  triagePriorityScore: number;
  triagePriorityLabel: string;
  adaptedProtocol: string | null;
  latestDirective: LatestDirectiveSummary | null;
  lastReadingAt: string | null;
  /** Los signos vivos de la última lectura siguen dentro de la ventana de vigencia. */
  isFresh: boolean;
  expiresAt: string | null;
  photoUrl: string | null;
}

export interface TriageMetrics {
  totalCrew: number;
  criticalCount: number;
  warningCount: number;
  nominalCount: number;
  noDataCount: number;
}

export interface ActiveRadiationIncidentSummary {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  stormScale: string;
  openedAt: string;
}

export interface TriageOverview {
  crew: CrewMemberTriage[];
  metrics: TriageMetrics;
  stormScale: string;
  activeRadiationIncident: ActiveRadiationIncidentSummary | null;
  /** Hora del servidor, para que el cliente no dependa de su propio reloj. */
  serverTime: string;
}

/** Sin datos va después de vigilancia (2) y antes de nominal (3): no saber es más urgente que estar bien. */
const NO_DATA_PRIORITY_SCORE = 2.5;

export function normalizeAlertMessages(alerts: unknown): string[] {
  if (!Array.isArray(alerts)) return [];
  return alerts.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "message" in item) {
      return String((item as { message: unknown }).message);
    }
    return JSON.stringify(item);
  });
}

function toCrewMemberTriage(record: CrewTriageRecord, stormScale: string, now: Date): CrewMemberTriage {
  const latest = record.latestReading;
  const directive = record.latestDirective;
  const freshness = evaluateFreshness(latest?.takenAt, now);

  const correlation = latest
    ? correlateTriageWithRadiation(latest.status, latest.recommendation ?? null, stormScale)
    : {
        priorityBoosted: false,
        triagePriorityScore: NO_DATA_PRIORITY_SCORE,
        triagePriorityLabel: "NO_DATA",
        adaptedProtocol: null,
        recommendation: null,
      };

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
    ...correlation,
    latestDirective: directive
      ? {
          id: directive.id,
          content: directive.content,
          incidentId: directive.incidentId,
          acknowledgedAt: directive.acknowledgedAt?.toISOString() ?? null,
          createdAt: directive.createdAt.toISOString(),
        }
      : null,
    lastReadingAt: latest ? latest.takenAt.toISOString() : null,
    isFresh: freshness.isFresh,
    expiresAt: freshness.expiresAt?.toISOString() ?? null,
    photoUrl: record.photoUrl,
  };
}

export class GetTriageOverviewUseCase {
  constructor(
    private readonly crewRepo: ICrewTriageRepository,
    private readonly getRadiationState: () => Promise<RadiationEngineState | null> = async () => null,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(): Promise<TriageOverview> {
    const now = this.now();
    const [records, radiationState, radiationIncident] = await Promise.all([
      this.crewRepo.listCrewWithLatestReading(),
      this.getRadiationState(),
      this.crewRepo.findActiveRadiationIncident(),
    ]);

    const metadata = radiationIncident?.metadata;
    const incidentStormScale =
      metadata && typeof metadata === "object" && "stormScale" in metadata
        ? String((metadata as { stormScale?: unknown }).stormScale)
        : null;
    const stormScale = radiationState?.currentTelemetry?.stormScale ?? incidentStormScale ?? "S0_NOMINAL";
    const stormActive = isS3OrHigherStorm(stormScale);

    const crew = records
      .map((record) => toCrewMemberTriage(record, stormScale, now))
      .sort((a, b) => a.triagePriorityScore - b.triagePriorityScore);

    const count = (status: TriageStatus): number => crew.filter((c) => c.status === status).length;

    let activeRadiationIncident: ActiveRadiationIncidentSummary | null = null;
    if (stormActive && radiationIncident) {
      activeRadiationIncident = {
        id: radiationIncident.id,
        title: radiationIncident.title,
        description: radiationIncident.description,
        severity: radiationIncident.severity,
        status: radiationIncident.status,
        stormScale,
        openedAt: radiationIncident.openedAt.toISOString(),
      };
    } else if (stormActive) {
      activeRadiationIncident = {
        id: "storm-live",
        title: `Tormenta de radiación solar (${stormScale})`,
        description: "Tormenta solar >= S3 activa en telemetría.",
        severity: "CRITICAL",
        status: "OPEN",
        stormScale,
        openedAt: now.toISOString(),
      };
    }

    return {
      crew,
      metrics: {
        totalCrew: crew.length,
        criticalCount: count("CRITICAL"),
        warningCount: count("WARNING"),
        nominalCount: count("OK"),
        noDataCount: count("NO_DATA"),
      },
      stormScale,
      activeRadiationIncident,
      serverTime: now.toISOString(),
    };
  }
}
