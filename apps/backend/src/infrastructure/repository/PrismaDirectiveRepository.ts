import { Directive } from "@prisma/client";
import { prisma } from "../database/prismaClient.js";
import { CreateDirectiveDTO } from "../../domain/models/Directive.js";
import { IDirectiveRepository } from "../../domain/repository/IDirectiveRepository.js";

export class PrismaDirectiveRepository implements IDirectiveRepository {
  async create(data: CreateDirectiveDTO): Promise<Directive> {
    return prisma.directive.create({
      data: {
        astronautId: data.astronautId,
        issuedById: data.issuedById ?? null,
        incidentId: data.incidentId ?? null,
        content: data.content,
      },
    });
  }

  async findByAstronautId(astronautId: string, limit = 20): Promise<Directive[]> {
    return prisma.directive.findMany({
      where: { astronautId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async acknowledge(id: string): Promise<Directive | null> {
    const existing = await prisma.directive.findUnique({ where: { id } });
    if (!existing) return null;
    if (existing.acknowledgedAt) return existing;

    return prisma.directive.update({
      where: { id },
      data: { acknowledgedAt: new Date() },
    });
  }
}
