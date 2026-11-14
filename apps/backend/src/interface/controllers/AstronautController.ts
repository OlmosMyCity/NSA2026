import { Request, Response, NextFunction } from "express";
import { ListAstronautsUseCase } from "../../application/use-cases/astronaut/ListAstronautsUseCase.js";
import { GetAstronautByIdUseCase } from "../../application/use-cases/astronaut/GetAstronautByIdUseCase.js";
import { CreateAstronautUseCase } from "../../application/use-cases/astronaut/CreateAstronautUseCase.js";
import { UpdateAstronautUseCase } from "../../application/use-cases/astronaut/UpdateAstronautUseCase.js";
import { DeleteAstronautUseCase } from "../../application/use-cases/astronaut/DeleteAstronautUseCase.js";
import {
  createAstronautSchema,
  parseWithValidation,
  updateAstronautSchema,
} from "../validation/schemas.js";

export class AstronautController {
  constructor(
    private readonly listAstronautsUseCase: ListAstronautsUseCase,
    private readonly getAstronautByIdUseCase: GetAstronautByIdUseCase,
    private readonly createAstronautUseCase: CreateAstronautUseCase,
    private readonly updateAstronautUseCase: UpdateAstronautUseCase,
    private readonly deleteAstronautUseCase: DeleteAstronautUseCase
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
      const payload = parseWithValidation(updateAstronautSchema, req.body ?? {});

      const astronaut = await this.updateAstronautUseCase.execute(id, payload);

      res.status(200).json(astronaut);
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

