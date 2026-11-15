import { CrewLocation } from "@prisma/client";
import { prisma } from "../database/prismaClient.js";
import { IOperatorCrewRepository, OperatorCrewRecord } from "../../domain/repository/IOperatorCrewRepository.js";

/** Lecturas que necesita el gemelo digital para estimar estado y tendencia por zona. */
const RECENT_READINGS = 10;

export class PrismaOperatorCrewRepository implements IOperatorCrewRepository {
  async listCrewForOperator(operatorId: string): Promise<OperatorCrewRecord[]> {
    const astronauts = await prisma.astronaut.findMany({
      where: { deletedAt: null, mission: { operatorId, deletedAt: null } },
      include: {
        mission: { select: { id: true, name: true, environment: true } },
        readings: {
          where: { deletedAt: null },
          orderBy: { takenAt: "desc" },
          take: RECENT_READINGS,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return astronauts.map((astro) => ({
      astronautId: astro.id,
      astronautName: astro.name,
      crewRole: astro.role,
      photoUrl: astro.photoUrl,
      missionId: astro.mission.id,
      missionName: astro.mission.name,
      environment: astro.mission.environment,
      currentLocation: astro.currentLocation,
      locationUpdatedAt: astro.locationUpdatedAt,
      recentReadings: astro.readings,
    }));
  }

  async setMissionOperator(missionId: string, operatorId: string | null): Promise<boolean> {
    const { count } = await prisma.mission.updateMany({
      where: { id: missionId, deletedAt: null },
      data: { operatorId },
    });
    return count > 0;
  }

  async updateLocation(astronautId: string, location: CrewLocation, at: Date) {
    const { count } = await prisma.astronaut.updateMany({
      where: { id: astronautId, deletedAt: null },
      data: { currentLocation: location, locationUpdatedAt: at },
    });
    return count > 0 ? { currentLocation: location, locationUpdatedAt: at } : null;
  }
}
