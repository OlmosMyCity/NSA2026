import { IHealthReadingRepository, AstronautHealthSummary } from "../../../domain/repository/IHealthReadingRepository.js";
import { NotFoundError } from "../../../domain/errors/AppError.js";

export class GetAstronautHealthSummaryUseCase {
  constructor(private readonly readingRepo: IHealthReadingRepository) {}

  async execute(astronautId: string): Promise<AstronautHealthSummary> {
    if (!astronautId || astronautId.trim() === "") {
      throw new NotFoundError("Astronauta", astronautId);
    }

    const summary = await this.readingRepo.getAstronautHealthSummary(astronautId);
    if (!summary) {
      throw new NotFoundError("Astronauta", astronautId);
    }

    return summary;
  }
}

