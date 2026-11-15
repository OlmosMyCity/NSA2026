/**
 * @module PrismaFaceSampleRepository
 * Prisma implementation of `IFaceSampleRepository`.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../config/prismaClient.js";
import {
  AstronautWithFaceSamples,
  CreateFaceSampleData,
  CreateFaceSampleResult,
  IFaceSampleRepository,
  StoredFaceSample,
} from "./IFaceSampleRepository.js";

export class PrismaFaceSampleRepository implements IFaceSampleRepository {
  async astronautExists(astronautId: string): Promise<boolean> {
    const astronaut = await prisma.astronaut.findFirst({
      where: { id: astronautId, deletedAt: null },
      select: { id: true },
    });
    return astronaut !== null;
  }

  async listByAstronaut(astronautId: string): Promise<StoredFaceSample[]> {
    return prisma.astronautFaceSample.findMany({
      where: { astronautId },
      orderBy: { createdAt: "asc" },
    });
  }

  async listAstronautsWithSamples(missionId?: string): Promise<AstronautWithFaceSamples[]> {
    return prisma.astronaut.findMany({
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
  }

  async createWithinLimit(data: CreateFaceSampleData, maxSamples: number): Promise<CreateFaceSampleResult> {
    return prisma.$transaction(async (tx) => {
      const astronaut = await tx.astronaut.findFirst({
        where: { id: data.astronautId, deletedAt: null },
        select: { id: true, photoUrl: true },
      });
      if (!astronaut) return { status: "ASTRONAUT_NOT_FOUND" as const };

      const currentCount = await tx.astronautFaceSample.count({
        where: { astronautId: data.astronautId },
      });
      if (currentCount >= maxSamples) return { status: "LIMIT_REACHED" as const };

      const sample = await tx.astronautFaceSample.create({
        data: {
          astronautId: data.astronautId,
          imageUrl: data.imageUrl,
          label: data.label ?? data.defaultLabel(currentCount + 1),
          embedding: data.embedding as unknown as Prisma.InputJsonValue,
          qualityScore: data.qualityScore,
          uploadedById: data.uploadedById,
        },
      });

      if (!astronaut.photoUrl) {
        await tx.astronaut.update({
          where: { id: data.astronautId },
          data: { photoUrl: data.imageUrl },
        });
      }

      return { status: "CREATED" as const, sample };
    });
  }

  async deleteForAstronaut(astronautId: string, sampleId: string): Promise<boolean> {
    const existing = await prisma.astronautFaceSample.findFirst({
      where: { id: sampleId, astronautId },
      select: { id: true },
    });
    if (!existing) return false;
    await prisma.astronautFaceSample.delete({ where: { id: sampleId } });
    return true;
  }
}
