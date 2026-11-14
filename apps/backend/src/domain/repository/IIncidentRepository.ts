import { Incident, IncidentSeverity, IncidentStatus, Prisma } from "@prisma/client";
import { IncidentFilters, OpenIncidentDTO, PaginatedIncidents } from "../models/Incident.js";

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

export interface IIncidentRepository {
  findAll(filters: IncidentFilters): Promise<PaginatedIncidents>;
  findById(id: string): Promise<Incident | null>;
  findActiveByType(type: string, astronautId?: string | null): Promise<Incident | null>;
  create(data: OpenIncidentDTO): Promise<Incident>;
  update(id: string, data: UpdateIncidentData): Promise<Incident | null>;
}
