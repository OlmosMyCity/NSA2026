import { HealthReading } from "@prisma/client";
import { IHealthReadingRepository } from "../../../domain/repository/IHealthReadingRepository.js";
import { HealthReadingFilters, PaginatedResult } from "../../../domain/models/HealthReading.js";

export class ListHealthReadingsUseCase {
  constructor(private readonly readingRepo: IHealthReadingRepository) {}

  async execute(filters: HealthReadingFilters): Promise<PaginatedResult<HealthReading>> {
    return this.readingRepo.findMany(filters);
  }
}

