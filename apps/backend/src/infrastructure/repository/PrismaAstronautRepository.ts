import { Prisma } from "@prisma/client";
import { IAstronautRepository } from "../../domain/repository/IAstronautRepository.js";
import {
  AstronautFilters,
  AstronautWithMission,
  CreateAstronautDTO,
  PaginatedResult,
  UpdateAstronautDTO,
} from "../../domain/models/Astronaut.js";
import { prisma } from "../database/prismaClient.js";

// Las rutas de astronautas son públicas: la ubicación solo sale por su ruta autenticada.
const withoutLocation = { currentLocation: true, locationUpdatedAt: true } as const;

export class PrismaAstronautRepository implements IAstronautRepository {
  async findMany(filters: AstronautFilters): Promise<PaginatedResult<AstronautWithMission>> {

    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.AstronautWhereInput = {
      deletedAt: null,
    };

    if (filters.missionId) {
      where.missionId = filters.missionId;
    }

    if (filters.search && filters.search.trim() !== "") {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { role: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.astronaut.count({ where }),
      prisma.astronaut.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "asc" },
        omit: withoutLocation,
        include: {
          mission: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      pagination: {
        total,
        currentPage: page,
        limit,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<AstronautWithMission | null> {
    return prisma.astronaut.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      omit: withoutLocation,
      include: {
        mission: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: string): Promise<AstronautWithMission | null> {
    return prisma.astronaut.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      omit: withoutLocation,
      include: {
        mission: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async create(data: CreateAstronautDTO): Promise<AstronautWithMission> {
    return prisma.astronaut.create({
      data: {
        name: data.name,
        role: data.role,
        age: data.age,
        missionId: data.missionId,
        userId: data.userId || null,
        photoUrl: data.photoUrl || null,
      },
      omit: withoutLocation,
      include: {
        mission: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateAstronautDTO): Promise<AstronautWithMission | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    return prisma.astronaut.update({
      where: { id },
      data: {
        name: data.name,
        role: data.role,
        age: data.age,
        missionId: data.missionId,
        userId: data.userId,
        photoUrl: data.photoUrl,
      },
      omit: withoutLocation,
      include: {
        mission: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    await prisma.astronaut.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return true;
  }
}

