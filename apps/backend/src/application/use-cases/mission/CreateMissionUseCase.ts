/**
 * @module application/use-cases/mission/CreateMissionUseCase
 * Use case for validating and creating a new space mission.
 */

import { Mission } from "@prisma/client";
import { IMissionRepository } from "../../../domain/repository/IMissionRepository.js";
import { CreateMissionDTO } from "../../../domain/models/Mission.js";
import { ValidationError } from "../../../domain/errors/AppError.js";

/** Validates non-empty `name`, `description`, and `startDate`, trims strings, and persists the mission. */
export class CreateMissionUseCase {
  constructor(private readonly missionRepo: IMissionRepository) {}

  async execute(data: CreateMissionDTO): Promise<Mission> {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError("El nombre de la misión es obligatorio.");
    }

    if (!data.description || data.description.trim().length === 0) {
      throw new ValidationError("La descripción de la misión es obligatoria.");
    }

    if (!data.startDate) {
      throw new ValidationError("La fecha de inicio de la misión es obligatoria.");
    }

    return this.missionRepo.create({
      ...data,
      name: data.name.trim(),
      description: data.description.trim(),
    });
  }
}

