import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { HealthReadingController } from "../../src/controller/HealthReadingController.js";
import { ForbiddenError, ValidationError } from "../../src/exception/AppError.js";

describe("HealthReadingController - Seguridad IDOR y validación clínica", () => {
  const createUseCase = { execute: vi.fn() } as any;
  const invalidateUseCase = { execute: vi.fn() } as any;
  const correctUseCase = { execute: vi.fn() } as any;
  const getByIdUseCase = { execute: vi.fn() } as any;
  const astronautRepo = { findByUserId: vi.fn(), findById: vi.fn() } as any;
  const ingestVisionUseCase = { execute: vi.fn() } as any;

  const controller = new HealthReadingController(
    { execute: vi.fn() } as any,
    getByIdUseCase,
    createUseCase,
    invalidateUseCase,
    { execute: vi.fn() } as any,
    correctUseCase,
    astronautRepo,
    ingestVisionUseCase
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
    res.set = vi.fn().mockReturnValue(res);
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

  it("permite a un USER registrar e ingestar lecturas para un compañero de la MISMA misión con recordedById", async () => {
    astronautRepo.findByUserId.mockResolvedValue({ id: "astro-01", missionId: "mission-01" });
    astronautRepo.findById.mockResolvedValue({ id: "astro-03", missionId: "mission-01" });
    createUseCase.execute.mockResolvedValue({ id: "r-buddy-1" });
    ingestVisionUseCase.execute.mockResolvedValue({ reading: { id: "r-vision-1" } });

    const createReq = {
      user: { id: "user-crew-01", email: "r.wiseman@nasa.gov", role: Role.USER },
      body: { astronautId: "astro-03", ...validMetrics },
    } as unknown as Request;
    const createRes = makeRes();
    await controller.create(createReq, createRes, vi.fn());
    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(createUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        astronautId: "astro-03",
        recordedById: "user-crew-01",
      })
    );

    const visionReq = {
      user: { id: "user-crew-01", email: "r.wiseman@nasa.gov", role: Role.USER },
      body: { astronautId: "astro-03", heartRateBpm: 68, identityConfidence: 95.4 },
    } as unknown as Request;
    const visionRes = makeRes();
    await controller.ingestVision(visionReq, visionRes, vi.fn());
    expect(visionRes.status).toHaveBeenCalledWith(201);
    expect(ingestVisionUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        astronautId: "astro-03",
        recordedById: "user-crew-01",
        identityConfidence: 95.4,
      })
    );
  });

  it("bloquea a un USER si intenta ingestar datos para un tripulante de OTRA misión", async () => {
    astronautRepo.findByUserId.mockResolvedValue({ id: "astro-01", missionId: "mission-01" });
    astronautRepo.findById.mockResolvedValue({ id: "astro-05", missionId: "mission-02" });

    const visionReq = {
      user: { id: "user-crew-01", email: "r.wiseman@nasa.gov", role: Role.USER },
      body: { astronautId: "astro-05", heartRateBpm: 68 },
    } as unknown as Request;
    const next = vi.fn();
    await controller.ingestVision(visionReq, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(ingestVisionUseCase.execute).not.toHaveBeenCalled();
  });

  it("P1: PUT/PATCH/DELETE de lecturas responden 405 y explican la alternativa", () => {
    const res = makeRes();
    controller.methodNotAllowed({} as Request, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect((res.json as any).mock.calls[0][0].error).toMatch(/invalidate|corrections/);
  });

  it("impide que un USER invalide lecturas de otro tripulante", async () => {
    astronautRepo.findByUserId.mockResolvedValue({ id: "astro-own" });
    getByIdUseCase.execute.mockResolvedValue({ id: "r-9", astronautId: "astro-other" });
    const req = {
      params: { id: "r-9" },
      user: { id: "user-1", email: "u@nasa.gov", role: Role.USER },
      body: { reason: "Sensor desconectado" },
    } as unknown as Request;
    const next = vi.fn();

    await controller.invalidate(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(invalidateUseCase.execute).not.toHaveBeenCalled();
  });

  it("permite a un USER invalidar su propia lectura y registra quién lo hizo", async () => {
    astronautRepo.findByUserId.mockResolvedValue({ id: "astro-own" });
    getByIdUseCase.execute.mockResolvedValue({ id: "r-1", astronautId: "astro-own" });
    invalidateUseCase.execute.mockResolvedValue({ id: "r-1", isValid: false });
    const req = {
      params: { id: "r-1" },
      user: { id: "user-1", email: "u@nasa.gov", role: Role.USER },
      body: { reason: "  Sensor desconectado  " },
    } as unknown as Request;
    const res = makeRes();

    await controller.invalidate(req, res, vi.fn());

    expect(invalidateUseCase.execute).toHaveBeenCalledWith("r-1", "Sensor desconectado", "user-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rechaza una corrección sin motivo", async () => {
    const req = {
      params: { id: "r-1" },
      user: { id: "admin-1", email: "a@nasa.gov", role: Role.ADMIN },
      body: { ...validMetrics },
    } as unknown as Request;
    const next = vi.fn();

    await controller.correct(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(correctUseCase.execute).not.toHaveBeenCalled();
  });

  it("una corrección del ADMIN crea una lectura nueva (201) con el motivo", async () => {
    correctUseCase.execute.mockResolvedValue({ id: "r-2", supersedesId: "r-1" });
    const req = {
      params: { id: "r-1" },
      user: { id: "admin-1", email: "a@nasa.gov", role: Role.ADMIN },
      body: { ...validMetrics, reason: "Valor transcrito mal" },
    } as unknown as Request;
    const res = makeRes();

    await controller.correct(req, res, vi.fn());

    expect(correctUseCase.execute).toHaveBeenCalledWith(
      "r-1",
      expect.objectContaining({ heartRateBpm: 72, reason: "Valor transcrito mal" }),
      "admin-1"
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
