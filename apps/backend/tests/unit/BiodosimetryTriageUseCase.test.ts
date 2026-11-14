import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Role } from "@prisma/client";
import { BiodosimetryTriageUseCase } from "../../src/application/use-cases/health/BiodosimetryTriageUseCase.js";

describe("BiodosimetryTriageUseCase", () => {
  const readingRepo = {
    findMany: vi.fn(),
  } as any;
  const astronautRepo = {
    findByUserId: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fuses latest HealthReading + radiation-engine status + Signal vs. Noise FastAPI", async () => {
    astronautRepo.findByUserId.mockResolvedValue({ id: "astro-1" });
    readingRepo.findMany.mockResolvedValue({
      data: [
        {
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
        },
      ],
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          currentTelemetry: { stormScale: "S0_NOMINAL" },
          biologicalDoses: { CREW_CABIN_NOMINAL: { doseRateMicroSvPerHour: 18.0 } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
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
        }),
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
    expect(result.triage.falsePositiveFiltered).toBe(true);
    expect(result.triage.primaryCause).toBe("SLEEP_PSYCH_STRESS");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
