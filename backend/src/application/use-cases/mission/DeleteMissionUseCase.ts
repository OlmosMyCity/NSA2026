import { IMissionRepository } from "../../../domain/repository/IMissionRepository.js";
import { NotFoundError } from "../../../domain/errors/AppError.js";

export class DeleteMissionUseCase {
  constructor(private readonly missionRepo: IMissionRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.missionRepo.softDelete(id);
    if (!deleted) {
      throw new NotFoundError("Misión", id);
    }
  }
}

