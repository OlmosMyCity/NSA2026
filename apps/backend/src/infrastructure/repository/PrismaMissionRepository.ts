import { Mission, Prisma } from "@prisma/client";
import { IMissionRepository } from "../../domain/repository/IMissionRepository.js";
import {
  CreateMissionDTO,
  MissionFilters,
  PaginatedResult,
  UpdateMissionDTO,
} from "../../domain/models/Mission.js";
import { prisma } from "../database/prismaClient.js";

export class PrismaMissionRepository implements IMissionRepository {
  async findMany(filters: MissionFilters): Promise<PaginatedResult<Mission>> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.MissionWhereInput = {
      deletedAt: null, // Borrado lógico activo
    };

    if (filters.environment) {
      where.environment = filters.environment;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search && filters.search.trim() !== "") {
      where.OR = [
        { name: { contains: filters.search.trim(), mode: "insensitive" } },
        { description: { contains: filters.search.trim(), mode: "insensitive" } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.mission.count({ where }),
      prisma.mission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: "desc" },
        include: {
          _count: {
            select: { astronauts: true },
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

  async findById(id: string): Promise<Mission | null> {
    return prisma.mission.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        astronauts: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            role: true,
            age: true,
            photoUrl: true,
          },
        },
      },
    });
  }

  async create(data: CreateMissionDTO): Promise<Mission> {
    return prisma.mission.create({
      data: {
        name: data.name,
        description: data.description,
        environment: data.environment,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        patchUrl: data.patchUrl,
        createdById: data.createdById,
      },
    });
  }

  async update(id: string, data: UpdateMissionDTO): Promise<Mission | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    return prisma.mission.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        environment: data.environment,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        patchUrl: data.patchUrl,
      },
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;

    await prisma.mission.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return true;
  }
}

