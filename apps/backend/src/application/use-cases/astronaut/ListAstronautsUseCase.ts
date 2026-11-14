import { IAstronautRepository } from "../../../domain/repository/IAstronautRepository.js";
import {
  AstronautFilters,
  AstronautWithMission,
  PaginatedResult,
} from "../../../domain/models/Astronaut.js";

export class ListAstronautsUseCase {
  constructor(private readonly astronautRepo: IAstronautRepository) {}

  async execute(filters: AstronautFilters): Promise<PaginatedResult<AstronautWithMission>> {
    return this.astronautRepo.findMany(filters);
  }
}

