import { Request, Response, NextFunction } from "express";
import { GetTriageOverviewUseCase } from "../../application/use-cases/admin/GetTriageOverviewUseCase.js";
import { SendClinicalDirectiveUseCase } from "../../application/use-cases/admin/SendClinicalDirectiveUseCase.js";
import { directivesSchema, parseWithValidation } from "../validation/schemas.js";

export class AdminTriageController {
  constructor(
    private readonly getTriageOverviewUseCase: GetTriageOverviewUseCase,
    private readonly sendClinicalDirectiveUseCase: SendClinicalDirectiveUseCase
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
}
