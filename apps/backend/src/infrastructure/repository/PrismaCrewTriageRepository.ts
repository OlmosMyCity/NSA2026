import { prisma } from "../database/prismaClient.js";
import { CrewTriageRecord, ICrewTriageRepository } from "../../domain/repository/ICrewTriageRepository.js";

export class PrismaCrewTriageRepository implements ICrewTriageRepository {
  async listCrewWithLatestReading(): Promise<CrewTriageRecord[]> {
    const astronauts = await prisma.astronaut.findMany({
      where: { deletedAt: null },
      include: {
        mission: { select: { id: true, name: true, environment: true } },
        readings: {
          where: { deletedAt: null },
          orderBy: { takenAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return astronauts.map((astro) => ({
      astronautId: astro.id,
      astronautName: astro.name,
      crewRole: astro.role,
      photoUrl: astro.photoUrl,
      missionId: astro.missionId,
      missionName: astro.mission?.name ?? null,
      environment: astro.mission?.environment ?? null,
      latestReading: astro.readings[0] ?? null,
    }));
  }

  async findAstronautName(astronautId: string): Promise<string | null> {
    const astronaut = await prisma.astronaut.findFirst({
      where: { id: astronautId, deletedAt: null },
      select: { name: true },
    });
    return astronaut?.name ?? null;
  }

  async setLatestReadingRecommendation(astronautId: string, recommendation: string): Promise<boolean> {
    const latest = await prisma.healthReading.findFirst({
      where: { astronautId, deletedAt: null },
      orderBy: { takenAt: "desc" },
      select: { id: true },
    });
    if (!latest) return false;

    await prisma.healthReading.update({
      where: { id: latest.id },
      data: { recommendation },
    });
    return true;
  }
}
