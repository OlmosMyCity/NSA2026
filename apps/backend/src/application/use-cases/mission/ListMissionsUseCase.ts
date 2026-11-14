import { Mission } from "@prisma/client";
import { IMissionRepository } from "../../../domain/repository/IMissionRepository.js";
import { MissionFilters, PaginatedResult } from "../../../domain/models/Mission.js";

export class ListMissionsUseCase {
  constructor(private readonly missionRepo: IMissionRepository) {}

  async execute(filters: MissionFilters): Promise<PaginatedResult<Mission>> {
    return this.missionRepo.findMany(filters);
  }
}

