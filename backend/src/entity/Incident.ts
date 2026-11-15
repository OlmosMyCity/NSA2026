/**
 * @module entity/Incident
 * Domain DTOs and filter contracts for medical, radiation, and mission contingency incidents.
 */

import { Incident, IncidentCategory, IncidentSeverity, IncidentStatus, Prisma } from "@prisma/client";

/**
 * Payload required to persist a new operational or clinical incident.
 * When `astronautId` is `null` or omitted, the incident applies globally (e.g., solar radiation storms).
 */
export interface OpenIncidentDTO {
  category: IncidentCategory;
  type: string;
  severity: IncidentSeverity;
  title: string;
  description: string;
  astronautId?: string | null;
  missionId?: string | null;
  source: string;
  readingId?: string | null;
  protocolId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/** Input DTO for acknowledging an active incident. */
export interface AcknowledgeIncidentDTO {
  id: string;
  userId: string;
}

/** Input DTO for closing an incident with optional resolution notes. */
export interface CloseIncidentDTO {
  id: string;
  userId: string;
  resolutionNotes?: string | null;
}

/** Query filters for paginated incident retrieval across astronaut-scoped and global incidents. */
export interface IncidentFilters {
  page?: number;
  limit?: number;
  status?: IncidentStatus;
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  astronautId?: string;
  includeGlobal?: boolean;
  globalOnly?: boolean;
  missionId?: string;
  type?: string;
}

/** Paginated collection of `Incident` records returned by `IIncidentRepository.findAll`. */
export interface PaginatedIncidents {
  data: Incident[];
  pagination: {
    total: number;
    currentPage: number;
    limit: number;
    totalPages: number;
  };
}
