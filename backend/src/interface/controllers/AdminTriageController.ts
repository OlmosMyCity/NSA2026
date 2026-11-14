import { Request, Response, NextFunction } from "express";
import { HealthStatus } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prismaClient.js";
import { NotFoundError, ValidationError } from "../../domain/errors/AppError.js";

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
        },
        orderBy: { createdAt: "asc" },
      });

      const crew = astronauts.map((astro) => {
        const latest = astro.readings[0] ?? null;
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

  sendClinicalDirectives = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { directives } = req.body ?? {};

      if (!directives || typeof directives !== "string" || directives.trim().length === 0) {
        throw new ValidationError("El texto de la directiva médica ('directives') es obligatorio.");
      }

      const astronaut = await prisma.astronaut.findFirst({
        where: { id, deletedAt: null },
      });

      if (!astronaut) {
        throw new NotFoundError("Astronauta", id);
      }

      const latestReading = await prisma.healthReading.findFirst({
        where: { astronautId: id, deletedAt: null },
        orderBy: { takenAt: "desc" },
      });

      const directiveText = `[DIRECTIVA MÉDICA EN VIGOR]: ${directives.trim()}`;

      if (latestReading) {
        await prisma.healthReading.update({
          where: { id: latestReading.id },
          data: { recommendation: directiveText },
        });
      } else {
        await prisma.healthReading.create({
          data: {
            astronautId: id,
            heartRateBpm: 72,
            systolicMmHg: 118,
            diastolicMmHg: 76,
            glucoseMgDl: 95,
            temperatureC: 36.6,
            spo2Pct: 98,
            sleepHours: 7.5,
            mood: 4,
            status: HealthStatus.OK,
            alerts: [],
            recommendation: directiveText,
            notes: "Lectura base generada al recibir directiva del Cirujano de Vuelo.",
          },
        });
      }

      res.status(200).json({
        success: true,
        message: `Directiva clínica transmitida exitosamente a la consola de ${astronaut.name}.`,
      });
    } catch (error) {
      next(error);
    }
  };
}

