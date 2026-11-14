import { Request, Response, NextFunction } from "express";
import { HealthStatus } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prismaClient.js";
import { IDirectiveRepository } from "../../domain/repository/IDirectiveRepository.js";
import { PrismaDirectiveRepository } from "../../infrastructure/repository/PrismaDirectiveRepository.js";
import { NotFoundError } from "../../domain/errors/AppError.js";
import { directivesSchema, parseWithValidation } from "../validation/schemas.js";

function normalizeAlertMessages(alerts: unknown): string[] {
  if (!Array.isArray(alerts)) return [];
  return alerts.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "message" in item) {
      return String((item as { message: unknown }).message);
    }
    return JSON.stringify(item);
  });
}

export class AdminTriageController {
  constructor(
    private readonly directiveRepo: IDirectiveRepository = new PrismaDirectiveRepository()
  ) {}

  getTriageOverview = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const astronauts = await prisma.astronaut.findMany({
        where: { deletedAt: null },
        include: {
          mission: {
            select: {
              id: true,
              name: true,
              environment: true,
            },
          },
          readings: {
            where: { deletedAt: null },
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

      const crew = astronauts.map((astro) => {
        const latest = astro.readings[0] ?? null;
        const latestDirective = astro.directives[0] ?? null;
        const status: HealthStatus = latest ? latest.status : HealthStatus.OK;

        return {
          astronautId: astro.id,
          astronautName: astro.name,
          missionId: astro.missionId,
          missionName: astro.mission?.name || "Misión sin asignar",
          role: astro.role,
          environment: astro.mission?.environment || "LUNAR_BASE",
          status,
          heartRate: latest ? latest.heartRateBpm : 70,
          bloodPressure: latest ? `${latest.systolicMmHg}/${latest.diastolicMmHg}` : "118/76",
          spo2: latest ? latest.spo2Pct : 98,
          glucose: latest ? latest.glucoseMgDl : 95,
          temperature: latest ? latest.temperatureC : 36.6,
          sleepHours: latest ? latest.sleepHours : 7.5,
          mood: latest ? latest.mood : 4,
          alerts: latest ? normalizeAlertMessages(latest.alerts) : [],
          recommendation: latest?.recommendation ?? null,
          latestDirective: latestDirective
            ? {
                id: latestDirective.id,
                content: latestDirective.content,
                incidentId: latestDirective.incidentId,
                acknowledgedAt: latestDirective.acknowledgedAt?.toISOString() ?? null,
                createdAt: latestDirective.createdAt.toISOString(),
              }
            : null,
          lastReadingAt: latest
            ? latest.takenAt.toISOString()
            : astro.createdAt.toISOString(),
          photoUrl: astro.photoUrl,
        };
      });

      const priorityOrder: Record<HealthStatus, number> = {
        CRITICAL: 0,
        WARNING: 1,
        OK: 2,
      };
      crew.sort((a, b) => priorityOrder[a.status] - priorityOrder[b.status]);

      const metrics = {
        totalCrew: crew.length,
        criticalCount: crew.filter((c) => c.status === HealthStatus.CRITICAL).length,
        warningCount: crew.filter((c) => c.status === HealthStatus.WARNING).length,
        nominalCount: crew.filter((c) => c.status === HealthStatus.OK).length,
      };

      res.status(200).json({ crew, metrics });
    } catch (error) {
      next(error);
    }
  };

  listAstronautDirectives = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const astronaut = await prisma.astronaut.findFirst({
        where: { id, deletedAt: null },
      });

      if (!astronaut) {
        throw new NotFoundError("Astronauta", id);
      }

      const directives = await this.directiveRepo.findByAstronautId(id);
      res.status(200).json({ data: directives });
    } catch (error) {
      next(error);
    }
  };

  sendClinicalDirectives = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { directives, incidentId } = parseWithValidation(directivesSchema, req.body ?? {});

      const astronaut = await prisma.astronaut.findFirst({
        where: { id, deletedAt: null },
      });

      if (!astronaut) {
        throw new NotFoundError("Astronauta", id);
      }

      const directive = await this.directiveRepo.create({
        astronautId: id,
        issuedById: req.user?.id ?? null,
        incidentId: incidentId ?? null,
        content: directives,
      });

      res.status(201).json({
        success: true,
        directive,
        message: `Directiva clínica transmitida exitosamente a la consola de ${astronaut.name}.`,
      });
    } catch (error) {
      next(error);
    }
  };
}

