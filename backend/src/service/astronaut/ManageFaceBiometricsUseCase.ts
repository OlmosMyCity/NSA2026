/**
 * @module ManageFaceBiometricsUseCase
 * Enrollment, listing and removal of crew facial biometric samples.
 */

import { NotFoundError, ValidationError } from "../../exception/AppError.js";
import type {
  EnrollFaceSampleDTO,
  FaceSampleRecord,
  MissionBiometricProfile,
} from "../../entity/FaceSample.js";
import { IFaceSampleRepository, StoredFaceSample } from "../../repository/IFaceSampleRepository.js";

export type { EnrollFaceSampleDTO, FaceSampleRecord, MissionBiometricProfile };

export const MAX_FACE_SAMPLES_PER_ASTRONAUT = 5;

function normalizeEmbeddingArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const nums = raw.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  const norm = Math.hypot(...nums);
  if (norm < 1e-8) return [];
  return nums.map((v) => Number((v / norm).toFixed(6)));
}

function toRecord(row: StoredFaceSample, embedding: number[]): FaceSampleRecord {
  return {
    id: row.id,
    astronautId: row.astronautId,
    imageUrl: row.imageUrl,
    label: row.label,
    embedding,
    qualityScore: row.qualityScore,
    uploadedById: row.uploadedById,
    createdAt: row.createdAt,
  };
}

export class ManageFaceBiometricsUseCase {
  constructor(private readonly repo: IFaceSampleRepository) {}

  async listByAstronaut(astronautId: string): Promise<FaceSampleRecord[]> {
    if (!(await this.repo.astronautExists(astronautId))) {
      throw new NotFoundError("Astronaut");
    }
    const rows = await this.repo.listByAstronaut(astronautId);
    return rows.map((r) => toRecord(r, normalizeEmbeddingArray(r.embedding)));
  }

  async getGallery(missionId?: string): Promise<MissionBiometricProfile[]> {
    const astronauts = await this.repo.listAstronautsWithSamples(missionId);

    return astronauts.map((a) => {
      const embeddings = a.faceSamples
        .map((s) => normalizeEmbeddingArray(s.embedding))
        .filter((e) => e.length >= 16);

      return {
        astronautId: a.id,
        astronautName: a.name,
        role: a.role,
        missionId: a.missionId,
        photoUrl: a.photoUrl,
        sampleCount: embeddings.length,
        embeddings,
      };
    });
  }

  async enrollSample(dto: EnrollFaceSampleDTO): Promise<FaceSampleRecord> {
    const normed = normalizeEmbeddingArray(dto.embedding);
    if (normed.length < 16) {
      throw new ValidationError("Facial biometric vector is invalid.");
    }

    const result = await this.repo.createWithinLimit(
      {
        astronautId: dto.astronautId,
        imageUrl: dto.imageUrl,
        label: dto.label?.trim() || null,
        defaultLabel: (position) => `Sample #${position}`,
        embedding: normed,
        qualityScore: dto.qualityScore ?? 90,
        uploadedById: dto.uploadedById ?? null,
      },
      MAX_FACE_SAMPLES_PER_ASTRONAUT
    );

    if (result.status === "ASTRONAUT_NOT_FOUND") {
      throw new NotFoundError("Astronaut");
    }
    if (result.status === "LIMIT_REACHED") {
      throw new ValidationError(
        `Maximum of ${MAX_FACE_SAMPLES_PER_ASTRONAUT} facial biometric samples per crewmember. Delete a sample before adding another.`
      );
    }
    return toRecord(result.sample, normed);
  }

  async deleteSample(astronautId: string, sampleId: string): Promise<void> {
    if (!(await this.repo.deleteForAstronaut(astronautId, sampleId))) {
      throw new NotFoundError("Biometric sample");
    }
  }
}
