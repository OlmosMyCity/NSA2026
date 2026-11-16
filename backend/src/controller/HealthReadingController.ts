/**
 * @module HealthReadingController
 * HTTP controller for astronaut vital-sign readings, multi-system health summaries,
 * and edge computer-vision / rPPG telemetry ingestion. Enforces crew-member self-access
 * for `USER` accounts while granting full fleet access to `ADMIN` flight surgeons.
 */

import { Request, Response, NextFunction } from "express";
import { ListHealthReadingsUseCase } from "../service/health/ListHealthReadingsUseCase.js";
import { GetHealthReadingByIdUseCase } from "../service/health/GetHealthReadingByIdUseCase.js";
import { CreateHealthReadingUseCase } from "../service/health/CreateHealthReadingUseCase.js";
import { InvalidateHealthReadingUseCase } from "../service/health/InvalidateHealthReadingUseCase.js";
import { CorrectHealthReadingUseCase } from "../service/health/CorrectHealthReadingUseCase.js";
import { GetAstronautHealthSummaryUseCase } from "../service/health/GetAstronautHealthSummaryUseCase.js";
import { IngestVisionTelemetryUseCase } from "../service/health/IngestVisionTelemetryUseCase.js";
import { IAstronautRepository } from "../repository/IAstronautRepository.js";
import { ForbiddenError } from "../exception/AppError.js";
import { HealthStatus, Role } from "@prisma/client";
import {
  correctHealthReadingSchema,
  createHealthReadingSchema,
  invalidateHealthReadingSchema,
  parseWithValidation,
  visionIngestSchema,
} from "../dto/schemas.js";

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

  private async resolveOwnAstronaut(req: Request): Promise<{ id: string; missionId?: string } | null> {
    if (!req.user || !this.astronautRepo?.findByUserId) return null;
    const astro = await this.astronautRepo.findByUserId(req.user.id);
    if (!astro) return null;
    return { id: astro.id, missionId: astro.missionId };
  }

  private async resolveOwnAstronautId(req: Request): Promise<string | null> {
    const astro = await this.resolveOwnAstronaut(req);
    return astro?.id ?? null;
  }

  /**
   * Regla de negocio: cualquier tripulante de la misma misión puede registrar o ingestar
   * mediciones para un compañero de su misión (p. ej. asistencia en cabina/EVA), y ADMIN para todos.
   */
  private async assertCanRecordForAstronaut(req: Request, targetAstronautId: string, action: string): Promise<void> {
    if (!req.user || req.user.role === Role.ADMIN) return;
    const ownAstro = await this.resolveOwnAstronaut(req);
    if (!ownAstro) {
      throw new ForbiddenError(`You do not have permission to ${action} measurements for another crewmember.`);
    }
    if (ownAstro.id === targetAstronautId) return;

    if (ownAstro.missionId && this.astronautRepo?.findById) {
      const targetAstro = await this.astronautRepo.findById(targetAstronautId);
      if (targetAstro && targetAstro.missionId === ownAstro.missionId) {
        return;
      }
    }

    throw new ForbiddenError(`You do not have permission to ${action} measurements for a crewmember on another mission.`);
  }

  /** Un tripulante solo actúa sobre sus propias lecturas; el Flight Surgeon (ADMIN) sobre todas. */
  private async assertCanActOnReading(req: Request, readingId: string, action: string): Promise<void> {
    if (!req.user || req.user.role === Role.ADMIN) return;
    const reading = await this.getHealthReadingByIdUseCase.execute(readingId);
    const ownAstronautId = await this.resolveOwnAstronautId(req);
    if (!ownAstronautId || reading.astronautId !== ownAstronautId) {
      throw new ForbiddenError(`You do not have permission to ${action} measurements for another crewmember.`);
    }
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      if (isNaN(page) || page <= 0 || isNaN(limit) || limit <= 0) {
        res.status(400).json({
          error: "Pagination parameters 'page' and 'limit' must be positive integers.",
        });
        return;
      }

      let fromDate: Date | undefined;
      let toDate: Date | undefined;

      if (req.query.from) {
        fromDate = new Date(req.query.from as string);
        if (isNaN(fromDate.getTime())) {
          res.status(400).json({ error: "Filter parameter 'from' is not a valid date." });
          return;
        }
      }

      if (req.query.to) {
        toDate = new Date(req.query.to as string);
        if (isNaN(toDate.getTime())) {
          res.status(400).json({ error: "Filter parameter 'to' is not a valid date." });
          return;
        }
      }

      let astronautIdFilter = req.query.astronautId as string | undefined;

      // Astronauts (USER) may only inspect their own medical history
      if (req.user && req.user.role !== Role.ADMIN) {
        const ownAstronautId = await this.resolveOwnAstronautId(req);
        if (astronautIdFilter && astronautIdFilter !== ownAstronautId) {
          throw new ForbiddenError("You do not have permission to view another crewmember's medical history.");
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
          throw new ForbiddenError("You do not have permission to view another crewmember's measurements.");
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

      await this.assertCanRecordForAstronaut(req, payload.astronautId, "record");

      const reading = await this.createHealthReadingUseCase.execute({
        ...payload,
        takenAt: payload.takenAt ?? undefined,
        recordedById: req.user?.id ?? null,
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
          "Health records cannot be edited or deleted. Use POST /api/readings/:id/invalidate or POST /api/readings/:id/corrections.",
      });
  };

  invalidate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.assertCanActOnReading(req, id, "invalidate");
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
        res.status(501).json({ error: "Operation unavailable." });
        return;
      }
      const { id } = req.params;
      await this.assertCanActOnReading(req, id, "correct");
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
          throw new ForbiddenError("You do not have permission to view another crewmember's clinical summary.");
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
        res.status(501).json({ error: "Vision ingestion unavailable." });
        return;
      }

      const payload = parseWithValidation(visionIngestSchema, req.body ?? {});

      await this.assertCanRecordForAstronaut(req, payload.astronautId, "record telemetry");

      const result = await this.ingestVisionTelemetryUseCase.execute({
        ...payload,
        takenAt: payload.takenAt ?? undefined,
        recordedById: req.user?.id ?? null,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };
}
