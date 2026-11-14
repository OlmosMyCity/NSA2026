import { Incident, IncidentStatus } from "@prisma/client";
import { CloseIncidentDTO } from "../../../domain/models/Incident.js";
import { IIncidentRepository } from "../../../domain/repository/IIncidentRepository.js";
import { NotFoundError, ValidationError } from "../../../domain/errors/AppError.js";

export class CloseIncidentUseCase {
  constructor(private readonly incidentRepo: IIncidentRepository) {}

  async execute(dto: CloseIncidentDTO): Promise<Incident> {
    if (!dto.id || !dto.userId) {
      throw new ValidationError("El ID del incidente y el usuario son obligatorios.");
    }

    const existing = await this.incidentRepo.findById(dto.id);
    if (!existing) {
      throw new NotFoundError("Incidente", dto.id);
    }

    if (existing.status === IncidentStatus.CLOSED) {
      return existing;
    }

    const updated = await this.incidentRepo.update(dto.id, {
      status: IncidentStatus.CLOSED,
      closedAt: new Date(),
      closedById: dto.userId,
      resolutionNotes: dto.resolutionNotes?.trim() || existing.resolutionNotes,
    });

    if (!updated) {
      throw new NotFoundError("Incidente", dto.id);
    }

    return updated;
  }
}
