/**
 * @module service/astronaut/UpdateAstronautUseCase
 * Use case for partial validation and update of an existing astronaut profile.
 */

import { IAstronautRepository } from "../../repository/IAstronautRepository.js";
import { AstronautWithMission, UpdateAstronautDTO } from "../../entity/Astronaut.js";
import { NotFoundError, ValidationError } from "../../exception/AppError.js";

/**
 * Validates non-empty trimmed `name`/`role` and positive `age` when provided, then updates
 * the astronaut record; throws `NotFoundError` (404) if missing.
 */
export class UpdateAstronautUseCase {
  constructor(private readonly astronautRepo: IAstronautRepository) {}

  async execute(id: string, data: UpdateAstronautDTO): Promise<AstronautWithMission> {
    if (data.name !== undefined && data.name.trim().length === 0) {
      throw new ValidationError("El nombre del astronauta no puede estar vacío.");
    }
    if (data.role !== undefined && data.role.trim().length === 0) {
      throw new ValidationError("El rol del astronauta no puede estar vacío.");
    }
    if (data.age !== undefined && (typeof data.age !== "number" || isNaN(data.age) || data.age <= 0)) {
      throw new ValidationError("La edad del astronauta debe ser un número entero positivo.");
    }

    const updated = await this.astronautRepo.update(id, {
      ...data,
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.role !== undefined ? { role: data.role.trim() } : {}),
    });

    if (!updated) {
      throw new NotFoundError("Astronauta", id);
    }

    return updated;
  }
}

