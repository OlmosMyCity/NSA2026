/**
 * @module PrismaDirectiveRepository
 * PostgreSQL/Prisma implementation of `IDirectiveRepository` for flight-surgeon clinical directives.
 */

import { Directive } from "@prisma/client";
import { prisma } from "../database/prismaClient.js";
import { CreateDirectiveDTO } from "../../domain/models/Directive.js";
import { IDirectiveRepository } from "../../domain/repository/IDirectiveRepository.js";

/**
 * Prisma-backed repository managing flight-surgeon directives and idempotent crew acknowledgments.
 */
export class PrismaDirectiveRepository implements IDirectiveRepository {
  /** Persists a new clinical directive targeted at an astronaut, optionally linked to an incident. */
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

  /** Returns the most recent clinical directives issued to an astronaut, newest first. */
  async findByAstronautId(astronautId: string, limit = 20): Promise<Directive[]> {
    return prisma.directive.findMany({
      where: { astronautId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /** Marks a directive as acknowledged; idempotent if `acknowledgedAt` is already populated. */
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
