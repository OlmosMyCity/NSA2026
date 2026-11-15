import { Request, Response, NextFunction } from "express";
import { GetOperatorCrewOverviewUseCase } from "../../application/use-cases/operator/GetOperatorCrewOverviewUseCase.js";
import {
  GetCrewLocationUseCase,
  UpdateCrewLocationUseCase,
} from "../../application/use-cases/operator/UpdateCrewLocationUseCase.js";
import { UnauthorizedError } from "../../domain/errors/AppError.js";
import { crewLocationSchema, parseWithValidation } from "../validation/schemas.js";

export class OperatorController {
  constructor(
    private readonly getOperatorCrewOverviewUseCase: GetOperatorCrewOverviewUseCase,
    private readonly updateCrewLocationUseCase: UpdateCrewLocationUseCase,
    private readonly getCrewLocationUseCase: GetCrewLocationUseCase
  ) {}

  getLocation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      res.status(200).json(
        await this.getCrewLocationUseCase.execute(req.params.id, { id: req.user.id, role: req.user.role })
      );
    } catch (error) {
      next(error);
    }
  };

  getCrewOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      res.status(200).json(await this.getOperatorCrewOverviewUseCase.execute(req.user.id));
    } catch (error) {
      next(error);
    }
  };

  updateLocation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const { location } = parseWithValidation(crewLocationSchema, req.body ?? {});
      const result = await this.updateCrewLocationUseCase.execute({
        astronautId: req.params.id,
        location,
        requester: { id: req.user.id, role: req.user.role },
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
