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
      throw new ValidationError("Astronaut name cannot be empty.");
    }
    if (data.role !== undefined && data.role.trim().length === 0) {
      throw new ValidationError("Astronaut role cannot be empty.");
    }
    if (data.age !== undefined && (typeof data.age !== "number" || isNaN(data.age) || data.age <= 0)) {
      throw new ValidationError("Astronaut age must be a positive integer.");
    }

    const updated = await this.astronautRepo.update(id, {
      ...data,
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.role !== undefined ? { role: data.role.trim() } : {}),
    });

    if (!updated) {
      throw new NotFoundError("Astronaut", id);
    }

    return updated;
  }
}

