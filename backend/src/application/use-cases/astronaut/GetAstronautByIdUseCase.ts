import { IAstronautRepository } from "../../../domain/repository/IAstronautRepository.js";
import { AstronautWithMission } from "../../../domain/models/Astronaut.js";
import { NotFoundError } from "../../../domain/errors/AppError.js";

export class GetAstronautByIdUseCase {
  constructor(private readonly astronautRepo: IAstronautRepository) {}

  async execute(id: string): Promise<AstronautWithMission> {
    const astronaut = await this.astronautRepo.findById(id);
    if (!astronaut) {
      throw new NotFoundError("Astronauta", id);
    }
    return astronaut;
  }
}

