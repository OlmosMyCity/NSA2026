import { Request, Response, NextFunction } from "express";
import { ListHealthReadingsUseCase } from "../../application/use-cases/health/ListHealthReadingsUseCase.js";
import { GetHealthReadingByIdUseCase } from "../../application/use-cases/health/GetHealthReadingByIdUseCase.js";
import { CreateHealthReadingUseCase } from "../../application/use-cases/health/CreateHealthReadingUseCase.js";
import { UpdateHealthReadingUseCase } from "../../application/use-cases/health/UpdateHealthReadingUseCase.js";
import { DeleteHealthReadingUseCase } from "../../application/use-cases/health/DeleteHealthReadingUseCase.js";
import { GetAstronautHealthSummaryUseCase } from "../../application/use-cases/health/GetAstronautHealthSummaryUseCase.js";
import { IAstronautRepository } from "../../domain/repository/IAstronautRepository.js";
import { ForbiddenError } from "../../domain/errors/AppError.js";
import { HealthStatus, Role } from "@prisma/client";

export class HealthReadingController {
  constructor(
    private readonly listHealthReadingsUseCase: ListHealthReadingsUseCase,
    private readonly getHealthReadingByIdUseCase: GetHealthReadingByIdUseCase,
    private readonly createHealthReadingUseCase: CreateHealthReadingUseCase,
    private readonly deleteHealthReadingUseCase: DeleteHealthReadingUseCase,
    private readonly getAstronautHealthSummaryUseCase: GetAstronautHealthSummaryUseCase,
    private readonly updateHealthReadingUseCase?: UpdateHealthReadingUseCase,
    private readonly astronautRepo?: IAstronautRepository
  ) {}

  private async resolveOwnAstronautId(req: Request): Promise<string | null> {
    if (!req.user || !this.astronautRepo?.findByUserId) return null;
    const astro = await this.astronautRepo.findByUserId(req.user.id);
    return astro?.id ?? null;
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

      // Los astronautas (USER) solo pueden consultar su propio historial médico
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
      const {
        astronautId,
        heartRateBpm,
        systolicMmHg,
        diastolicMmHg,
        glucoseMgDl,
        temperatureC,
        spo2Pct,
        sleepHours,
        mood,
        notes,
        takenAt,
      } = req.body ?? {};

      if (
        !astronautId ||
        heartRateBpm === undefined ||
        systolicMmHg === undefined ||
        diastolicMmHg === undefined ||
        glucoseMgDl === undefined ||
        temperatureC === undefined ||
        spo2Pct === undefined ||
        sleepHours === undefined ||
        mood === undefined
      ) {
        res.status(400).json({
          error:
            "Todos los 7 indicadores vitales ('heartRateBpm', 'systolicMmHg', 'diastolicMmHg', 'glucoseMgDl', 'temperatureC', 'spo2Pct', 'sleepHours', 'mood') y el 'astronautId' son obligatorios.",
        });
        return;
      }

      const reading = await this.createHealthReadingUseCase.execute({
        astronautId,
        heartRateBpm: Number(heartRateBpm),
        systolicMmHg: Number(systolicMmHg),
        diastolicMmHg: Number(diastolicMmHg),
        glucoseMgDl: Number(glucoseMgDl),
        temperatureC: Number(temperatureC),
        spo2Pct: Number(spo2Pct),
        sleepHours: Number(sleepHours),
        mood: Number(mood),
        notes,
        takenAt: takenAt ? new Date(takenAt) : undefined,
      });

      res.status(201).json(reading);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.updateHealthReadingUseCase) {
        res.status(501).json({ error: "Operación no disponible." });
        return;
      }
      const { id } = req.params;

      if (req.user && req.user.role !== Role.ADMIN) {
        const reading = await this.getHealthReadingByIdUseCase.execute(id);
        const ownAstronautId = await this.resolveOwnAstronautId(req);
        if (!ownAstronautId || reading.astronautId !== ownAstronautId) {
          throw new ForbiddenError("No tienes permiso para modificar mediciones de otro tripulante.");
        }
      }

      const {
        heartRateBpm,
        systolicMmHg,
        diastolicMmHg,
        glucoseMgDl,
        temperatureC,
        spo2Pct,
        sleepHours,
        mood,
        notes,
        recommendation,
        takenAt,
      } = req.body ?? {};

      const updated = await this.updateHealthReadingUseCase.execute(id, {
        heartRateBpm: heartRateBpm !== undefined ? Number(heartRateBpm) : undefined,
        systolicMmHg: systolicMmHg !== undefined ? Number(systolicMmHg) : undefined,
        diastolicMmHg: diastolicMmHg !== undefined ? Number(diastolicMmHg) : undefined,
        glucoseMgDl: glucoseMgDl !== undefined ? Number(glucoseMgDl) : undefined,
        temperatureC: temperatureC !== undefined ? Number(temperatureC) : undefined,
        spo2Pct: spo2Pct !== undefined ? Number(spo2Pct) : undefined,
        sleepHours: sleepHours !== undefined ? Number(sleepHours) : undefined,
        mood: mood !== undefined ? Number(mood) : undefined,
        notes,
        recommendation,
        takenAt: takenAt ? new Date(takenAt) : undefined,
      });

      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (req.user && req.user.role !== Role.ADMIN) {
        const reading = await this.getHealthReadingByIdUseCase.execute(id);
        const ownAstronautId = await this.resolveOwnAstronautId(req);
        if (!ownAstronautId || reading.astronautId !== ownAstronautId) {
          throw new ForbiddenError("No tienes permiso para eliminar mediciones de otro tripulante.");
        }
      }

      await this.deleteHealthReadingUseCase.execute(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params; // astronautId

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
}
