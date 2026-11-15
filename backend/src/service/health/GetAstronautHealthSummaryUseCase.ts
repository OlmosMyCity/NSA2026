/**
 * @module service/health/GetAstronautHealthSummaryUseCase
 * Use case for retrieving an astronaut's aggregated multi-system health summary.
 */

import { IHealthReadingRepository, AstronautHealthSummary } from "../../repository/IHealthReadingRepository.js";
import { NotFoundError } from "../../exception/AppError.js";

/**
 * Fetches the latest reading, 5 physiological subsystem statuses, and 7-day trend history
 * for an astronaut; throws `NotFoundError` (404) if the ID is blank or unknown.
 */
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

