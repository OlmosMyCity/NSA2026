import { IAstronautRepository } from "../../../domain/repository/IAstronautRepository.js";
import { NotFoundError } from "../../../domain/errors/AppError.js";

export class DeleteAstronautUseCase {
  constructor(private readonly astronautRepo: IAstronautRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.astronautRepo.softDelete(id);
    if (!deleted) {
      throw new NotFoundError("Astronauta", id);
    }
  }
}

