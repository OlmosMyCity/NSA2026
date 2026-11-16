/**
 * @module service/incident/CloseIncidentUseCase
 * Use case for resolving and closing an incident with audit metadata.
 */

import { Incident, IncidentStatus } from "@prisma/client";
import { CloseIncidentDTO } from "../../entity/Incident.js";
import { IIncidentRepository } from "../../repository/IIncidentRepository.js";
import { NotFoundError, ValidationError } from "../../exception/AppError.js";
import { incidentNotificationBus } from "./incidentNotificationBus.js";

/**
 * Transitions an active incident (`OPEN` or `ACKNOWLEDGED`) to `CLOSED`, attaches
 * optional resolution notes, and emits `incident:closed`. Idempotent if already `CLOSED`.
 */
export class CloseIncidentUseCase {
  constructor(private readonly incidentRepo: IIncidentRepository) {}

  async execute(dto: CloseIncidentDTO): Promise<Incident> {
    if (!dto.id || !dto.userId) {
      throw new ValidationError("Incident ID and user are required.");
    }

    const existing = await this.incidentRepo.findById(dto.id);
    if (!existing) {
      throw new NotFoundError("Incident", dto.id);
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
      throw new NotFoundError("Incident", dto.id);
    }

    incidentNotificationBus.publish("incident:closed", updated);
    return updated;
  }
}
