/**
 * @module AstronautController
 * HTTP controller handling crew member CRUD operations and pagination query parsing.
 */

import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { ListAstronautsUseCase } from "../service/astronaut/ListAstronautsUseCase.js";
import { GetAstronautByIdUseCase } from "../service/astronaut/GetAstronautByIdUseCase.js";
import { CreateAstronautUseCase } from "../service/astronaut/CreateAstronautUseCase.js";
import { UpdateAstronautUseCase } from "../service/astronaut/UpdateAstronautUseCase.js";
import { DeleteAstronautUseCase } from "../service/astronaut/DeleteAstronautUseCase.js";
import { ManageFaceBiometricsUseCase } from "../service/astronaut/ManageFaceBiometricsUseCase.js";
import { IAstronautRepository } from "../repository/IAstronautRepository.js";
import { ForbiddenError } from "../exception/AppError.js";
import {
  createAstronautSchema,
  enrollFaceBiometricSchema,
  parseWithValidation,
  updateAstronautSchema,
} from "../dto/schemas.js";

/**
 * Controller exposing REST endpoints for `/api/astronauts`.
 */
export class AstronautController {
  constructor(
    private readonly listAstronautsUseCase: ListAstronautsUseCase,
    private readonly getAstronautByIdUseCase: GetAstronautByIdUseCase,
    private readonly createAstronautUseCase: CreateAstronautUseCase,
    private readonly updateAstronautUseCase: UpdateAstronautUseCase,
    private readonly deleteAstronautUseCase: DeleteAstronautUseCase,
    private readonly astronautRepo?: IAstronautRepository,
    private readonly faceBiometricsUseCase?: ManageFaceBiometricsUseCase
  ) {}

  private async assertSameMissionOrAdmin(req: Request, targetAstronautId: string): Promise<void> {
    if (!req.user || req.user.role === Role.ADMIN) return;
    if (!this.astronautRepo?.findByUserId || !this.astronautRepo?.findById) {
      throw new ForbiddenError("You do not have permission to modify this profile.");
    }
    const [ownAstro, targetAstro] = await Promise.all([
      this.astronautRepo.findByUserId(req.user.id),
      this.astronautRepo.findById(targetAstronautId),
    ]);
    if (!ownAstro || !targetAstro || ownAstro.missionId !== targetAstro.missionId) {
      throw new ForbiddenError("You can only manage profiles and biometrics for crewmates in your own mission.");
    }
  }

  /** `GET /api/astronauts` — Lists paginated astronauts with optional `missionId` and `search` filters. */
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

      const result = await this.listAstronautsUseCase.execute({
        page,
        limit,
        missionId: req.query.missionId as string | undefined,
        search: req.query.search as string | undefined,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const astronaut = await this.getAstronautByIdUseCase.execute(id);
      res.status(200).json(astronaut);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = parseWithValidation(createAstronautSchema, req.body ?? {});

      const astronaut = await this.createAstronautUseCase.execute({
        name: payload.name,
        role: payload.role,
        age: payload.age,
        missionId: payload.missionId,
        userId: payload.userId ?? null,
        photoUrl: payload.photoUrl ?? null,
      });

      res.status(201).json(astronaut);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.assertSameMissionOrAdmin(req, id);
      const payload = parseWithValidation(updateAstronautSchema, req.body ?? {});

      const astronaut = await this.updateAstronautUseCase.execute(id, payload);

      res.status(200).json(astronaut);
    } catch (error) {
      next(error);
    }
  };

  listBiometrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.faceBiometricsUseCase) {
        res.status(501).json({ error: "Facial biometrics unavailable." });
        return;
      }
      const { id } = req.params;
      const samples = await this.faceBiometricsUseCase.listByAstronaut(id);
      res.status(200).json({ data: samples });
    } catch (error) {
      next(error);
    }
  };

  getBiometricGallery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.faceBiometricsUseCase) {
        res.status(501).json({ error: "Facial biometrics unavailable." });
        return;
      }
      let missionId = req.query.missionId as string | undefined;
      if (!missionId && req.user && req.user.role === Role.USER && this.astronautRepo?.findByUserId) {
        const ownAstro = await this.astronautRepo.findByUserId(req.user.id);
        missionId = ownAstro?.missionId;
      }
      const profiles = await this.faceBiometricsUseCase.getGallery(missionId);
      res.status(200).json({ data: profiles });
    } catch (error) {
      next(error);
    }
  };

  enrollBiometric = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.faceBiometricsUseCase) {
        res.status(501).json({ error: "Facial biometrics unavailable." });
        return;
      }
      const { id } = req.params;
      await this.assertSameMissionOrAdmin(req, id);
      const payload = parseWithValidation(enrollFaceBiometricSchema, req.body ?? {});

      const sample = await this.faceBiometricsUseCase.enrollSample({
        astronautId: id,
        imageUrl: payload.imageUrl as string,
        label: payload.label ?? null,
        embedding: payload.embedding,
        qualityScore: payload.qualityScore,
        uploadedById: req.user?.id ?? null,
      });

      res.status(201).json(sample);
    } catch (error) {
      next(error);
    }
  };

  deleteBiometric = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.faceBiometricsUseCase) {
        res.status(501).json({ error: "Facial biometrics unavailable." });
        return;
      }
      const { id, sampleId } = req.params;
      await this.assertSameMissionOrAdmin(req, id);
      await this.faceBiometricsUseCase.deleteSample(id, sampleId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.deleteAstronautUseCase.execute(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

