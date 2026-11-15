import { CrewLocation, Prisma, Role } from "@prisma/client";
import { prisma } from "../database/prismaClient.js";
import {
  CrewLocationState,
  IOperatorCrewRepository,
  OperatorAccess,
  OperatorCrewRecord,
} from "../../domain/repository/IOperatorCrewRepository.js";

/** Lecturas que necesita el gemelo digital para estimar estado y tendencia por zona. */
const RECENT_READINGS = 10;

/** Lecturas que se muestran en la ficha individual del tripulante. */
const DETAIL_READINGS = 30;

function crewInclude(readings: number) {
  return {
    mission: { select: { id: true, name: true, environment: true } },
    readings: {
      where: { isValid: true },
      orderBy: { takenAt: "desc" },
      take: readings,
    },
    directives: {
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  } satisfies Prisma.AstronautInclude;
}

type AstronautWithCrewData = Prisma.AstronautGetPayload<{ include: ReturnType<typeof crewInclude> }>;

function toRecord(astro: AstronautWithCrewData): OperatorCrewRecord {
  return {
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
    latestDirective: astro.directives[0] ?? null,
  };
}

export class PrismaOperatorCrewRepository implements IOperatorCrewRepository {
  async listCrewForOperator(operatorId: string): Promise<OperatorCrewRecord[]> {
    const astronauts = await prisma.astronaut.findMany({
      where: { deletedAt: null, mission: { operatorId, deletedAt: null } },
      include: crewInclude(RECENT_READINGS),
      orderBy: { createdAt: "asc" },
    });
    return astronauts.map(toRecord);
  }

  async findCrewMemberForOperator(operatorId: string, astronautId: string): Promise<OperatorCrewRecord | null> {
    // El filtro por operador va en la consulta: un id ajeno simplemente no se encuentra.
    const astronaut = await prisma.astronaut.findFirst({
      where: { id: astronautId, deletedAt: null, mission: { operatorId, deletedAt: null } },
      include: crewInclude(DETAIL_READINGS),
    });
    return astronaut ? toRecord(astronaut) : null;
  }

  async listOperatorAccess(): Promise<OperatorAccess> {
    const [operators, missions] = await Promise.all([
      prisma.user.findMany({
        where: { role: Role.OPERATOR, deletedAt: null },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.mission.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, operatorId: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return { operators, missions };
  }

  async findLocation(astronautId: string): Promise<CrewLocationState | null> {
    return prisma.astronaut.findFirst({
      where: { id: astronautId, deletedAt: null },
      select: { currentLocation: true, locationUpdatedAt: true },
    });
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
