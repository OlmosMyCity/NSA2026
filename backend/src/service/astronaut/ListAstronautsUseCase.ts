/**
 * @module service/astronaut/ListAstronautsUseCase
 * Use case for paginated astronaut listing with mission and search filters.
 */

import { IAstronautRepository } from "../../repository/IAstronautRepository.js";
import {
  AstronautFilters,
  AstronautWithMission,
  PaginatedResult,
} from "../../entity/Astronaut.js";

/** Returns a paginated list of active astronauts matching optional mission and text filters. */
export class ListAstronautsUseCase {
  constructor(private readonly astronautRepo: IAstronautRepository) {}

  async execute(filters: AstronautFilters): Promise<PaginatedResult<AstronautWithMission>> {
    return this.astronautRepo.findMany(filters);
  }
}

