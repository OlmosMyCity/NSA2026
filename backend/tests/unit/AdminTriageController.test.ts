import { describe, it, expect, vi, beforeEach } from "vitest";
import { HealthReading, HealthStatus, Incident } from "@prisma/client";
import { GetTriageOverviewUseCase } from "../../src/service/admin/GetTriageOverviewUseCase.js";
import {
  ListAstronautDirectivesUseCase,
  SendClinicalDirectiveUseCase,
} from "../../src/service/admin/SendClinicalDirectiveUseCase.js";
import { CrewTriageRecord, ICrewTriageRepository } from "../../src/repository/ICrewTriageRepository.js";
import { IDirectiveRepository } from "../../src/repository/IDirectiveRepository.js";
import { NotFoundError } from "../../src/exception/AppError.js";

const TAKEN_AT = new Date("2026-11-14T10:00:00Z");

function reading(status: HealthStatus, overrides: Partial<HealthReading> = {}): HealthReading {
  return {
    id: `reading-${status}`,
    astronautId: "astro",
    heartRateBpm: 88,
    systolicMmHg: 124,
    diastolicMmHg: 81,
    glucoseMgDl: 101,
    temperatureC: 36.9,
    spo2Pct: 97,
    sleepHours: 6.5,
    mood: 3,
    status,
    alerts: [{ message: "FC elevada" }, "SpO2 baja"],
    recommendation: "Reposo",
    notes: null,
    takenAt: TAKEN_AT,
    createdAt: TAKEN_AT,
    updatedAt: TAKEN_AT,
    deletedAt: null,
    ...overrides,
  } as HealthReading;
}

function record(id: string, latestReading: HealthReading | null): CrewTriageRecord {
  return {
    astronautId: id,
    astronautName: `Crew ${id}`,
    crewRole: "Pilot",
    photoUrl: null,
    missionId: "mission-1",
    missionName: "Artemis IV",
    environment: "LUNAR_BASE",
    latestReading,
    latestDirective: null,
  };
}

