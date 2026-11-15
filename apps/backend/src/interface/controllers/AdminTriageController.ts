/**
 * @module AdminTriageController
 * HTTP controller for Flight Surgeon administrative triage console endpoints:
 * crew-wide clinical prioritization correlated with solar storm telemetry and clinical directives.
 */

import { Request, Response, NextFunction } from "express";
import { HealthStatus, IncidentCategory, IncidentStatus } from "@prisma/client";
import { RadiationEngineState } from "@nsa2026/radiation-engine";
import { prisma } from "../../infrastructure/database/prismaClient.js";
import { IDirectiveRepository } from "../../domain/repository/IDirectiveRepository.js";
import { PrismaDirectiveRepository } from "../../infrastructure/repository/PrismaDirectiveRepository.js";
import { radiationEngine } from "../../infrastructure/services/radiationEngine.js";
import {
  correlateTriageWithRadiation,
  isS3OrHigherStorm,
} from "../../application/health/correlation.js";
import { NotFoundError } from "../../domain/errors/AppError.js";
import { directivesSchema, parseWithValidation } from "../validation/schemas.js";

/** Normalizes heterogeneous JSON alert payloads into plain display strings. */
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

/**
 * Controller backing `/api/admin` triage overview and crew directive dispatch routes.
 */
export class AdminTriageController {
  constructor(
    private readonly directiveRepo: IDirectiveRepository = new PrismaDirectiveRepository(),
    private readonly getRadiationState: () => Promise<RadiationEngineState | null> = () =>
      radiationEngine.getCurrentState().catch(() => null)
  ) {}

  /**
   * `GET /api/admin/triage` — Aggregates latest vitals and directives for all active crew,
   * correlates each astronaut's clinical status against the active NOAA storm scale (`>= S3` escalation),
   * and returns the crew sorted by ascending triage priority score alongside fleet metrics.
   */
  getTriageOverview = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [astronauts, radiationState, radiationIncident] = await Promise.all([
        prisma.astronaut.findMany({
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
        }),
        this.getRadiationState(),
        prisma.incident.findFirst({
          where: {
            category: IncidentCategory.RADIATION,
            status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED] },
          },
          orderBy: { openedAt: "desc" },
        }),
      ]);

      const incidentStormScale =
        radiationIncident?.metadata &&
        typeof radiationIncident.metadata === "object" &&
        "stormScale" in radiationIncident.metadata
          ? String((radiationIncident.metadata as { stormScale?: unknown }).stormScale)
          : null;

      const stormScale = radiationState?.currentTelemetry?.stormScale ?? incidentStormScale ?? "S0_NOMINAL";
      const s3Active = isS3OrHigherStorm(stormScale);

      const crew = astronauts.map((astro) => {
        const latest = astro.readings[0] ?? null;
        const latestDirective = astro.directives[0] ?? null;
        const status: HealthStatus = latest ? latest.status : HealthStatus.OK;
        const correlation = correlateTriageWithRadiation(
          status,
          latest?.recommendation ?? null,
          stormScale
        );

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
          recommendation: correlation.recommendation,
          priorityBoosted: correlation.priorityBoosted,
          triagePriorityScore: correlation.triagePriorityScore,
          triagePriorityLabel: correlation.triagePriorityLabel,
          adaptedProtocol: correlation.adaptedProtocol,
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

      crew.sort((a, b) => a.triagePriorityScore - b.triagePriorityScore);

      const metrics = {
        totalCrew: crew.length,
        criticalCount: crew.filter((c) => c.status === HealthStatus.CRITICAL).length,
        warningCount: crew.filter((c) => c.status === HealthStatus.WARNING).length,
        nominalCount: crew.filter((c) => c.status === HealthStatus.OK).length,
      };

      const activeRadiationIncident =
        s3Active && radiationIncident
          ? {
              id: radiationIncident.id,
              title: radiationIncident.title,
              description: radiationIncident.description,
              severity: radiationIncident.severity,
              status: radiationIncident.status,
              stormScale,
              openedAt: radiationIncident.openedAt.toISOString(),
            }
          : s3Active
            ? {
                id: "storm-live",
                title: `Tormenta de radiación solar (${stormScale})`,
                description: "Tormenta solar >= S3 activa en telemetría.",
                severity: "CRITICAL",
                status: "OPEN",
                stormScale,
                openedAt: new Date().toISOString(),
              }
            : null;

      res.status(200).json({ crew, metrics, stormScale, activeRadiationIncident });
    } catch (error) {
      next(error);
    }
  };

  /** `GET /api/admin/astronauts/:id/directives` — Lists recent clinical directives issued to an astronaut. */
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

  /** `POST /api/admin/astronauts/:id/directives` — Persists and dispatches a flight-surgeon directive. */
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

