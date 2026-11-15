import { describe, it, expect, vi, beforeEach } from "vitest";
import { HealthStatus, IncidentStatus } from "@prisma/client";
import {
  IngestVisionTelemetryUseCase,
  deriveMoodScore,
  deriveSleepHours,
} from "../../src/service/health/IngestVisionTelemetryUseCase.js";
import { NotFoundError, ValidationError } from "../../src/exception/AppError.js";

describe("IngestVisionTelemetryUseCase", () => {
  const mockTx = {
    astronaut: {
      findFirst: vi.fn(),
    },
    healthReading: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    incident: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  const runInTransaction = vi.fn(async (fn: (tx: any) => Promise<any>) => fn(mockTx));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives mood and sleepHours cleanly from vision metrics", () => {
    expect(deriveMoodScore({ astronautId: "a1", heartRateBpm: 72, moodValence: 0.9, stressIndex: 10 })).toBe(5);
    expect(deriveMoodScore({ astronautId: "a1", heartRateBpm: 72, moodValence: -0.9, stressIndex: 85 })).toBe(1);
    expect(deriveSleepHours({ astronautId: "a1", heartRateBpm: 72, sleepQualityScore: 80 })).toBe(8);
  });

  it("rejects empty astronautId", async () => {
    const useCase = new IngestVisionTelemetryUseCase(runInTransaction);
    await expect(
      useCase.execute({ astronautId: "  ", heartRateBpm: 72 })
    ).rejects.toThrow(ValidationError);
    expect(runInTransaction).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when astronaut does not exist", async () => {
    mockTx.astronaut.findFirst.mockResolvedValue(null);
    const useCase = new IngestVisionTelemetryUseCase(runInTransaction);

    await expect(
      useCase.execute({ astronautId: "missing-astro", heartRateBpm: 72 })
    ).rejects.toThrow(NotFoundError);
  });

  it("creates a HealthReading inside a DB transaction carrying forward non-camera vitals", async () => {
    mockTx.astronaut.findFirst.mockResolvedValue({ id: "astro-1" });
    mockTx.healthReading.findFirst.mockResolvedValue({
      heartRateBpm: 70,
      systolicMmHg: 120,
      diastolicMmHg: 78,
      glucoseMgDl: 94,
      temperatureC: 36.7,
      spo2Pct: 98,
      sleepHours: 7.5,
      mood: 4,
    });
    mockTx.healthReading.create.mockImplementation(async ({ data }) => ({
      id: "reading-vision-1",
      ...data,
    }));

    const useCase = new IngestVisionTelemetryUseCase(runInTransaction);
    const result = await useCase.execute({
      astronautId: "astro-1",
      heartRateBpm: 76,
      moodValence: 0.6,
      stressIndex: 15,
      sleepQualityScore: 80,
      hrvRmssdMs: 44.2,
      respirationRpm: 15.4,
      signalQuality: 92,
      cameraMode: "rgb_pos",
      context: "cabin_active",
      dominantMood: "Calm / Focused",
    });

    expect(runInTransaction).toHaveBeenCalledTimes(1);
    expect(mockTx.healthReading.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          astronautId: "astro-1",
          heartRateBpm: 76,
          systolicMmHg: 120,
          diastolicMmHg: 78,
          glucoseMgDl: 94,
          temperatureC: 36.7,
          spo2Pct: 98,
          sleepHours: 8,
          mood: 4,
          notes: null,
          status: HealthStatus.OK,
        }),
      })
    );
    expect(result.incidentsTriggered).toBe(0);
    expect(result.derivedVitals).toEqual({
      heartRateBpm: 76,
      mood: 4,
      sleepHours: 8,
    });
  });

  it("opens medical incidents inside the same transaction when vision vitals trigger alerts", async () => {
    mockTx.astronaut.findFirst.mockResolvedValue({ id: "astro-1" });
    mockTx.healthReading.findFirst.mockResolvedValue(null);
    mockTx.healthReading.create.mockImplementation(async ({ data }) => ({
      id: "reading-vision-2",
      ...data,
    }));
    mockTx.incident.findFirst.mockResolvedValue(null);
    mockTx.incident.create.mockImplementation(async ({ data }) => ({
      id: "inc-1",
      status: IncidentStatus.OPEN,
      ...data,
    }));

    const useCase = new IngestVisionTelemetryUseCase(runInTransaction);
    const result = await useCase.execute({
      astronautId: "astro-1",
      heartRateBpm: 155, // Critical tachycardia
      moodValence: -0.8,
      stressIndex: 90,
      sleepQualityScore: 10,
    });

    expect(result.reading.status).toBe(HealthStatus.CRITICAL);
    expect(result.incidentsTriggered).toBeGreaterThan(0);
    expect(mockTx.incident.create).toHaveBeenCalled();
  });
});
