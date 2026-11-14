import { Mission } from "@prisma/client";
import { IMissionRepository } from "../../../domain/repository/IMissionRepository.js";
import { UpdateMissionDTO } from "../../../domain/models/Mission.js";
import { NotFoundError, ValidationError } from "../../../domain/errors/AppError.js";

export class UpdateMissionUseCase {
  constructor(private readonly missionRepo: IMissionRepository) {}

  async execute(id: string, data: UpdateMissionDTO): Promise<Mission> {
    if (data.name !== undefined && data.name.trim().length === 0) {
      throw new ValidationError("El nombre de la misión no puede estar vacío.");
    }

    if (data.description !== undefined && data.description.trim().length === 0) {
      throw new ValidationError("La descripción de la misión no puede estar vacía.");
    }

    const updated = await this.missionRepo.update(id, data);
    if (!updated) {
      throw new NotFoundError("Misión", id);
    }

    return updated;
  }
}

