import { Incident, IncidentCategory, IncidentStatus } from "@prisma/client";
import { prisma } from "../database/prismaClient.js";
import { CrewTriageRecord, ICrewTriageRepository } from "../../domain/repository/ICrewTriageRepository.js";

export class PrismaCrewTriageRepository implements ICrewTriageRepository {
  async listCrewWithLatestReading(): Promise<CrewTriageRecord[]> {
    const astronauts = await prisma.astronaut.findMany({
      where: { deletedAt: null },
      include: {
        mission: { select: { id: true, name: true, environment: true } },
        readings: {
          where: { isValid: true },
          orderBy: { takenAt: "desc" },
          take: 1,
        },
        directives: {
          orderBy: { createdAt: "desc" },
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
      latestDirective: astro.directives[0] ?? null,
    }));
  }

  async findAstronautName(astronautId: string): Promise<string | null> {
    const astronaut = await prisma.astronaut.findFirst({
      where: { id: astronautId, deletedAt: null },
      select: { name: true },
    });
    return astronaut?.name ?? null;
  }

  async findActiveRadiationIncident(): Promise<Incident | null> {
    return prisma.incident.findFirst({
      where: {
        category: IncidentCategory.RADIATION,
        status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED] },
      },
      orderBy: { openedAt: "desc" },
    });
  }
}
