import { IncidentFilters, PaginatedIncidents } from "../../../domain/models/Incident.js";
import { IIncidentRepository } from "../../../domain/repository/IIncidentRepository.js";

export class ListIncidentsUseCase {
  constructor(private readonly incidentRepo: IIncidentRepository) {}

  async execute(filters: IncidentFilters): Promise<PaginatedIncidents> {
    return this.incidentRepo.findAll(filters);
  }
}
