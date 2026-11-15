/**
 * @module PrismaDigitalTwinRepository
 * Prisma implementation of `IDigitalTwinRepository`.
 */

import { prisma } from "../config/prismaClient.js";
import { AstronautTwinRecord, IDigitalTwinRepository } from "./IDigitalTwinRepository.js";

export class PrismaDigitalTwinRepository implements IDigitalTwinRepository {
  async findAstronautIdByUserId(userId: string): Promise<string | null> {
    const own = await prisma.astronaut.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    return own?.id ?? null;
  }

  async findAstronautWithReadings(astronautId: string, readingLimit: number): Promise<AstronautTwinRecord | null> {
    return prisma.astronaut.findFirst({
      where: { id: astronautId, deletedAt: null },
      include: {
        mission: { select: { id: true, name: true, environment: true } },
        readings: {
          where: { isValid: true },
          orderBy: { takenAt: "desc" },
          take: readingLimit,
        },
      },
    });
  }
}
