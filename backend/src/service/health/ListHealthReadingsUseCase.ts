/**
 * @module service/health/ListHealthReadingsUseCase
 * Use case for paginated listing of astronaut biomedical health readings.
 */

import { HealthReading } from "@prisma/client";
import { IHealthReadingRepository } from "../../repository/IHealthReadingRepository.js";
import { HealthReadingFilters, PaginatedResult } from "../../entity/HealthReading.js";

/** Lists paginated health readings filtered by astronaut, status, and timestamp window. */
export class ListHealthReadingsUseCase {
  constructor(private readonly readingRepo: IHealthReadingRepository) {}

  async execute(filters: HealthReadingFilters): Promise<PaginatedResult<HealthReading>> {
    return this.readingRepo.findMany(filters);
  }
}

