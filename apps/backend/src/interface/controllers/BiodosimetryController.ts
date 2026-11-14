import { NextFunction, Request, Response } from "express";
import {
  BiodosimetryTriageUseCase,
  ShieldingType,
} from "../../application/use-cases/health/BiodosimetryTriageUseCase.js";

const VALID_SHIELDING: ReadonlySet<string> = new Set([
  "EVA_SUIT",
  "CREW_CABIN_NOMINAL",
  "STORM_SHELTER",
]);

export class BiodosimetryController {
  constructor(private readonly triageUseCase: BiodosimetryTriageUseCase) {}

  triage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { astronautId, shieldingType, healthReading, radiationState, biomarkers } =
        req.body ?? {};

      if (shieldingType !== undefined && !VALID_SHIELDING.has(shieldingType)) {
        res.status(400).json({
          error: "shieldingType inválido. Valores permitidos: EVA_SUIT, CREW_CABIN_NOMINAL, STORM_SHELTER.",
        });
        return;
      }

      const result = await this.triageUseCase.execute({
        astronautId,
        requestingUserId: req.user?.id,
        requestingUserRole: req.user?.role,
        shieldingType: shieldingType as ShieldingType | undefined,
        healthReading,
        radiationState,
        biomarkers,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
