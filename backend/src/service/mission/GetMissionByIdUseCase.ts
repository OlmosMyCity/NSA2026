/**
 * @module service/mission/GetMissionByIdUseCase
 * Use case for retrieving a space mission by ID.
 */

import { Mission } from "@prisma/client";
import { IMissionRepository } from "../../repository/IMissionRepository.js";
import { NotFoundError } from "../../exception/AppError.js";

/** Fetches a single mission; throws `NotFoundError` (404) if missing or soft-deleted. */
export class GetMissionByIdUseCase {
  constructor(private readonly missionRepo: IMissionRepository) {}

  async execute(id: string): Promise<Mission> {
    const mission = await this.missionRepo.findById(id);
    if (!mission) {
      throw new NotFoundError("Misión", id);
    }
    return mission;
  }
}