function crewRepo(overrides: Partial<ICrewTriageRepository> = {}): ICrewTriageRepository {
  return {
    listCrewWithLatestReading: vi.fn().mockResolvedValue([]),
    findAstronautName: vi.fn().mockResolvedValue(null),
    findActiveRadiationIncident: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

const withCrew = (records: CrewTriageRecord[]) =>
  crewRepo({ listCrewWithLatestReading: vi.fn().mockResolvedValue(records) });

describe("GetTriageOverviewUseCase", () => {
  it("un tripulante sin lecturas es NO_DATA y no trae valores clínicos supuestos", async () => {
    const { crew, metrics } = await new GetTriageOverviewUseCase(withCrew([record("a", null)])).execute();

    expect(crew[0]).toMatchObject({
      status: "NO_DATA",
      heartRate: null,
      bloodPressure: null,
      spo2: null,
      glucose: null,
      temperature: null,
      sleepHours: null,
      mood: null,
      lastReadingAt: null,
      alerts: [],
      priorityBoosted: false,
    });
    expect(metrics).toEqual({ totalCrew: 1, criticalCount: 0, warningCount: 0, nominalCount: 0, noDataCount: 1 });
  });

  it("proyecta la última lectura real y normaliza las alertas", async () => {
    const { crew } = await new GetTriageOverviewUseCase(
      withCrew([record("a", reading(HealthStatus.WARNING))])
    ).execute();

    expect(crew[0]).toMatchObject({
      status: "WARNING",
      heartRate: 88,
      bloodPressure: "124/81",
      spo2: 97,
      alerts: ["FC elevada", "SpO2 baja"],
      lastReadingAt: "2026-11-14T10:00:00.000Z",
    });
  });

  it("marca la vigencia de la última lectura con la hora del servidor", async () => {
    const records = [record("a", reading(HealthStatus.OK)), record("b", null)];
    const at = (iso: string) =>
      new GetTriageOverviewUseCase(withCrew(records), async () => null, () => new Date(iso)).execute();

    const fresh = await at("2026-11-14T10:14:59Z");
    expect(fresh.serverTime).toBe("2026-11-14T10:14:59.000Z");
    expect(fresh.crew.find((c) => c.astronautId === "a")).toMatchObject({
      isFresh: true,
      expiresAt: "2026-11-14T10:15:00.000Z",
    });
    expect(fresh.crew.find((c) => c.astronautId === "b")).toMatchObject({ isFresh: false, expiresAt: null });

    const expired = await at("2026-11-14T10:15:00Z");
    expect(expired.crew.find((c) => c.astronautId === "a")?.isFresh).toBe(false);
  });

  it("ordena crítico, vigilancia, sin datos y nominal", async () => {
    const { crew, metrics } = await new GetTriageOverviewUseCase(
      withCrew([
        record("ok", reading(HealthStatus.OK)),
        record("none", null),
        record("crit", reading(HealthStatus.CRITICAL)),
        record("warn", reading(HealthStatus.WARNING)),
      ])
    ).execute();

    expect(crew.map((c) => c.astronautId)).toEqual(["crit", "warn", "none", "ok"]);
    expect(metrics).toEqual({ totalCrew: 4, criticalCount: 1, warningCount: 1, nominalCount: 1, noDataCount: 1 });
  });

  it("expone la última directiva del tripulante", async () => {
    const rec = record("a", reading(HealthStatus.OK));
    rec.latestDirective = {
      id: "dir-1",
      astronautId: "a",
      issuedById: "admin-1",
      incidentId: null,
      content: "Reposo 4 h",
      acknowledgedAt: null,
      createdAt: TAKEN_AT,
      updatedAt: TAKEN_AT,
    } as never;

    const { crew } = await new GetTriageOverviewUseCase(withCrew([rec])).execute();

    expect(crew[0].latestDirective).toEqual({
      id: "dir-1",
      content: "Reposo 4 h",
      incidentId: null,
      acknowledgedAt: null,
      createdAt: "2026-11-14T10:00:00.000Z",
    });
  });

  it("Fase 6: muestra incidente de radiación >= S3, sube prioridad de lectura CRITICAL y adapta protocolo a refugio", async () => {
    const incident = {
      id: "inc-rad-1",
      title: "Tormenta solar S4_SEVERE",
      description: "Flujo elevado de protones",
      severity: "CRITICAL",
      status: "OPEN",
      openedAt: TAKEN_AT,
      metadata: { stormScale: "S4_SEVERE" },
    } as unknown as Incident;

    const useCase = new GetTriageOverviewUseCase(
      crewRepo({
        listCrewWithLatestReading: vi.fn().mockResolvedValue([
          record("astro-ok", null),
          record("astro-crit", reading(HealthStatus.CRITICAL, { recommendation: "Protocolo hipoxia" })),
        ]),
        findActiveRadiationIncident: vi.fn().mockResolvedValue(incident),
      }),
      async () => ({ currentTelemetry: { stormScale: "S4_SEVERE" } }) as never
    );

    const payload = await useCase.execute();

    expect(payload.stormScale).toBe("S4_SEVERE");
    expect(payload.activeRadiationIncident).toEqual(
      expect.objectContaining({ id: "inc-rad-1", stormScale: "S4_SEVERE" })
    );
    expect(payload.crew[0].astronautId).toBe("astro-crit");
    expect(payload.crew[0].priorityBoosted).toBe(true);
    expect(payload.crew[0].triagePriorityScore).toBe(0);
    expect(payload.crew[0].adaptedProtocol).toContain("STORM SHELTER CARE");
    expect(payload.crew[1].priorityBoosted).toBe(false);
  });

  it("sin tormenta no informa incidente de radiación activo", async () => {
    const payload = await new GetTriageOverviewUseCase(withCrew([])).execute();
    expect(payload).toMatchObject({ stormScale: "S0_NOMINAL", activeRadiationIncident: null });
  });
});

describe("Fase 2 - Directivas sin tocar HealthReading", () => {
  const directiveRepo: IDirectiveRepository = {
    create: vi.fn(),
    findByAstronautId: vi.fn(),
    acknowledge: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("escribe en Directive; el caso de uso no tiene forma de tocar lecturas", async () => {
    const fakeDirective = {
      id: "dir-1",
      astronautId: "astro-1",
      issuedById: "admin-1",
      incidentId: "inc-1",
      content: "Hidratación y reposo 4 horas en cabina.",
      acknowledgedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(directiveRepo.create).mockResolvedValue(fakeDirective);

    const useCase = new SendClinicalDirectiveUseCase(
      crewRepo({ findAstronautName: vi.fn().mockResolvedValue("Elena Rodriguez") }),
      directiveRepo
    );

    const result = await useCase.execute({
      astronautId: "astro-1",
      issuedById: "admin-1",
      incidentId: "inc-1",
      content: "Hidratación y reposo 4 horas en cabina.",
    });

    expect(directiveRepo.create).toHaveBeenCalledWith({
      astronautId: "astro-1",
      issuedById: "admin-1",
      incidentId: "inc-1",
      content: "Hidratación y reposo 4 horas en cabina.",
    });
    expect(result).toEqual({ astronautName: "Elena Rodriguez", directive: fakeDirective });
  });

  it("acepta directivas para un tripulante sin lecturas", async () => {
    vi.mocked(directiveRepo.create).mockResolvedValue({ id: "dir-2" } as never);
    const useCase = new SendClinicalDirectiveUseCase(
      crewRepo({ findAstronautName: vi.fn().mockResolvedValue("Crew sin lecturas") }),
      directiveRepo
    );
    await expect(useCase.execute({ astronautId: "astro-2", content: "Medir signos vitales." })).resolves.toMatchObject({
      astronautName: "Crew sin lecturas",
    });
  });

  it("retorna NotFoundError si el astronauta no existe", async () => {
    const send = new SendClinicalDirectiveUseCase(crewRepo(), directiveRepo);
    await expect(send.execute({ astronautId: "missing", content: "Mantener protocolo nominal." })).rejects.toBeInstanceOf(
      NotFoundError
    );
    expect(directiveRepo.create).not.toHaveBeenCalled();

    const list = new ListAstronautDirectivesUseCase(crewRepo(), directiveRepo);
    await expect(list.execute("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});
