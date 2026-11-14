import { IHealthReadingRepository } from "../../../domain/repository/IHealthReadingRepository.js";
import { NotFoundError } from "../../../domain/errors/AppError.js";

export class DeleteHealthReadingUseCase {
  constructor(private readonly readingRepo: IHealthReadingRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.readingRepo.softDelete(id);
    if (!deleted) {
      throw new NotFoundError("Lectura de salud", id);
    }
  }
}

