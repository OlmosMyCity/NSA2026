import { Incident, IncidentCategory, IncidentSeverity, IncidentStatus, Prisma } from "@prisma/client";

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

export interface AcknowledgeIncidentDTO {
  id: string;
  userId: string;
}

export interface CloseIncidentDTO {
  id: string;
  userId: string;
  resolutionNotes?: string | null;
}

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

export interface PaginatedIncidents {
  data: Incident[];
  pagination: {
    total: number;
    currentPage: number;
    limit: number;
    totalPages: number;
  };
}
