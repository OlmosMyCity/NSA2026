import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prismaClient.js";
import { NotFoundError, ValidationError } from "../../exception/AppError.js";

export const MAX_FACE_SAMPLES_PER_ASTRONAUT = 5;

export interface EnrollFaceSampleDTO {
  astronautId: string;
  imageUrl: string;
  label?: string | null;
  embedding: number[];
  qualityScore?: number;
  uploadedById?: string | null;
}

export interface FaceSampleRecord {
  id: string;
  astronautId: string;
  imageUrl: string;
  label: string | null;
  embedding: number[];
  qualityScore: number;
  uploadedById: string | null;
  createdAt: Date;
}

export interface MissionBiometricProfile {
  astronautId: string;
  astronautName: string;
  role: string;
  missionId: string;
  photoUrl: string | null;
  sampleCount: number;
  embeddings: number[][];
}

function normalizeEmbeddingArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const nums = raw.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  const norm = Math.hypot(...nums);
  if (norm < 1e-8) return [];
  return nums.map((v) => Number((v / norm).toFixed(6)));
}

export class ManageFaceBiometricsUseCase {
  async listByAstronaut(astronautId: string): Promise<FaceSampleRecord[]> {
    const astronaut = await prisma.astronaut.findFirst({
      where: { id: astronautId, deletedAt: null },
      select: { id: true },
    });
    if (!astronaut) {
      throw new NotFoundError("Astronauta no encontrado.");
    }

    const rows = await prisma.astronautFaceSample.findMany({
      where: { astronautId },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((r) => ({
      id: r.id,
      astronautId: r.astronautId,
      imageUrl: r.imageUrl,
      label: r.label,
      embedding: normalizeEmbeddingArray(r.embedding),
      qualityScore: r.qualityScore,
      uploadedById: r.uploadedById,
      createdAt: r.createdAt,
    }));
  }

  async getGallery(missionId?: string): Promise<MissionBiometricProfile[]> {
    const astronauts = await prisma.astronaut.findMany({
      where: {
        deletedAt: null,
        ...(missionId ? { missionId } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: {
        faceSamples: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

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
      throw new ValidationError("El vector biométrico facial no es válido.");
    }

    return prisma.$transaction(async (tx) => {
      const astronaut = await tx.astronaut.findFirst({
        where: { id: dto.astronautId, deletedAt: null },
        select: { id: true, photoUrl: true },
      });
      if (!astronaut) {
        throw new NotFoundError("Astronauta no encontrado.");
      }

      const currentCount = await tx.astronautFaceSample.count({
        where: { astronautId: dto.astronautId },
      });
      if (currentCount >= MAX_FACE_SAMPLES_PER_ASTRONAUT) {
        throw new ValidationError(
          `Máximo ${MAX_FACE_SAMPLES_PER_ASTRONAUT} muestras biométricas faciales por tripulante. Elimina una muestra antes de añadir otra.`
        );
      }

      const created = await tx.astronautFaceSample.create({
        data: {
          astronautId: dto.astronautId,
          imageUrl: dto.imageUrl,
          label: dto.label?.trim() || `Muestra #${currentCount + 1}`,
          embedding: normed as unknown as Prisma.InputJsonValue,
          qualityScore: dto.qualityScore ?? 90,
          uploadedById: dto.uploadedById ?? null,
        },
      });

      if (!astronaut.photoUrl) {
        await tx.astronaut.update({
          where: { id: dto.astronautId },
          data: { photoUrl: dto.imageUrl },
        });
      }

      return {
        id: created.id,
        astronautId: created.astronautId,
        imageUrl: created.imageUrl,
        label: created.label,
        embedding: normed,
        qualityScore: created.qualityScore,
        uploadedById: created.uploadedById,
        createdAt: created.createdAt,
      };
    });
  }

  async deleteSample(astronautId: string, sampleId: string): Promise<void> {
    const existing = await prisma.astronautFaceSample.findFirst({
      where: { id: sampleId, astronautId },
    });
    if (!existing) {
      throw new NotFoundError("Muestra biométrica no encontrada.");
    }
    await prisma.astronautFaceSample.delete({
      where: { id: sampleId },
    });
  }
}
