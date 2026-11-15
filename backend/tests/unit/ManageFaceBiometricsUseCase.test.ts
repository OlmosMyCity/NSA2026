import { describe, expect, it, vi } from "vitest";
import {
  ManageFaceBiometricsUseCase,
  MAX_FACE_SAMPLES_PER_ASTRONAUT,
} from "../../src/service/astronaut/ManageFaceBiometricsUseCase.js";
import type {
  CreateFaceSampleData,
  IFaceSampleRepository,
  StoredFaceSample,
} from "../../src/repository/IFaceSampleRepository.js";
import { NotFoundError, ValidationError } from "../../src/exception/AppError.js";

const embedding = Array.from({ length: 16 }, () => 2);

function stored(overrides: Partial<StoredFaceSample> = {}): StoredFaceSample {
  return {
    id: "sample-1",
    astronautId: "astro-01",
    imageUrl: "https://example.test/a.jpg",
    label: "Muestra #1",
    embedding,
    qualityScore: 90,
    uploadedById: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function repoWith(overrides: Partial<IFaceSampleRepository> = {}): IFaceSampleRepository {
  return {
    astronautExists: vi.fn().mockResolvedValue(true),
    listByAstronaut: vi.fn().mockResolvedValue([stored()]),
    listAstronautsWithSamples: vi.fn().mockResolvedValue([]),
    createWithinLimit: vi.fn().mockResolvedValue({ status: "CREATED", sample: stored() }),
    deleteForAstronaut: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("ManageFaceBiometricsUseCase", () => {
  it("returns stored samples with unit-length embeddings", async () => {
    const [sample] = await new ManageFaceBiometricsUseCase(repoWith()).listByAstronaut("astro-01");
    expect(Math.hypot(...sample.embedding)).toBeCloseTo(1, 4);
  });

  it("rejects listing for an unknown astronaut", async () => {
    const repo = repoWith({ astronautExists: vi.fn().mockResolvedValue(false) });
    await expect(new ManageFaceBiometricsUseCase(repo).listByAstronaut("nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects an embedding that is too short without touching the repository", async () => {
    const repo = repoWith();
    await expect(
      new ManageFaceBiometricsUseCase(repo).enrollSample({ astronautId: "astro-01", imageUrl: "u", embedding: [1, 2] })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.createWithinLimit).not.toHaveBeenCalled();
  });

  it("enrolls with the sample limit, a normalized embedding and a default label", async () => {
    const repo = repoWith();
    await new ManageFaceBiometricsUseCase(repo).enrollSample({
      astronautId: "astro-01",
      imageUrl: "u",
      label: "  ",
      embedding,
    });
    const [data, max] = vi.mocked(repo.createWithinLimit).mock.calls[0] as [CreateFaceSampleData, number];
    expect(max).toBe(MAX_FACE_SAMPLES_PER_ASTRONAUT);
    expect(data.label).toBeNull();
    expect(data.defaultLabel(3)).toBe("Muestra #3");
    expect(Math.hypot(...data.embedding)).toBeCloseTo(1, 4);
  });

  it("maps repository outcomes to domain errors", async () => {
    const dto = { astronautId: "astro-01", imageUrl: "u", embedding };
    const full = repoWith({ createWithinLimit: vi.fn().mockResolvedValue({ status: "LIMIT_REACHED" }) });
    await expect(new ManageFaceBiometricsUseCase(full).enrollSample(dto)).rejects.toBeInstanceOf(ValidationError);
    const missing = repoWith({ createWithinLimit: vi.fn().mockResolvedValue({ status: "ASTRONAUT_NOT_FOUND" }) });
    await expect(new ManageFaceBiometricsUseCase(missing).enrollSample(dto)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects deleting a sample that does not belong to the astronaut", async () => {
    const repo = repoWith({ deleteForAstronaut: vi.fn().mockResolvedValue(false) });
    await expect(new ManageFaceBiometricsUseCase(repo).deleteSample("astro-01", "x")).rejects.toBeInstanceOf(NotFoundError);
  });
});
