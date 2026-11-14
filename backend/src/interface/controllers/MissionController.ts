import { Request, Response, NextFunction } from "express";
import { ListMissionsUseCase } from "../../application/use-cases/mission/ListMissionsUseCase.js";
import { GetMissionByIdUseCase } from "../../application/use-cases/mission/GetMissionByIdUseCase.js";
import { CreateMissionUseCase } from "../../application/use-cases/mission/CreateMissionUseCase.js";
import { UpdateMissionUseCase } from "../../application/use-cases/mission/UpdateMissionUseCase.js";
import { DeleteMissionUseCase } from "../../application/use-cases/mission/DeleteMissionUseCase.js";
import { Environment, MissionStatus } from "@prisma/client";
import { UnauthorizedError } from "../../domain/errors/AppError.js";

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

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, description, environment, status, startDate, endDate, patchUrl } = req.body;

      if (!name || !description || !startDate) {
        res.status(400).json({
          error: "Campos requeridos faltantes: 'name', 'description' y 'startDate' son obligatorios.",
        });
        return;
      }

      const parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        res.status(400).json({ error: "El formato de 'startDate' no es una fecha válida." });
        return;
      }

      // El creador sale SIEMPRE del JWT (authenticate): nunca se acepta `createdById` desde el body.
      if (!req.user) throw new UnauthorizedError();
      const createdById = req.user.id;

      const mission = await this.createMissionUseCase.execute({
        name,
        description,
        environment,
        status,
        startDate: parsedStartDate,
        endDate: endDate ? new Date(endDate) : null,
        patchUrl,
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
      const { name, description, environment, status, startDate, endDate, patchUrl } = req.body;

      const mission = await this.updateMissionUseCase.execute(id, {
        name,
        description,
        environment,
        status,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        patchUrl,
      });

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

