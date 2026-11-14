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
});
