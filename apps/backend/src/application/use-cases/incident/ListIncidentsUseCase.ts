/**
 * @module application/use-cases/incident/ListIncidentsUseCase
 * Use case for paginated listing of incidents across medical, radiation, and mission categories.
 */

import { IncidentFilters, PaginatedIncidents } from "../../../domain/models/Incident.js";
import { IIncidentRepository } from "../../../domain/repository/IIncidentRepository.js";

/** Lists paginated incidents matching status, category, severity, mission, or astronaut/global scope filters. */
export class ListIncidentsUseCase {
  constructor(private readonly incidentRepo: IIncidentRepository) {}

  async execute(filters: IncidentFilters): Promise<PaginatedIncidents> {
    return this.incidentRepo.findAll(filters);
  }
}
