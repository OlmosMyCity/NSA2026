/**
 * @module service/incident/GetIncidentByIdUseCase
 * Use case for retrieving a single incident record by ID.
 */

import { Incident } from "@prisma/client";
import { IIncidentRepository } from "../../repository/IIncidentRepository.js";
import { NotFoundError } from "../../exception/AppError.js";

/** Fetches an incident by ID; throws `NotFoundError` (404) if missing. */
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
