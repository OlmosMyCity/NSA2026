/**
 * @module AdminTriageController
 * HTTP controller for Flight Surgeon administrative triage console endpoints:
 * crew-wide clinical prioritization correlated with solar storm telemetry and clinical directives.
 */

import { Request, Response, NextFunction } from "express";
import { GetTriageOverviewUseCase } from "../service/admin/GetTriageOverviewUseCase.js";
import {
  ListAstronautDirectivesUseCase,
  SendClinicalDirectiveUseCase,
} from "../service/admin/SendClinicalDirectiveUseCase.js";
import { CreateUserByAdminUseCase } from "../service/admin/CreateUserByAdminUseCase.js";
import { AssignMissionOperatorUseCase } from "../service/admin/AssignMissionOperatorUseCase.js";
import { IOperatorCrewRepository } from "../repository/IOperatorCrewRepository.js";
import {
  assignMissionOperatorSchema,
  createUserByAdminSchema,
  directivesSchema,
  parseWithValidation,
} from "../dto/schemas.js";

/**
 * Controller backing `/api/admin` triage overview and crew directive dispatch routes.
 */
export class AdminTriageController {
  constructor(
    private readonly getTriageOverviewUseCase: GetTriageOverviewUseCase,
    private readonly sendClinicalDirectiveUseCase: SendClinicalDirectiveUseCase,
    private readonly listAstronautDirectivesUseCase: ListAstronautDirectivesUseCase,
    private readonly createUserByAdminUseCase: CreateUserByAdminUseCase,
    private readonly assignMissionOperatorUseCase: AssignMissionOperatorUseCase,
    private readonly operatorCrewRepo: IOperatorCrewRepository
  ) {}

  /**
   * `GET /api/admin/triage` — Aggregates latest vitals and directives for all active crew,
   * correlates each astronaut's clinical status against the active NOAA storm scale (`>= S3` escalation),
   * and returns the crew sorted by ascending triage priority score alongside fleet metrics.
   */
  getTriageOverview = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json(await this.getTriageOverviewUseCase.execute());
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
      res.status(200).json({ data: await this.listAstronautDirectivesUseCase.execute(req.params.id) });
    } catch (error) {
      next(error);
    }
  };

  /** `POST /api/admin/astronauts/:id/directives` — Persists and dispatches a flight-surgeon directive. */
  sendClinicalDirectives = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { directives, incidentId } = parseWithValidation(directivesSchema, req.body ?? {});
      const { astronautName, directive } = await this.sendClinicalDirectiveUseCase.execute({
        astronautId: req.params.id,
        content: directives,
        issuedById: req.user?.id ?? null,
        incidentId: incidentId ?? null,
      });

      res.status(201).json({
        success: true,
        directive,
        message: `Directiva clínica transmitida exitosamente a la consola de ${astronautName}.`,
      });
    } catch (error) {
      next(error);
    }
  };

  listOperatorAccess = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json(await this.operatorCrewRepo.listOperatorAccess());
    } catch (error) {
      next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = parseWithValidation(createUserByAdminSchema, req.body ?? {});
      res.status(201).json(await this.createUserByAdminUseCase.execute(input));
    } catch (error) {
      next(error);
    }
  };

  assignMissionOperator = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { operatorId } = parseWithValidation(assignMissionOperatorSchema, req.body ?? {});
      await this.assignMissionOperatorUseCase.execute(req.params.id, operatorId);
      res.status(200).json({ missionId: req.params.id, operatorId });
    } catch (error) {
      next(error);
    }
  };
}
