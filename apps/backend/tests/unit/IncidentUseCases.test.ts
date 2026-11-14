import { describe, it, expect, beforeEach } from "vitest";
import { Incident, IncidentCategory, IncidentSeverity, IncidentStatus } from "@prisma/client";
import { RadiationEngineState } from "@nsa2026/radiation-engine";
import {
  IIncidentRepository,
  UpdateIncidentData,
} from "../../src/domain/repository/IIncidentRepository.js";
import {
  IncidentFilters,
  OpenIncidentDTO,
  PaginatedIncidents,
} from "../../src/domain/models/Incident.js";
import { OpenIncidentUseCase } from "../../src/application/use-cases/incident/OpenIncidentUseCase.js";
import { AcknowledgeIncidentUseCase } from "../../src/application/use-cases/incident/AcknowledgeIncidentUseCase.js";
import { CloseIncidentUseCase } from "../../src/application/use-cases/incident/CloseIncidentUseCase.js";
import { openRadiationIncidentFromState } from "../../src/application/use-cases/incident/syncSystemIncidents.js";
import { CreateHealthReadingUseCase } from "../../src/application/use-cases/health/CreateHealthReadingUseCase.js";
import { IHealthReadingRepository } from "../../src/domain/repository/IHealthReadingRepository.js";
import { NotFoundError, ValidationError } from "../../src/domain/errors/AppError.js";

class InMemoryIncidentRepository implements IIncidentRepository {
  public items: Incident[] = [];
  private seq = 1;

  async findAll(_filters: IncidentFilters): Promise<PaginatedIncidents> {
    return {
      data: this.items,
      pagination: { total: this.items.length, currentPage: 1, limit: 20, totalPages: 1 },
    };
  }

  async findById(id: string): Promise<Incident | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async findActiveByType(type: string, astronautId?: string | null): Promise<Incident | null> {
    return (
      this.items.find(
        (item) =>
          item.type === type &&
          item.astronautId === (astronautId ?? null) &&
          (item.status === IncidentStatus.OPEN || item.status === IncidentStatus.ACKNOWLEDGED)
      ) ?? null
    );
  }

  async create(data: OpenIncidentDTO): Promise<Incident> {
    const now = new Date();
    const incident: Incident = {
      id: `inc-${this.seq++}`,
      category: data.category,
      type: data.type,
      severity: data.severity,
      status: IncidentStatus.OPEN,
      title: data.title,
      description: data.description,
      astronautId: data.astronautId ?? null,
      missionId: data.missionId ?? null,
      source: data.source,
      readingId: data.readingId ?? null,
      protocolId: data.protocolId ?? null,
      metadata: (data.metadata ?? {}) as Incident["metadata"],
      openedAt: now,
      acknowledgedAt: null,
      acknowledgedById: null,
      closedAt: null,
      closedById: null,
      resolutionNotes: null,
      createdAt: now,
      updatedAt: now,
    };
    this.items.push(incident);
    return incident;
  }

  async update(id: string, data: UpdateIncidentData): Promise<Incident | null> {
    const idx = this.items.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    this.items[idx] = {
      ...this.items[idx],
      ...(data as Partial<Incident>),
      updatedAt: new Date(),
    };
    return this.items[idx];
  }
}

