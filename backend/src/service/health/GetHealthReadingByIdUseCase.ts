/**
 * @module service/health/GetHealthReadingByIdUseCase
 * Use case for retrieving a single biomedical health reading by ID.
 */

import { HealthReading } from "@prisma/client";
import { IHealthReadingRepository } from "../../repository/IHealthReadingRepository.js";
import { NotFoundError } from "../../exception/AppError.js";

/** Retrieves a single health reading; throws `NotFoundError` (404) if missing or soft-deleted. */
export class GetHealthReadingByIdUseCase {
  constructor(private readonly readingRepo: IHealthReadingRepository) {}

  async execute(id: string): Promise<HealthReading> {
    const reading = await this.readingRepo.findById(id);
    if (!reading) {
      throw new NotFoundError("Lectura de salud", id);
    }
    return reading;
  }
}

