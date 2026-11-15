import { Incident } from "@prisma/client";
import { IIncidentRepository } from "../../../domain/repository/IIncidentRepository.js";
import { NotFoundError } from "../../../domain/errors/AppError.js";

export class GetIncidentByIdUseCase {
  constructor(private readonly incidentRepo: IIncidentRepository) {}

  async execute(id: string): Promise<Incident> {
    const incident = await this.incidentRepo.findById(id);
    if (!incident) {
      throw new NotFoundError("Incidente", id);
    }
    return incident;
  }
}
