import { describe, it, expect, vi } from "vitest";
import { CrewLocation, Environment, HealthReading, HealthStatus, Role } from "@prisma/client";
import { GetOperatorCrewOverviewUseCase } from "../../src/application/use-cases/operator/GetOperatorCrewOverviewUseCase.js";
import {
  GetCrewLocationUseCase,
  UpdateCrewLocationUseCase,
} from "../../src/application/use-cases/operator/UpdateCrewLocationUseCase.js";
import { AssignMissionOperatorUseCase } from "../../src/application/use-cases/admin/AssignMissionOperatorUseCase.js";
import { IOperatorCrewRepository, OperatorCrewRecord } from "../../src/domain/repository/IOperatorCrewRepository.js";
import { IAstronautRepository } from "../../src/domain/repository/IAstronautRepository.js";
import { IUserRepository } from "../../src/domain/repository/IUserRepository.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../src/domain/errors/AppError.js";

const TAKEN_AT = new Date("2026-11-14T10:00:00Z");
const FRESH_NOW = () => new Date("2026-11-14T10:05:00Z");
const EXPIRED_NOW = () => new Date("2026-11-14T10:20:00Z");

function reading(status: HealthStatus, overrides: Partial<HealthReading> = {}): HealthReading {
  return {
    id: "reading-1",
    astronautId: "astro-1",
    heartRateBpm: 72,
    systolicMmHg: 118,
    diastolicMmHg: 76,
    glucoseMgDl: 95,
    temperatureC: 36.6,
    spo2Pct: 98,
    sleepHours: 7.5,
    mood: 4,
    status,
    alerts: ["Alerta clínica confidencial"],
    recommendation: "Recomendación confidencial",
    notes: "Nota confidencial",
    takenAt: TAKEN_AT,
    createdAt: TAKEN_AT,
    updatedAt: TAKEN_AT,
    deletedAt: null,
    ...overrides,
  } as HealthReading;
}

function record(id: string, recentReadings: HealthReading[]): OperatorCrewRecord {
  return {
    astronautId: id,
    astronautName: `Crew ${id}`,
    crewRole: "Pilot",
    photoUrl: null,
    missionId: "mission-1",
    missionName: "Artemis IV",
    environment: Environment.LUNAR_BASE,
    currentLocation: CrewLocation.HABITAT,
    locationUpdatedAt: TAKEN_AT,
    recentReadings,
  };
}

