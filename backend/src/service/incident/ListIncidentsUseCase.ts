/**
 * @module service/incident/ListIncidentsUseCase
 * Use case for paginated listing of incidents across medical, radiation, and mission categories.
 */

import { IncidentFilters, PaginatedIncidents } from "../../entity/Incident.js";
import { IIncidentRepository } from "../../repository/IIncidentRepository.js";

/** Lists paginated incidents matching status, category, severity, mission, or astronaut/global scope filters. */
export class ListIncidentsUseCase {
  constructor(private readonly incidentRepo: IIncidentRepository) {}

  async execute(filters: IncidentFilters): Promise<PaginatedIncidents> {
    return this.incidentRepo.findAll(filters);
  }
}
