import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../../src/infrastructure/database/prismaClient.js";
import { AdminTriageController } from "../../src/interface/controllers/AdminTriageController.js";
import { IDirectiveRepository } from "../../src/domain/repository/IDirectiveRepository.js";
import { NotFoundError } from "../../src/domain/errors/AppError.js";

describe("Fase 2 - AdminTriageController (Directivas sin tocar HealthReading)", () => {
  const directiveRepo: IDirectiveRepository = {
    create: vi.fn(),
    findByAstronautId: vi.fn(),
    acknowledge: vi.fn(),
  };

  const controller = new AdminTriageController(directiveRepo);

  function makeRes(): Response {
    const res: Partial<Response> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as Response;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("escribe en Directive y deja de tocar HealthReading.recommendation o crear lecturas ficticias", async () => {
    vi.spyOn(prisma.astronaut, "findFirst").mockResolvedValue({
      id: "astro-1",
      name: "Elena Rodriguez",
    } as never);
    const readingUpdateSpy = vi.spyOn(prisma.healthReading, "update");
    const readingCreateSpy = vi.spyOn(prisma.healthReading, "create");

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

    const req = {
      params: { id: "astro-1" },
      user: { id: "admin-1", email: "admin@nasa.gov", role: Role.ADMIN },
      body: {
        directives: "Hidratación y reposo 4 horas en cabina.",
        incidentId: "inc-1",
      },
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    await controller.sendClinicalDirectives(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(directiveRepo.create).toHaveBeenCalledWith({
      astronautId: "astro-1",
      issuedById: "admin-1",
      incidentId: "inc-1",
      content: "Hidratación y reposo 4 horas en cabina.",
    });
    expect(readingUpdateSpy).not.toHaveBeenCalled();
    expect(readingCreateSpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        directive: fakeDirective,
      })
    );
  });

  it("retorna NotFoundError si el astronauta no existe", async () => {
    vi.spyOn(prisma.astronaut, "findFirst").mockResolvedValue(null);

    const req = {
      params: { id: "astro-missing" },
      user: { id: "admin-1", email: "admin@nasa.gov", role: Role.ADMIN },
      body: { directives: "Mantener protocolo nominal." },
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    await controller.sendClinicalDirectives(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    expect(directiveRepo.create).not.toHaveBeenCalled();
  });

  it("Fase 6: muestra incidente de radiación >= S3, sube prioridad de lectura CRITICAL y adapta protocolo a refugio", async () => {
    const stormController = new AdminTriageController(directiveRepo, async () => ({
      currentTelemetry: { stormScale: "S4_SEVERE" },
    }) as never);

    vi.spyOn(prisma.astronaut, "findMany").mockResolvedValue([
      {
        id: "astro-ok",
        name: "Nominal Astro",
        missionId: "m-1",
        mission: { id: "m-1", name: "Artemis IV", environment: "LUNAR_BASE" },
        role: "Pilot",
        createdAt: new Date(),
        photoUrl: null,
        readings: [],
        directives: [],
      },
      {
        id: "astro-crit",
        name: "Critical Astro",
        missionId: "m-1",
        mission: { id: "m-1", name: "Artemis IV", environment: "LUNAR_BASE" },
        role: "Specialist",
        createdAt: new Date(),
        photoUrl: null,
        readings: [
          {
            status: "CRITICAL",
            heartRateBpm: 120,
            systolicMmHg: 145,
            diastolicMmHg: 95,
            spo2Pct: 89,
            glucoseMgDl: 95,
            temperatureC: 36.7,
            sleepHours: 6,
            mood: 3,
            alerts: [],
            recommendation: "Protocolo hipoxia",
            takenAt: new Date(),
          },
        ],
        directives: [],
      },
    ] as never);

    vi.spyOn(prisma.incident, "findFirst").mockResolvedValue({
      id: "inc-rad-1",
      title: "Tormenta solar S4_SEVERE",
      description: "Flujo elevado de protones",
      severity: "CRITICAL",
      status: "OPEN",
      openedAt: new Date(),
      metadata: { stormScale: "S4_SEVERE" },
    } as never);

    const req = {} as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    await stormController.getTriageOverview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const payload = vi.mocked(res.json).mock.calls[0][0] as {
      crew: Array<{
        astronautId: string;
        priorityBoosted: boolean;
        triagePriorityScore: number;
        adaptedProtocol: string | null;
      }>;
      activeRadiationIncident: { id: string; stormScale: string } | null;
    };

    expect(payload.activeRadiationIncident).toEqual(
      expect.objectContaining({ id: "inc-rad-1", stormScale: "S4_SEVERE" })
    );
    expect(payload.crew[0].astronautId).toBe("astro-crit");
    expect(payload.crew[0].priorityBoosted).toBe(true);
    expect(payload.crew[0].triagePriorityScore).toBe(0);
    expect(payload.crew[0].adaptedProtocol).toContain("REFUGIO ANTITORMENTA");
    expect(payload.crew[1].priorityBoosted).toBe(false);
  });
});
