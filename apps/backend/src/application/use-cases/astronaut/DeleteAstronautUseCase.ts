/**
 * @module application/use-cases/astronaut/DeleteAstronautUseCase
 * Use case for soft-deleting an astronaut profile by ID.
 */

import { IAstronautRepository } from "../../../domain/repository/IAstronautRepository.js";
import { NotFoundError } from "../../../domain/errors/AppError.js";

/** Soft-deletes an astronaut profile; throws `NotFoundError` (404) if no matching record exists. */
export class DeleteAstronautUseCase {
  constructor(private readonly astronautRepo: IAstronautRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.astronautRepo.softDelete(id);
    if (!deleted) {
      throw new NotFoundError("Astronauta", id);
    }
  }
}

