/**
 * @module HealthReadingController
 * HTTP controller for astronaut vital-sign readings, multi-system health summaries,
 * and edge computer-vision / rPPG telemetry ingestion. Enforces crew-member self-access
 * for `USER` accounts while granting full fleet access to `ADMIN` flight surgeons.
 */

import { Request, Response, NextFunction } from "express";
import { ListHealthReadingsUseCase } from "../../application/use-cases/health/ListHealthReadingsUseCase.js";
import { GetHealthReadingByIdUseCase } from "../../application/use-cases/health/GetHealthReadingByIdUseCase.js";
import { CreateHealthReadingUseCase } from "../../application/use-cases/health/CreateHealthReadingUseCase.js";
import { InvalidateHealthReadingUseCase } from "../../application/use-cases/health/InvalidateHealthReadingUseCase.js";
import { CorrectHealthReadingUseCase } from "../../application/use-cases/health/CorrectHealthReadingUseCase.js";
import { GetAstronautHealthSummaryUseCase } from "../../application/use-cases/health/GetAstronautHealthSummaryUseCase.js";
import { IngestVisionTelemetryUseCase } from "../../application/use-cases/health/IngestVisionTelemetryUseCase.js";
import { IAstronautRepository } from "../../domain/repository/IAstronautRepository.js";
import { ForbiddenError } from "../../domain/errors/AppError.js";
import { HealthStatus, Role } from "@prisma/client";
import {
  correctHealthReadingSchema,
  createHealthReadingSchema,
  invalidateHealthReadingSchema,
  parseWithValidation,
  visionIngestSchema,
} from "../validation/schemas.js";

/**
 * Controller backing `/api/readings` and `GET /api/astronauts/:id/summary`.
 */
export class HealthReadingController {
  constructor(
    private readonly listHealthReadingsUseCase: ListHealthReadingsUseCase,
    private readonly getHealthReadingByIdUseCase: GetHealthReadingByIdUseCase,
    private readonly createHealthReadingUseCase: CreateHealthReadingUseCase,
    private readonly invalidateHealthReadingUseCase: InvalidateHealthReadingUseCase,
    private readonly getAstronautHealthSummaryUseCase: GetAstronautHealthSummaryUseCase,
    private readonly correctHealthReadingUseCase?: CorrectHealthReadingUseCase,
    private readonly astronautRepo?: IAstronautRepository,
    private readonly ingestVisionTelemetryUseCase?: IngestVisionTelemetryUseCase
  ) {}

  private async resolveOwnAstronautId(req: Request): Promise<string | null> {
    if (!req.user || !this.astronautRepo?.findByUserId) return null;
    const astro = await this.astronautRepo.findByUserId(req.user.id);
    return astro?.id ?? null;
  }

