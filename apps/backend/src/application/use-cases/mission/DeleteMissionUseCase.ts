/**
 * @module application/use-cases/mission/DeleteMissionUseCase
 * Use case for soft-deleting a space mission by ID.
 */

import { IMissionRepository } from "../../../domain/repository/IMissionRepository.js";
import { NotFoundError } from "../../../domain/errors/AppError.js";

/** Soft-deletes a mission; throws `NotFoundError` (404) if missing. */
export class DeleteMissionUseCase {
  constructor(private readonly missionRepo: IMissionRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.missionRepo.softDelete(id);
    if (!deleted) {
      throw new NotFoundError("Misión", id);
    }
  }
}