describe("Fase 1 - Incidentes (open/acknowledge/close y deduplicación)", () => {
  let repo: InMemoryIncidentRepository;
  let openUseCase: OpenIncidentUseCase;
  let ackUseCase: AcknowledgeIncidentUseCase;
  let closeUseCase: CloseIncidentUseCase;

  beforeEach(() => {
    repo = new InMemoryIncidentRepository();
    openUseCase = new OpenIncidentUseCase(repo);
    ackUseCase = new AcknowledgeIncidentUseCase(repo);
    closeUseCase = new CloseIncidentUseCase(repo);
  });

  it("abre un incidente nuevo y no duplica si ya hay uno activo del mismo tipo", async () => {
    const first = await openUseCase.execute({
      category: IncidentCategory.MEDICAL,
      type: "spo2",
      severity: IncidentSeverity.WARNING,
      title: "SpO2 limítrofe",
      description: "SpO2 en 93%",
      astronautId: "astro-1",
      source: "HEALTH_READING",
    });

    const second = await openUseCase.execute({
      category: IncidentCategory.MEDICAL,
      type: "spo2",
      severity: IncidentSeverity.WARNING,
      title: "SpO2 limítrofe",
      description: "SpO2 en 92.5%",
      astronautId: "astro-1",
      source: "HEALTH_READING",
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.incident.id).toBe(first.incident.id);
    expect(repo.items).toHaveLength(1);
  });

  it("escala severidad de WARNING a CRITICAL sin duplicar incidente activo", async () => {
    const first = await openUseCase.execute({
      category: IncidentCategory.MEDICAL,
      type: "heartRate",
      severity: IncidentSeverity.WARNING,
      title: "FC elevada",
      description: "96 lpm",
      astronautId: "astro-1",
      source: "HEALTH_READING",
    });

    const escalated = await openUseCase.execute({
      category: IncidentCategory.MEDICAL,
      type: "heartRate",
      severity: IncidentSeverity.CRITICAL,
      title: "FC crítica",
      description: "125 lpm",
      astronautId: "astro-1",
      source: "HEALTH_READING",
    });

    expect(escalated.created).toBe(false);
    expect(escalated.incident.id).toBe(first.incident.id);
    expect(escalated.incident.severity).toBe(IncidentSeverity.CRITICAL);
    expect(repo.items).toHaveLength(1);
  });

  it("permite transiciones OPEN -> ACKNOWLEDGED -> CLOSED y rechaza confirmar uno cerrado", async () => {
    const { incident } = await openUseCase.execute({
      category: IncidentCategory.MISSION,
      type: "DEPRESSURIZATION",
      severity: IncidentSeverity.CRITICAL,
      title: "Despresurización en módulo",
      description: "Caída rápida de presión en esclusa",
      source: "MANUAL",
    });

    const acked = await ackUseCase.execute({ id: incident.id, userId: "admin-1" });
    expect(acked.status).toBe(IncidentStatus.ACKNOWLEDGED);
    expect(acked.acknowledgedById).toBe("admin-1");

    const closed = await closeUseCase.execute({
      id: incident.id,
      userId: "admin-1",
      resolutionNotes: "Válvula sellada y presión nominal restaurada.",
    });
    expect(closed.status).toBe(IncidentStatus.CLOSED);
    expect(closed.closedById).toBe("admin-1");

    await expect(
      ackUseCase.execute({ id: incident.id, userId: "admin-1" })
    ).rejects.toThrow(ValidationError);

    await expect(
      ackUseCase.execute({ id: "missing-id", userId: "admin-1" })
    ).rejects.toThrow(NotFoundError);
  });

  it("CreateHealthReadingUseCase abre incidentes médicos por alertas sin duplicar", async () => {
    let readingSeq = 1;
    const readingRepo = {
      create: async (data: Record<string, unknown>) => ({
        id: `reading-${readingSeq++}`,
        ...data,
      }),
    } as unknown as IHealthReadingRepository;

    const createReading = new CreateHealthReadingUseCase(readingRepo, openUseCase);

    await createReading.execute({
      astronautId: "astro-99",
      heartRateBpm: 120,
      systolicMmHg: 118,
      diastolicMmHg: 76,
      glucoseMgDl: 95,
      temperatureC: 36.6,
      spo2Pct: 89,
      sleepHours: 7.5,
      mood: 4,
    });

    expect(repo.items).toHaveLength(2);
    expect(repo.items.map((i) => i.type).sort()).toEqual(["heartRate", "spo2"]);

    // Segunda lectura crítica similar no duplica los incidentes activos
    await createReading.execute({
      astronautId: "astro-99",
      heartRateBpm: 122,
      systolicMmHg: 118,
      diastolicMmHg: 76,
      glucoseMgDl: 95,
      temperatureC: 36.6,
      spo2Pct: 88,
      sleepHours: 7.5,
      mood: 4,
    });

    expect(repo.items).toHaveLength(2);
  });

  it("motor de radiación no abre incidente en S0_NOMINAL y deduplica en S3_STRONG", async () => {
    const baseState = {
      timestamp: new Date().toISOString(),
      isSimulated: true,
      telemetryDegraded: false,
      currentTelemetry: { stormScale: "S0_NOMINAL" },
      earlyWarning: { triggerEvent: null },
      mitigation: {
        abortEvaImmediately: false,
        evacuateToStormShelter: false,
        powerDownExternalSensors: false,
      },
    } as unknown as RadiationEngineState;

    const nominal = await openRadiationIncidentFromState(openUseCase, baseState);
    expect(nominal).toBeNull();
    expect(repo.items).toHaveLength(0);

    const stormState = {
      ...baseState,
      currentTelemetry: { stormScale: "S3_STRONG" },
      earlyWarning: { triggerEvent: "Solar Flare X2.5" },
      mitigation: {
        abortEvaImmediately: true,
        evacuateToStormShelter: true,
        powerDownExternalSensors: true,
      },
    } as unknown as RadiationEngineState;

    const inc1 = await openRadiationIncidentFromState(openUseCase, stormState);
    const inc2 = await openRadiationIncidentFromState(openUseCase, stormState);

    expect(inc1).not.toBeNull();
    expect(inc1!.severity).toBe(IncidentSeverity.CRITICAL);
    expect(inc2!.id).toBe(inc1!.id);
    expect(repo.items).toHaveLength(1);
  });
});
