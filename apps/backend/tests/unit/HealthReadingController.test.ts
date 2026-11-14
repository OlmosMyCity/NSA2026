import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { HealthReadingController } from "../../src/interface/controllers/HealthReadingController.js";
import { ForbiddenError } from "../../src/domain/errors/AppError.js";

describe("HealthReadingController - Seguridad IDOR y validación clínica", () => {
  const createUseCase = { execute: vi.fn() } as any;
  const updateUseCase = { execute: vi.fn() } as any;
  const getByIdUseCase = { execute: vi.fn() } as any;
  const astronautRepo = { findByUserId: vi.fn() } as any;

  const controller = new HealthReadingController(
    { execute: vi.fn() } as any,
    getByIdUseCase,
    createUseCase,
    { execute: vi.fn() } as any,
    { execute: vi.fn() } as any,
    updateUseCase,
    astronautRepo
  );

  const validMetrics = {
    heartRateBpm: 72,
    systolicMmHg: 118,
    diastolicMmHg: 76,
    glucoseMgDl: 95,
    temperatureC: 36.6,
    spo2Pct: 98,
    sleepHours: 7.5,
    mood: 4,
  };

  function makeRes(): Response {
    const res: Partial<Response> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as Response;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bloquea con ForbiddenError si un USER intenta registrar lectura para otro astronauta", async () => {
    astronautRepo.findByUserId.mockResolvedValue({ id: "astro-own" });
    const req = {
      user: { id: "user-1", email: "u@nasa.gov", role: Role.USER },
      body: { astronautId: "astro-other", ...validMetrics },
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    await controller.create(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(createUseCase.execute).not.toHaveBeenCalled();
  });

  it("permite registrar lectura propia a USER y lectura de terceros a ADMIN", async () => {
    astronautRepo.findByUserId.mockResolvedValue({ id: "astro-own" });
    createUseCase.execute.mockResolvedValue({ id: "r-1" });
    const next = vi.fn();

    const userReq = {
      user: { id: "user-1", email: "u@nasa.gov", role: Role.USER },
      body: { astronautId: "astro-own", ...validMetrics },
    } as unknown as Request;
    const userRes = makeRes();
    await controller.create(userReq, userRes, next);
    expect(userRes.status).toHaveBeenCalledWith(201);

    const adminReq = {
      user: { id: "admin-1", email: "a@nasa.gov", role: Role.ADMIN },
      body: { astronautId: "astro-other", ...validMetrics },
    } as unknown as Request;
    const adminRes = makeRes();
    await controller.create(adminReq, adminRes, next);
    expect(adminRes.status).toHaveBeenCalledWith(201);
  });

  it("impide que un USER sobrescriba recommendation al actualizar una lectura", async () => {
    astronautRepo.findByUserId.mockResolvedValue({ id: "astro-own" });
    getByIdUseCase.execute.mockResolvedValue({ id: "r-1", astronautId: "astro-own" });
    updateUseCase.execute.mockResolvedValue({ id: "r-1" });

    const req = {
      params: { id: "r-1" },
      user: { id: "user-1", email: "u@nasa.gov", role: Role.USER },
      body: { spo2Pct: 90, recommendation: "Falsa orden médica" },
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    await controller.update(req, res, next);

    expect(updateUseCase.execute).toHaveBeenCalledWith("r-1", expect.objectContaining({ spo2Pct: 90 }));
    const passedDto = updateUseCase.execute.mock.calls[0][1];
    expect(passedDto).not.toHaveProperty("recommendation");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
