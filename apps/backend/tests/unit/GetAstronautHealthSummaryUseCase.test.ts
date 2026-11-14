import { describe, it, expect, vi } from "vitest";
import { GetAstronautHealthSummaryUseCase } from "../../src/application/use-cases/health/GetAstronautHealthSummaryUseCase.js";
import { IHealthReadingRepository, AstronautHealthSummary } from "../../src/domain/repository/IHealthReadingRepository.js";
import { HealthStatus } from "@prisma/client";
import { NotFoundError } from "../../src/domain/errors/AppError.js";

describe("GetAstronautHealthSummaryUseCase", () => {
  const mockSummary: AstronautHealthSummary = {
    astronautId: "astro-123",
    astronautName: "Reid Wiseman",
    missionName: "Artemis IV",
    currentStatus: HealthStatus.OK,
    latestReading: null,
    systems: {
      cardiovascular: { status: HealthStatus.OK, hr: 72, bp: "118/78" },
      metabolic: { status: HealthStatus.OK, glucose: 95 },
      respiratoryImmune: { status: HealthStatus.OK, spo2: 98, temp: 36.6 },
      sleepRecovery: { status: HealthStatus.OK, avgSleepHours7d: 7.5 },
      behavioral: { status: HealthStatus.OK, currentMood: 5 },
    },
    recentHistory7d: [],
  };

  it("debe retornar el resumen consolidado si el astronauta existe", async () => {
    const mockRepo: Partial<IHealthReadingRepository> = {
      getAstronautHealthSummary: vi.fn().mockResolvedValue(mockSummary),
    };

    const useCase = new GetAstronautHealthSummaryUseCase(mockRepo as IHealthReadingRepository);
    const result = await useCase.execute("astro-123");

    expect(result).toEqual(mockSummary);
    expect(result.systems.cardiovascular.hr).toBe(72);
  });

  it("debe lanzar NotFoundError si el repositorio no encuentra al astronauta", async () => {
    const mockRepo: Partial<IHealthReadingRepository> = {
      getAstronautHealthSummary: vi.fn().mockResolvedValue(null),
    };

    const useCase = new GetAstronautHealthSummaryUseCase(mockRepo as IHealthReadingRepository);

    await expect(useCase.execute("astro-inexistente")).rejects.toThrow(NotFoundError);
  });
});

