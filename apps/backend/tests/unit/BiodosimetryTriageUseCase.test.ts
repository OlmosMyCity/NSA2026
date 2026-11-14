import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Role } from "@prisma/client";
import { ForbiddenError } from "../../src/domain/errors/AppError.js";
import { BiodosimetryTriageUseCase } from "../../src/application/use-cases/health/BiodosimetryTriageUseCase.js";

describe("BiodosimetryTriageUseCase", () => {
  const readingRepo = {
    findMany: vi.fn(),
  } as any;
  const astronautRepo = {
    findByUserId: vi.fn(),
  } as any;

  const sampleReading = {
    astronautId: "astro-1",
    takenAt: new Date("2026-11-14T12:00:00.000Z"),
    heartRateBpm: 92,
    systolicMmHg: 132,
    diastolicMmHg: 84,
    glucoseMgDl: 108,
    temperatureC: 36.9,
    spo2Pct: 97,
    sleepHours: 4.5,
    mood: 2,
  };

  const sampleTriageBody = {
    primaryCause: "SLEEP_PSYCH_STRESS",
    confidence: 0.91,
    falsePositiveFiltered: true,
    oxidativeStressDetected: true,
    attribution: {
      nominalPct: 2.0,
      ionizingRadiationPct: 4.0,
      microgravityStressPct: 3.0,
      sleepPsychStressPct: 91.0,
    },
    clinicalGuidance: ["Prioritize 7-8h circadian sleep recovery."],
    explanation: "False positive filtered.",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RADIATION_ENGINE_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RADIATION_ENGINE_URL;
  });

  it("fuses latest HealthReading + radiation-engine status + Signal vs. Noise FastAPI", async () => {
    process.env.RADIATION_ENGINE_URL = "http://radiation-engine.internal";
    astronautRepo.findByUserId.mockResolvedValue({ id: "astro-1" });
    readingRepo.findMany.mockResolvedValue({ data: [sampleReading] });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          telemetryDegraded: false,
          currentTelemetry: { stormScale: "S0_NOMINAL" },
          biologicalDoses: { CREW_CABIN_NOMINAL: { doseRateMicroSvPerHour: 18.0 } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sampleTriageBody,
      });
    vi.stubGlobal("fetch", fetchMock);

    const useCase = new BiodosimetryTriageUseCase(readingRepo, astronautRepo);
    const result = await useCase.execute({
      requestingUserId: "user-1",
      requestingUserRole: Role.USER,
      shieldingType: "CREW_CABIN_NOMINAL",
      biomarkers: { urine8OhdgNgMg: 26.0 },
    });

    expect(result.astronautId).toBe("astro-1");
    expect(result.radiationSource).toBe("radiation-engine");
    expect(result.telemetryDegraded).toBe(false);
    expect(result.triage.falsePositiveFiltered).toBe(true);
    expect(result.triage.primaryCause).toBe("SLEEP_PSYCH_STRESS");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rechaza overrides de telemetría enviados por usuarios con rol USER", async () => {
    const useCase = new BiodosimetryTriageUseCase(readingRepo, astronautRepo);

    await expect(
      useCase.execute({
        requestingUserId: "user-1",
        requestingUserRole: Role.USER,
        radiationState: { currentTelemetry: { stormScale: "S0_NOMINAL" } },
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("marca telemetryDegraded=true si falla el proveedor de radiación", async () => {
    astronautRepo.findByUserId.mockResolvedValue({ id: "astro-1" });
    readingRepo.findMany.mockResolvedValue({ data: [sampleReading] });

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => sampleTriageBody,
    });
    vi.stubGlobal("fetch", fetchMock);

    const failingProvider = vi.fn().mockRejectedValue(new Error("NOAA timeout"));
    const useCase = new BiodosimetryTriageUseCase(readingRepo, astronautRepo, failingProvider);
    const result = await useCase.execute({
      requestingUserId: "user-1",
      requestingUserRole: Role.USER,
    });

    expect(result.radiationSource).toBe("fallback-nominal");
    expect(result.telemetryDegraded).toBe(true);
  });
});