  /** Un tripulante solo actúa sobre sus propias lecturas; el Flight Surgeon (ADMIN) sobre todas. */
  private async assertCanActOnReading(req: Request, readingId: string, action: string): Promise<void> {
    if (!req.user || req.user.role === Role.ADMIN) return;
    const reading = await this.getHealthReadingByIdUseCase.execute(readingId);
    const ownAstronautId = await this.resolveOwnAstronautId(req);
    if (!ownAstronautId || reading.astronautId !== ownAstronautId) {
      throw new ForbiddenError(`No tienes permiso para ${action} mediciones de otro tripulante.`);
    }
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      if (isNaN(page) || page <= 0 || isNaN(limit) || limit <= 0) {
        res.status(400).json({
          error: "Los parámetros de paginación 'page' y 'limit' deben ser números enteros positivos.",
        });
        return;
      }

      let fromDate: Date | undefined;
      let toDate: Date | undefined;

      if (req.query.from) {
        fromDate = new Date(req.query.from as string);
        if (isNaN(fromDate.getTime())) {
          res.status(400).json({ error: "El parámetro de filtro 'from' no es una fecha válida." });
          return;
        }
      }

      if (req.query.to) {
        toDate = new Date(req.query.to as string);
        if (isNaN(toDate.getTime())) {
          res.status(400).json({ error: "El parámetro de filtro 'to' no es una fecha válida." });
          return;
        }
      }

      let astronautIdFilter = req.query.astronautId as string | undefined;

      // Astronauts (USER) may only inspect their own medical history
      if (req.user && req.user.role !== Role.ADMIN) {
        const ownAstronautId = await this.resolveOwnAstronautId(req);
        if (astronautIdFilter && astronautIdFilter !== ownAstronautId) {
          throw new ForbiddenError("No tienes permiso para consultar el historial médico de otro tripulante.");
        }
        if (!ownAstronautId) {
          res.status(200).json({
            data: [],
            pagination: { total: 0, currentPage: page, limit, totalPages: 1 },
          });
          return;
        }
        astronautIdFilter = ownAstronautId;
      }

      const result = await this.listHealthReadingsUseCase.execute({
        page,
        limit,
        astronautId: astronautIdFilter,
        status: req.query.status as HealthStatus | undefined,
        from: fromDate,
        to: toDate,
        includeInvalid: req.query.includeInvalid === "true",
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const reading = await this.getHealthReadingByIdUseCase.execute(id);

      if (req.user && req.user.role !== Role.ADMIN) {
        const ownAstronautId = await this.resolveOwnAstronautId(req);
        if (!ownAstronautId || reading.astronautId !== ownAstronautId) {
          throw new ForbiddenError("No tienes permiso para consultar mediciones de otro tripulante.");
        }
      }

      res.status(200).json(reading);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = parseWithValidation(createHealthReadingSchema, req.body ?? {});

      if (req.user && req.user.role !== Role.ADMIN) {
        const ownAstronautId = await this.resolveOwnAstronautId(req);
        if (!ownAstronautId || payload.astronautId !== ownAstronautId) {
          throw new ForbiddenError("No tienes permiso para registrar mediciones de otro tripulante.");
        }
      }

      const reading = await this.createHealthReadingUseCase.execute({
        ...payload,
        takenAt: payload.takenAt ?? undefined,
      });

      res.status(201).json(reading);
    } catch (error) {
      next(error);
    }
  };

  /** P1: PUT y DELETE ya no existen; se responde 405 explicando la alternativa. */
  methodNotAllowed = (_req: Request, res: Response): void => {
    res
      .status(405)
      .set("Allow", "GET")
      .json({
        error:
          "Los datos de salud no se editan ni se borran. Use POST /api/readings/:id/invalidate o POST /api/readings/:id/corrections.",
      });
  };

  invalidate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.assertCanActOnReading(req, id, "invalidar");
      const { reason } = parseWithValidation(invalidateHealthReadingSchema, req.body ?? {});
      const reading = await this.invalidateHealthReadingUseCase.execute(id, reason, req.user?.id ?? null);
      res.status(200).json(reading);
    } catch (error) {
      next(error);
    }
  };

  correct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.correctHealthReadingUseCase) {
        res.status(501).json({ error: "Operación no disponible." });
        return;
      }
      const { id } = req.params;
      await this.assertCanActOnReading(req, id, "corregir");
      const payload = parseWithValidation(correctHealthReadingSchema, req.body ?? {});
      const corrected = await this.correctHealthReadingUseCase.execute(
        id,
        { ...payload, takenAt: payload.takenAt ?? undefined },
        req.user?.id ?? null
      );
      res.status(201).json(corrected);
    } catch (error) {
      next(error);
    }
  };

  /** `GET /api/astronauts/:id/summary` — Returns multi-system clinical summary and 7-day history. */
  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params; // Target astronautId

      if (req.user && req.user.role !== Role.ADMIN) {
        const ownAstronautId = await this.resolveOwnAstronautId(req);
        if (!ownAstronautId || id !== ownAstronautId) {
          throw new ForbiddenError("No tienes permiso para consultar el resumen clínico de otro tripulante.");
        }
      }

      const summary = await this.getAstronautHealthSummaryUseCase.execute(id);
      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  };

  ingestVision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.ingestVisionTelemetryUseCase) {
        res.status(501).json({ error: "Ingesta de visión no disponible." });
        return;
      }

      const payload = parseWithValidation(visionIngestSchema, req.body ?? {});

      if (req.user && req.user.role !== Role.ADMIN) {
        const ownAstronautId = await this.resolveOwnAstronautId(req);
        if (!ownAstronautId || payload.astronautId !== ownAstronautId) {
          throw new ForbiddenError("No tienes permiso para registrar telemetría de otro tripulante.");
        }
      }

      const result = await this.ingestVisionTelemetryUseCase.execute({
        ...payload,
        takenAt: payload.takenAt ?? undefined,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };
}
