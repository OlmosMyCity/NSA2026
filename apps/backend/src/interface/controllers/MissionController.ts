/**
 * @module MissionController
 * HTTP controller handling mission CRUD operations while deriving creator identity from JWT claims.
 */

import { Request, Response, NextFunction } from "express";
import { ListMissionsUseCase } from "../../application/use-cases/mission/ListMissionsUseCase.js";
import { GetMissionByIdUseCase } from "../../application/use-cases/mission/GetMissionByIdUseCase.js";
import { CreateMissionUseCase } from "../../application/use-cases/mission/CreateMissionUseCase.js";
import { UpdateMissionUseCase } from "../../application/use-cases/mission/UpdateMissionUseCase.js";
import { DeleteMissionUseCase } from "../../application/use-cases/mission/DeleteMissionUseCase.js";
import { Environment, MissionStatus } from "@prisma/client";
import { UnauthorizedError } from "../../domain/errors/AppError.js";
import {
  createMissionSchema,
  parseWithValidation,
  updateMissionSchema,
} from "../validation/schemas.js";

/**
 * Controller exposing `/api/missions` REST endpoints.
 */
export class MissionController {
  constructor(
    private readonly listMissionsUseCase: ListMissionsUseCase,
    private readonly getMissionByIdUseCase: GetMissionByIdUseCase,
    private readonly createMissionUseCase: CreateMissionUseCase,
    private readonly updateMissionUseCase: UpdateMissionUseCase,
    private readonly deleteMissionUseCase: DeleteMissionUseCase
  ) {}

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

      const result = await this.listMissionsUseCase.execute({
        page,
        limit,
        environment: req.query.environment as Environment | undefined,
        status: req.query.status as MissionStatus | undefined,
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
      const mission = await this.getMissionByIdUseCase.execute(id);
      res.status(200).json(mission);
    } catch (error) {
      next(error);
    }
  };

  /** `POST /api/missions` — Creates a mission using `req.user.id` as the authoritative creator. */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Creator identity ALWAYS comes from the verified JWT (authenticate): never trust `createdById` from body.
      if (!req.user) throw new UnauthorizedError();
      const createdById = req.user.id;

      const payload = parseWithValidation(createMissionSchema, req.body ?? {});

      const mission = await this.createMissionUseCase.execute({
        name: payload.name,
        description: payload.description,
        environment: payload.environment,
        status: payload.status,
        startDate: payload.startDate,
        endDate: payload.endDate ?? null,
        patchUrl: payload.patchUrl ?? null,
        createdById,
      });

      res.status(201).json(mission);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const payload = parseWithValidation(updateMissionSchema, req.body ?? {});

      const mission = await this.updateMissionUseCase.execute(id, payload);

      res.status(200).json(mission);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.deleteMissionUseCase.execute(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

