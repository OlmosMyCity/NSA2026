import { describe, it, expect, vi } from "vitest";
import { HealthReading, HealthStatus } from "@prisma/client";
import { GetTriageOverviewUseCase } from "../../src/application/use-cases/admin/GetTriageOverviewUseCase.js";
import { SendClinicalDirectiveUseCase } from "../../src/application/use-cases/admin/SendClinicalDirectiveUseCase.js";
import { CrewTriageRecord, ICrewTriageRepository } from "../../src/domain/repository/ICrewTriageRepository.js";
import { ConflictError, NotFoundError } from "../../src/domain/errors/AppError.js";

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
    takenAt: new Date("2026-11-14T10:00:00Z"),
    createdAt: new Date("2026-11-14T10:00:00Z"),
    updatedAt: new Date("2026-11-14T10:00:00Z"),
    deletedAt: null,
    ...overrides,
  };
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
  };
}

function repo(overrides: Partial<ICrewTriageRepository>): ICrewTriageRepository {
  return {
    listCrewWithLatestReading: vi.fn().mockResolvedValue([]),
    findAstronautName: vi.fn().mockResolvedValue(null),
    setLatestReadingRecommendation: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe("GetTriageOverviewUseCase", () => {
  it("un tripulante sin lecturas es NO_DATA y no trae valores clínicos supuestos", async () => {
    const useCase = new GetTriageOverviewUseCase(
      repo({ listCrewWithLatestReading: vi.fn().mockResolvedValue([record("a", null)]) })
    );

    const { crew, metrics } = await useCase.execute();

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
    });
    expect(metrics).toEqual({
      totalCrew: 1,
      criticalCount: 0,
      warningCount: 0,
      nominalCount: 0,
      noDataCount: 1,
    });
  });

  it("proyecta la última lectura real y normaliza las alertas", async () => {
    const useCase = new GetTriageOverviewUseCase(
      repo({
        listCrewWithLatestReading: vi.fn().mockResolvedValue([record("a", reading(HealthStatus.WARNING))]),
      })
    );

    const { crew } = await useCase.execute();

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
      new GetTriageOverviewUseCase(
        repo({ listCrewWithLatestReading: vi.fn().mockResolvedValue(records) }),
        () => new Date(iso)
      ).execute();

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
    const useCase = new GetTriageOverviewUseCase(
      repo({
        listCrewWithLatestReading: vi.fn().mockResolvedValue([
          record("ok", reading(HealthStatus.OK)),
          record("none", null),
          record("crit", reading(HealthStatus.CRITICAL)),
          record("warn", reading(HealthStatus.WARNING)),
        ]),
      })
    );

    const { crew, metrics } = await useCase.execute();

    expect(crew.map((c) => c.astronautId)).toEqual(["crit", "warn", "none", "ok"]);
    expect(metrics).toEqual({
      totalCrew: 4,
      criticalCount: 1,
      warningCount: 1,
      nominalCount: 1,
      noDataCount: 1,
    });
  });
});

describe("SendClinicalDirectiveUseCase", () => {
  it("lanza NotFoundError si el astronauta no existe", async () => {
    const useCase = new SendClinicalDirectiveUseCase(repo({}));
    await expect(useCase.execute("x", "Reposo")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("anota la directiva sobre la última lectura", async () => {
    const setLatest = vi.fn().mockResolvedValue(true);
    const useCase = new SendClinicalDirectiveUseCase(
      repo({
        findAstronautName: vi.fn().mockResolvedValue("Reid Wiseman"),
        setLatestReadingRecommendation: setLatest,
      })
    );

    const result = await useCase.execute("a", "Reposo 4 h");

    expect(result.astronautName).toBe("Reid Wiseman");
    expect(setLatest).toHaveBeenCalledWith("a", "[DIRECTIVA MÉDICA EN VIGOR]: Reposo 4 h");
  });

  it("rechaza con ConflictError si no hay lecturas, en vez de fabricar una", async () => {
    const useCase = new SendClinicalDirectiveUseCase(
      repo({ findAstronautName: vi.fn().mockResolvedValue("Reid Wiseman") })
    );
    await expect(useCase.execute("a", "Reposo")).rejects.toBeInstanceOf(ConflictError);
  });
});
