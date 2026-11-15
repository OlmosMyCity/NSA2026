/**
 * @module service/astronaut/CreateAstronautUseCase
 * Use case for registering a new astronaut profile assigned to a mission.
 */

import { IAstronautRepository } from "../../repository/IAstronautRepository.js";
import { AstronautWithMission, CreateAstronautDTO } from "../../entity/Astronaut.js";
import { ValidationError } from "../../exception/AppError.js";

/**
 * Validates required crew attributes (`name`, `role`, `missionId`, positive `age`),
 * trims text inputs, and persists a new astronaut via `IAstronautRepository`.
 */
export class CreateAstronautUseCase {
  constructor(private readonly astronautRepo: IAstronautRepository) {}

  async execute(data: CreateAstronautDTO): Promise<AstronautWithMission> {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError("El nombre del astronauta es obligatorio.");
    }
    if (!data.role || data.role.trim().length === 0) {
      throw new ValidationError("El rol del astronauta en la misión es obligatorio.");
    }
    if (!data.missionId || data.missionId.trim().length === 0) {
      throw new ValidationError("La misión asignada ('missionId') es obligatoria.");
    }
    if (typeof data.age !== "number" || isNaN(data.age) || data.age <= 0) {
      throw new ValidationError("La edad del astronauta debe ser un número entero positivo.");
    }

    return this.astronautRepo.create({
      ...data,
      name: data.name.trim(),
      role: data.role.trim(),
    });
  }
}

