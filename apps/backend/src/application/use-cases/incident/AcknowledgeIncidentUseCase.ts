import { Incident, IncidentStatus } from "@prisma/client";
import { AcknowledgeIncidentDTO } from "../../../domain/models/Incident.js";
import { IIncidentRepository } from "../../../domain/repository/IIncidentRepository.js";
import { NotFoundError, ValidationError } from "../../../domain/errors/AppError.js";
import { incidentNotificationBus } from "../../incident/incidentNotificationBus.js";

export class AcknowledgeIncidentUseCase {
  constructor(private readonly incidentRepo: IIncidentRepository) {}

  async execute(dto: AcknowledgeIncidentDTO): Promise<Incident> {
    if (!dto.id || !dto.userId) {
      throw new ValidationError("El ID del incidente y el usuario son obligatorios.");
    }

    const existing = await this.incidentRepo.findById(dto.id);
    if (!existing) {
      throw new NotFoundError("Incidente", dto.id);
    }

    if (existing.status === IncidentStatus.CLOSED) {
      throw new ValidationError("No se puede confirmar un incidente que ya está cerrado.");
    }

    if (existing.status === IncidentStatus.ACKNOWLEDGED) {
      return existing;
    }

    const updated = await this.incidentRepo.update(dto.id, {
      status: IncidentStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date(),
      acknowledgedById: dto.userId,
    });

    if (!updated) {
      throw new NotFoundError("Incidente", dto.id);
    }

    incidentNotificationBus.publish("incident:acknowledged", updated);
    return updated;
  }
}
