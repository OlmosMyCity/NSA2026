/**
 * @module BiodosimetryController
 * HTTP controller for biodosimetry acute radiation triage evaluation.
 */

import { NextFunction, Request, Response } from "express";
import {
  BiodosimetryTriageUseCase,
  ShieldingType,
} from "../../application/use-cases/health/BiodosimetryTriageUseCase.js";
import { biodosimetryTriageSchema, parseWithValidation } from "../validation/schemas.js";

/**
 * Controller handling `/api/biodosimetry-triage` requests combining shielding posture,
 * vital signs, space-weather telemetry, and molecular biodosimetry biomarkers.
 */
export class BiodosimetryController {
  constructor(private readonly triageUseCase: BiodosimetryTriageUseCase) {}

  /** Validates the triage payload and delegates radiation-dose/clinical triage evaluation. */
  triage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { astronautId, shieldingType, healthReading, radiationState, biomarkers } =
        parseWithValidation(biodosimetryTriageSchema, req.body ?? {});

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