function crewRepo(overrides: Partial<IOperatorCrewRepository> = {}): IOperatorCrewRepository {
  return {
    listCrewForOperator: vi.fn().mockResolvedValue([]),
    listOperatorAccess: vi.fn().mockResolvedValue({ operators: [], missions: [] }),
    findLocation: vi.fn().mockResolvedValue(null),
    setMissionOperator: vi.fn().mockResolvedValue(true),
    updateLocation: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

const verdictOf = (member: { readiness: { destination: string; verdict: string }[] }, destination: string) =>
  member.readiness.find((r) => r.destination === destination)?.verdict;

describe("GetOperatorCrewOverviewUseCase", () => {
  it("consulta solo la tripulación del operador que pregunta", async () => {
    const list = vi.fn().mockResolvedValue([]);
    await new GetOperatorCrewOverviewUseCase(crewRepo({ listCrewForOperator: list }), FRESH_NOW).execute("op-7");
    expect(list).toHaveBeenCalledWith("op-7");
  });

  it("no expone ningún valor clínico, alerta, recomendación ni nota", async () => {
    const useCase = new GetOperatorCrewOverviewUseCase(
      crewRepo({ listCrewForOperator: vi.fn().mockResolvedValue([record("a", [reading(HealthStatus.WARNING)])]) }),
      FRESH_NOW
    );

    const { crew } = await useCase.execute("op-1");

    expect(Object.keys(crew[0]).sort()).toEqual(
      [
        "astronautId",
        "crewRole",
        "expiresAt",
        "isFresh",
        "lastReadingAt",
        "location",
        "locationUpdatedAt",
        "missionId",
        "missionName",
        "name",
        "photoUrl",
        "readiness",
        "status",
      ].sort()
    );
    const serialized = JSON.stringify(crew);
    expect(serialized).not.toContain("confidencial");
    expect(serialized).not.toMatch(/heartRate|spo2|glucose|systolic|temperature|sleepHours|mood/i);
  });

  it("con lectura vigente y nominal informa estado, ubicación y aptitud", async () => {
    const useCase = new GetOperatorCrewOverviewUseCase(
      crewRepo({ listCrewForOperator: vi.fn().mockResolvedValue([record("a", [reading(HealthStatus.OK)])]) }),
      FRESH_NOW
    );

    const { crew, serverTime, freshnessWindowMin } = await useCase.execute("op-1");

    expect(crew[0]).toMatchObject({
      status: "OK",
      location: "HABITAT",
      isFresh: true,
      lastReadingAt: "2026-11-14T10:00:00.000Z",
      expiresAt: "2026-11-14T10:15:00.000Z",
    });
    expect(verdictOf(crew[0], "EVA")).toBe("FIT");
    expect(serverTime).toBe("2026-11-14T10:05:00.000Z");
    expect(freshnessWindowMin).toBe(15);
  });

  it("con lectura vencida el estado es NO_DATA pero conserva la fecha del último registro", async () => {
    const useCase = new GetOperatorCrewOverviewUseCase(
      crewRepo({ listCrewForOperator: vi.fn().mockResolvedValue([record("a", [reading(HealthStatus.OK)])]) }),
      EXPIRED_NOW
    );

    const { crew } = await useCase.execute("op-1");

    expect(crew[0]).toMatchObject({ status: "NO_DATA", isFresh: false, lastReadingAt: "2026-11-14T10:00:00.000Z" });
    expect(crew[0].readiness.find((r) => r.destination === "EVA")).toMatchObject({
      verdict: "NO_DATA",
      note: "READING_EXPIRED",
    });
    expect(crew[0].readiness.find((r) => r.destination === "STORM_SHELTER")).toMatchObject({
      verdict: "FIT",
      note: "PROTECTIVE_SHELTER",
    });
  });

  it("sin lecturas distingue NO_READINGS de una lectura vencida", async () => {
    const useCase = new GetOperatorCrewOverviewUseCase(
      crewRepo({ listCrewForOperator: vi.fn().mockResolvedValue([record("a", [])]) }),
      FRESH_NOW
    );

    const { crew } = await useCase.execute("op-1");

    expect(crew[0]).toMatchObject({ status: "NO_DATA", lastReadingAt: null, expiresAt: null });
    expect(crew[0].readiness.find((r) => r.destination === "ROVER")?.note).toBe("NO_READINGS");
  });

  it("un hallazgo crítico retiene la EVA con un motivo genérico", async () => {
    const critical = reading(HealthStatus.CRITICAL, { heartRateBpm: 130 });
    const useCase = new GetOperatorCrewOverviewUseCase(
      crewRepo({ listCrewForOperator: vi.fn().mockResolvedValue([record("a", [critical])]) }),
      FRESH_NOW
    );

    const { crew } = await useCase.execute("op-1");

    expect(crew[0].status).toBe("CRITICAL");
    expect(crew[0].readiness.find((r) => r.destination === "EVA")).toMatchObject({
      verdict: "NOT_FIT",
      note: "MEDICAL_HOLD",
    });
  });

  it("ordena crítico, vigilancia, sin datos y nominal", async () => {
    const useCase = new GetOperatorCrewOverviewUseCase(
      crewRepo({
        listCrewForOperator: vi.fn().mockResolvedValue([
          record("ok", [reading(HealthStatus.OK)]),
          record("none", []),
          record("crit", [reading(HealthStatus.CRITICAL)]),
          record("warn", [reading(HealthStatus.WARNING)]),
        ]),
      }),
      FRESH_NOW
    );

    const { crew } = await useCase.execute("op-1");
    expect(crew.map((c) => c.astronautId)).toEqual(["crit", "warn", "none", "ok"]);
  });
});

describe("UpdateCrewLocationUseCase", () => {
  const astronautRepo = (ownId: string | null) =>
    ({ findByUserId: vi.fn().mockResolvedValue(ownId ? { id: ownId } : null) }) as unknown as IAstronautRepository;
  const updated = { currentLocation: CrewLocation.ROVER, locationUpdatedAt: TAKEN_AT };

  it("el tripulante actualiza su propia ubicación", async () => {
    const updateLocation = vi.fn().mockResolvedValue(updated);
    const useCase = new UpdateCrewLocationUseCase(astronautRepo("astro-1"), crewRepo({ updateLocation }), () => TAKEN_AT);

    const result = await useCase.execute({
      astronautId: "astro-1",
      location: CrewLocation.ROVER,
      requester: { id: "user-1", role: Role.USER },
    });

    expect(updateLocation).toHaveBeenCalledWith("astro-1", CrewLocation.ROVER, TAKEN_AT);
    expect(result).toEqual({ currentLocation: "ROVER", locationUpdatedAt: "2026-11-14T10:00:00.000Z" });
  });

  it("un tripulante no puede mover a otro", async () => {
    const useCase = new UpdateCrewLocationUseCase(astronautRepo("astro-1"), crewRepo());
    await expect(
      useCase.execute({ astronautId: "astro-2", location: CrewLocation.EVA, requester: { id: "user-1", role: Role.USER } })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("el operador no puede modificar la ubicación", async () => {
    const updateLocation = vi.fn();
    const useCase = new UpdateCrewLocationUseCase(astronautRepo(null), crewRepo({ updateLocation }));
    await expect(
      useCase.execute({ astronautId: "astro-1", location: CrewLocation.EVA, requester: { id: "op-1", role: Role.OPERATOR } })
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateLocation).not.toHaveBeenCalled();
  });

  it("el cirujano de vuelo puede actualizar a cualquiera; 404 si no existe", async () => {
    const ok = new UpdateCrewLocationUseCase(astronautRepo(null), crewRepo({ updateLocation: vi.fn().mockResolvedValue(updated) }));
    await expect(
      ok.execute({ astronautId: "astro-9", location: CrewLocation.ROVER, requester: { id: "admin", role: Role.ADMIN } })
    ).resolves.toMatchObject({ currentLocation: "ROVER" });

    const missing = new UpdateCrewLocationUseCase(astronautRepo(null), crewRepo());
    await expect(
      missing.execute({ astronautId: "nope", location: CrewLocation.ROVER, requester: { id: "admin", role: Role.ADMIN } })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("GetCrewLocationUseCase", () => {
  const astronautRepo = (ownId: string | null) =>
    ({ findByUserId: vi.fn().mockResolvedValue(ownId ? { id: ownId } : null) }) as unknown as IAstronautRepository;
  const state = { currentLocation: CrewLocation.HABITAT, locationUpdatedAt: TAKEN_AT };

  it("el tripulante consulta su propia ubicación", async () => {
    const useCase = new GetCrewLocationUseCase(astronautRepo("astro-1"), crewRepo({ findLocation: vi.fn().mockResolvedValue(state) }));
    await expect(useCase.execute("astro-1", { id: "user-1", role: Role.USER })).resolves.toEqual({
      currentLocation: "HABITAT",
      locationUpdatedAt: "2026-11-14T10:00:00.000Z",
    });
  });

  it("ni otro tripulante ni el operador pueden consultarla por esta ruta", async () => {
    const findLocation = vi.fn().mockResolvedValue(state);
    const useCase = new GetCrewLocationUseCase(astronautRepo("astro-1"), crewRepo({ findLocation }));
    await expect(useCase.execute("astro-2", { id: "user-1", role: Role.USER })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(useCase.execute("astro-1", { id: "op-1", role: Role.OPERATOR })).rejects.toBeInstanceOf(ForbiddenError);
    expect(findLocation).not.toHaveBeenCalled();
  });
});

describe("AssignMissionOperatorUseCase", () => {
  const userRepo = (role: Role | null) =>
    ({ findById: vi.fn().mockResolvedValue(role ? { id: "u", role } : null) }) as unknown as IUserRepository;

  it("asigna un usuario con rol operador", async () => {
    const setMissionOperator = vi.fn().mockResolvedValue(true);
    await new AssignMissionOperatorUseCase(userRepo(Role.OPERATOR), crewRepo({ setMissionOperator })).execute("m-1", "u");
    expect(setMissionOperator).toHaveBeenCalledWith("m-1", "u");
  });

  it("rechaza usuarios que no son operadores o que no existen", async () => {
    await expect(
      new AssignMissionOperatorUseCase(userRepo(Role.USER), crewRepo()).execute("m-1", "u")
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      new AssignMissionOperatorUseCase(userRepo(null), crewRepo()).execute("m-1", "u")
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("permite retirar al operador y avisa si la misión no existe", async () => {
    const setMissionOperator = vi.fn().mockResolvedValue(true);
    await new AssignMissionOperatorUseCase(userRepo(null), crewRepo({ setMissionOperator })).execute("m-1", null);
    expect(setMissionOperator).toHaveBeenCalledWith("m-1", null);

    await expect(
      new AssignMissionOperatorUseCase(userRepo(null), crewRepo({ setMissionOperator: vi.fn().mockResolvedValue(false) })).execute("x", null)
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
