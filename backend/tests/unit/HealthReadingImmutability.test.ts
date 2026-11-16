import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvalidateHealthReadingUseCase } from "../../src/service/health/InvalidateHealthReadingUseCase.js";
import { CorrectHealthReadingUseCase } from "../../src/service/health/CorrectHealthReadingUseCase.js";
import { ConflictError, NotFoundError, ValidationError } from "../../src/exception/AppError.js";

/** P1 — Los datos de salud solo se agregan: se invalidan o se corrigen, nunca se editan ni se borran. */
describe("Inmutabilidad de lecturas de salud (P1)", () => {
  const original = {
    id: "r-1",
    astronautId: "astro-01",
    isValid: true,
    notes: "Lectura matutina",
    takenAt: new Date("2026-11-10T08:00:00Z"),
  };

  const repo = {
    findById: vi.fn(),
    invalidate: vi.fn(),
    createCorrection: vi.fn(),
  } as any;

  const vitals = {
    heartRateBpm: 72,
    systolicMmHg: 118,
    diastolicMmHg: 76,
    glucoseMgDl: 95,
    temperatureC: 36.6,
    spo2Pct: 98,
    sleepHours: 7.5,
    mood: 4,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.findById.mockResolvedValue(original);
  });

  describe("InvalidateHealthReadingUseCase", () => {
    const useCase = new InvalidateHealthReadingUseCase(repo);

    it("invalida con motivo y usuario, sin borrar", async () => {
      repo.invalidate.mockResolvedValue({ ...original, isValid: false });

      await useCase.execute("r-1", "  Sensor desconectado  ", "admin-1");

      expect(repo.invalidate).toHaveBeenCalledWith("r-1", {
        reason: "Sensor desconectado",
        invalidatedById: "admin-1",
      });
    });

    it("exige un motivo de al menos 5 caracteres", async () => {
      await expect(useCase.execute("r-1", "x", "admin-1")).rejects.toBeInstanceOf(ValidationError);
      expect(repo.invalidate).not.toHaveBeenCalled();
    });

    it("la invalidación es definitiva: no se repite", async () => {
      repo.findById.mockResolvedValue({ ...original, isValid: false });
      await expect(useCase.execute("r-1", "Duplicada", "admin-1")).rejects.toBeInstanceOf(ConflictError);
    });

    it("404 si la lectura no existe", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(useCase.execute("nope", "Duplicada", null)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("CorrectHealthReadingUseCase", () => {
    it("crea una lectura nueva re-evaluada que reemplaza a la original", async () => {
      const openIncident = { execute: vi.fn().mockResolvedValue({ incident: {}, created: true }) } as any;
      const useCase = new CorrectHealthReadingUseCase(repo, openIncident);
      repo.createCorrection.mockImplementation(async (_id: string, data: any) => ({ id: "r-2", ...data }));

      const corrected = await useCase.execute(
        "r-1",
        { ...vitals, heartRateBpm: 112, reason: "Se transcribió mal la FC" },
        "admin-1"
      );

      const [supersedesId, data, invalidation] = repo.createCorrection.mock.calls[0];
      expect(supersedesId).toBe("r-1");
      // Mismo astronauta y mismo momento clínico que la original
      expect(data.astronautId).toBe("astro-01");
      expect(data.takenAt).toEqual(original.takenAt);
      // Re-evaluada con la regla clínica: 112 lpm es taquicardia
      expect(data.status).toBe("CRITICAL");
      expect(invalidation).toEqual({ reason: "Corrected: Se transcribió mal la FC", invalidatedById: "admin-1" });
      expect(corrected.id).toBe("r-2");
      // La nueva alerta abre su incidente médico
      expect(openIncident.execute).toHaveBeenCalled();
    });

    it("no corrige una lectura ya invalidada", async () => {
      repo.findById.mockResolvedValue({ ...original, isValid: false });
      const useCase = new CorrectHealthReadingUseCase(repo);
      await expect(
        useCase.execute("r-1", { ...vitals, reason: "Otra corrección" }, "admin-1")
      ).rejects.toBeInstanceOf(ConflictError);
      expect(repo.createCorrection).not.toHaveBeenCalled();
    });

    it("exige motivo también para corregir", async () => {
      const useCase = new CorrectHealthReadingUseCase(repo);
      await expect(useCase.execute("r-1", { ...vitals, reason: "" }, "admin-1")).rejects.toBeInstanceOf(
        ValidationError
      );
    });
  });
});
