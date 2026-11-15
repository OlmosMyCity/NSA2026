import { Request, Response, NextFunction } from "express";
import { GetTriageOverviewUseCase } from "../../application/use-cases/admin/GetTriageOverviewUseCase.js";
import { SendClinicalDirectiveUseCase } from "../../application/use-cases/admin/SendClinicalDirectiveUseCase.js";
import { CreateUserByAdminUseCase } from "../../application/use-cases/admin/CreateUserByAdminUseCase.js";
import { AssignMissionOperatorUseCase } from "../../application/use-cases/admin/AssignMissionOperatorUseCase.js";
import {
  assignMissionOperatorSchema,
  createUserByAdminSchema,
  directivesSchema,
  parseWithValidation,
} from "../validation/schemas.js";

export class AdminTriageController {
  constructor(
    private readonly getTriageOverviewUseCase: GetTriageOverviewUseCase,
    private readonly sendClinicalDirectiveUseCase: SendClinicalDirectiveUseCase,
    private readonly createUserByAdminUseCase: CreateUserByAdminUseCase,
    private readonly assignMissionOperatorUseCase: AssignMissionOperatorUseCase
  ) {}

  getTriageOverview = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json(await this.getTriageOverviewUseCase.execute());
    } catch (error) {
      next(error);
    }
  };

  sendClinicalDirectives = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { directives } = parseWithValidation(directivesSchema, req.body ?? {});
      const { astronautName } = await this.sendClinicalDirectiveUseCase.execute(req.params.id, directives);

      res.status(200).json({
        success: true,
        message: `Directiva clínica transmitida exitosamente a la consola de ${astronautName}.`,
      });
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
