/**
 * @module application/use-cases/mission/ListMissionsUseCase
 * Use case for paginated mission listing filtered by habitat environment, status, or search term.
 */

import { Mission } from "@prisma/client";
import { IMissionRepository } from "../../../domain/repository/IMissionRepository.js";
import { MissionFilters, PaginatedResult } from "../../../domain/models/Mission.js";

/** Returns a paginated collection of active missions matching the provided filters. */
export class ListMissionsUseCase {
  constructor(private readonly missionRepo: IMissionRepository) {}

  async execute(filters: MissionFilters): Promise<PaginatedResult<Mission>> {
    return this.missionRepo.findMany(filters);
  }
}

