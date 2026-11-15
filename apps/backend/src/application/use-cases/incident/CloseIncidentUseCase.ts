/**
 * @module application/use-cases/incident/CloseIncidentUseCase
 * Use case for resolving and closing an incident with audit metadata.
 */

import { Incident, IncidentStatus } from "@prisma/client";
import { CloseIncidentDTO } from "../../../domain/models/Incident.js";
import { IIncidentRepository } from "../../../domain/repository/IIncidentRepository.js";
import { NotFoundError, ValidationError } from "../../../domain/errors/AppError.js";
import { incidentNotificationBus } from "../../incident/incidentNotificationBus.js";

/**
 * Transitions an active incident (`OPEN` or `ACKNOWLEDGED`) to `CLOSED`, attaches
 * optional resolution notes, and emits `incident:closed`. Idempotent if already `CLOSED`.
 */
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

    incidentNotificationBus.publish("incident:closed", updated);
    return updated;
  }
}
