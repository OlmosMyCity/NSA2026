import { Incident, IncidentStatus, Prisma } from "@prisma/client";
import { prisma } from "../database/prismaClient.js";
import { IncidentFilters, OpenIncidentDTO, PaginatedIncidents } from "../../domain/models/Incident.js";
import { IIncidentRepository, UpdateIncidentData } from "../../domain/repository/IIncidentRepository.js";

export class PrismaIncidentRepository implements IIncidentRepository {
  async findAll(filters: IncidentFilters): Promise<PaginatedIncidents> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.IncidentWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.severity) where.severity = filters.severity;
    if (filters.missionId) where.missionId = filters.missionId;
    if (filters.type) where.type = filters.type;

    if (filters.globalOnly) {
      where.astronautId = null;
    } else if (filters.astronautId) {
      where.OR = filters.includeGlobal
        ? [{ astronautId: filters.astronautId }, { astronautId: null }]
        : [{ astronautId: filters.astronautId }];
    }

    const [total, data] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ openedAt: "desc" }],
      }),
    ]);

    return {
      data,
      pagination: {
        total,
        currentPage: page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findById(id: string): Promise<Incident | null> {
    return prisma.incident.findUnique({ where: { id } });
  }

  async findActiveByType(type: string, astronautId?: string | null): Promise<Incident | null> {
    return prisma.incident.findFirst({
      where: {
        type,
        astronautId: astronautId ?? null,
        status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED] },
      },
      orderBy: { openedAt: "desc" },
    });
  }

  async create(data: OpenIncidentDTO): Promise<Incident> {
    return prisma.incident.create({
      data: {
        category: data.category,
        type: data.type,
        severity: data.severity,
        status: IncidentStatus.OPEN,
        title: data.title,
        description: data.description,
        astronautId: data.astronautId ?? null,
        missionId: data.missionId ?? null,
        source: data.source,
        readingId: data.readingId ?? null,
        protocolId: data.protocolId ?? null,
        metadata: data.metadata ?? {},
      },
    });
  }

  async update(id: string, data: UpdateIncidentData): Promise<Incident | null> {
    const existing = await prisma.incident.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.incident.update({
      where: { id },
      data,
    });
  }
}
