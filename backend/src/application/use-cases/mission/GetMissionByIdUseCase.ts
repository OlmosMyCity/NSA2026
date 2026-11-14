import { Mission } from "@prisma/client";
import { IMissionRepository } from "../../../domain/repository/IMissionRepository.js";
import { NotFoundError } from "../../../domain/errors/AppError.js";

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

