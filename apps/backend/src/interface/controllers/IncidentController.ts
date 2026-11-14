import { Request, Response, NextFunction } from "express";
import { IncidentCategory, IncidentSeverity, IncidentStatus, Role } from "@prisma/client";
import { ListIncidentsUseCase } from "../../application/use-cases/incident/ListIncidentsUseCase.js";
import { GetIncidentByIdUseCase } from "../../application/use-cases/incident/GetIncidentByIdUseCase.js";
import { OpenIncidentUseCase } from "../../application/use-cases/incident/OpenIncidentUseCase.js";
import { AcknowledgeIncidentUseCase } from "../../application/use-cases/incident/AcknowledgeIncidentUseCase.js";
import { CloseIncidentUseCase } from "../../application/use-cases/incident/CloseIncidentUseCase.js";
import { IAstronautRepository } from "../../domain/repository/IAstronautRepository.js";
import { ForbiddenError } from "../../domain/errors/AppError.js";
import { listMedicalProtocols } from "../../application/health/medicalProtocols.js";
import { closeIncidentSchema, openIncidentSchema, parseWithValidation } from "../validation/schemas.js";

export class IncidentController {
  constructor(
    private readonly listIncidentsUseCase: ListIncidentsUseCase,
    private readonly getIncidentByIdUseCase: GetIncidentByIdUseCase,
    private readonly openIncidentUseCase: OpenIncidentUseCase,
    private readonly acknowledgeIncidentUseCase: AcknowledgeIncidentUseCase,
    private readonly closeIncidentUseCase: CloseIncidentUseCase,
    private readonly astronautRepo?: IAstronautRepository
  ) {}

  private async resolveOwnAstronautId(req: Request): Promise<string | null> {
    if (!req.user || !this.astronautRepo?.findByUserId) return null;
    const astro = await this.astronautRepo.findByUserId(req.user.id);
    return astro?.id ?? null;
  }

  listProtocols = (_req: Request, res: Response): void => {
    res.status(200).json({ data: listMedicalProtocols() });
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      if (isNaN(page) || page <= 0 || isNaN(limit) || limit <= 0) {
        res.status(400).json({
          error: "Los parámetros de paginación 'page' y 'limit' deben ser números enteros positivos.",
        });
        return;
      }

      let astronautIdFilter = req.query.astronautId as string | undefined;
      let includeGlobal = false;
      let globalOnly = false;

      if (req.user && req.user.role !== Role.ADMIN) {
        const ownAstronautId = await this.resolveOwnAstronautId(req);
        if (astronautIdFilter && astronautIdFilter !== ownAstronautId) {
          throw new ForbiddenError("No tienes permiso para consultar incidentes de otro tripulante.");
        }
        if (ownAstronautId) {
          astronautIdFilter = ownAstronautId;
          includeGlobal = true;
        } else {
          astronautIdFilter = undefined;
          globalOnly = true;
        }
      }

      const result = await this.listIncidentsUseCase.execute({
        page,
        limit,
        status: req.query.status as IncidentStatus | undefined,
        category: req.query.category as IncidentCategory | undefined,
        severity: req.query.severity as IncidentSeverity | undefined,
        astronautId: astronautIdFilter,
        includeGlobal,
        globalOnly,
        missionId: req.query.missionId as string | undefined,
        type: req.query.type as string | undefined,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const incident = await this.getIncidentByIdUseCase.execute(req.params.id);

      if (req.user && req.user.role !== Role.ADMIN && incident.astronautId) {
        const ownAstronautId = await this.resolveOwnAstronautId(req);
        if (!ownAstronautId || incident.astronautId !== ownAstronautId) {
          throw new ForbiddenError("No tienes permiso para consultar incidentes de otro tripulante.");
        }
      }

      res.status(200).json(incident);
    } catch (error) {
      next(error);
    }
  };

  open = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = parseWithValidation(openIncidentSchema, req.body ?? {});
      const { incident, created } = await this.openIncidentUseCase.execute({
        ...payload,
        metadata: payload.metadata as Record<string, unknown> | undefined as never,
      });
      res.status(created ? 201 : 200).json({ ...incident, created });
    } catch (error) {
      next(error);
    }
  };

  acknowledge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user && req.user.role !== Role.ADMIN) {
        const existing = await this.getIncidentByIdUseCase.execute(req.params.id);
        if (existing.astronautId) {
          const ownAstronautId = await this.resolveOwnAstronautId(req);
          if (!ownAstronautId || existing.astronautId !== ownAstronautId) {
            throw new ForbiddenError("No tienes permiso para confirmar incidentes de otro tripulante.");
          }
        }
      }

      const incident = await this.acknowledgeIncidentUseCase.execute({
        id: req.params.id,
        userId: req.user!.id,
      });
      res.status(200).json(incident);
    } catch (error) {
      next(error);
    }
  };

  close = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { resolutionNotes } = parseWithValidation(closeIncidentSchema, req.body ?? {});
      const incident = await this.closeIncidentUseCase.execute({
        id: req.params.id,
        userId: req.user!.id,
        resolutionNotes,
      });
      res.status(200).json(incident);
    } catch (error) {
      next(error);
    }
  };
}
