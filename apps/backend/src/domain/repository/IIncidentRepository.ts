/**
 * @module domain/repository/IIncidentRepository
 * Repository contract for operational, medical, and radiation incident lifecycle persistence.
 */

import { Incident, IncidentSeverity, IncidentStatus, Prisma } from "@prisma/client";
import { IncidentFilters, OpenIncidentDTO, PaginatedIncidents } from "../models/Incident.js";

/** Mutable fields accepted when escalating, acknowledging, or closing an incident. */
export interface UpdateIncidentData {
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  title?: string;
  description?: string;
  readingId?: string | null;
  protocolId?: string | null;
  metadata?: Prisma.InputJsonValue;
  acknowledgedAt?: Date | null;
  acknowledgedById?: string | null;
  closedAt?: Date | null;
  closedById?: string | null;
  resolutionNotes?: string | null;
}

/** Persistence port for querying, deduplicating, opening, and updating incidents. */
export interface IIncidentRepository {
  findAll(filters: IncidentFilters): Promise<PaginatedIncidents>;
  findById(id: string): Promise<Incident | null>;
  /** Finds an active (`OPEN` or `ACKNOWLEDGED`) incident matching `type` and optional astronaut scope to prevent duplicates. */
  findActiveByType(type: string, astronautId?: string | null): Promise<Incident | null>;
  create(data: OpenIncidentDTO): Promise<Incident>;
  update(id: string, data: UpdateIncidentData): Promise<Incident | null>;
}
