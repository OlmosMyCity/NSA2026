/**
 * @module application/use-cases/incident/OpenIncidentUseCase
 * Use case for opening, catalog-hydrating, deduplicating, and escalating incidents.
 */

import { Incident, IncidentCategory, IncidentSeverity } from "@prisma/client";
import { OpenIncidentDTO } from "../../../domain/models/Incident.js";
import { IIncidentRepository } from "../../../domain/repository/IIncidentRepository.js";
import { ValidationError } from "../../../domain/errors/AppError.js";
import { getMissionContingencySpec } from "../../incident/missionCatalog.js";
import { incidentNotificationBus } from "../../incident/incidentNotificationBus.js";

/** Input payload for opening an incident; metadata fields may be auto-filled from `MISSION_CONTINGENCY_CATALOG`. */
export type OpenIncidentInput = Omit<OpenIncidentDTO, "category" | "severity" | "title" | "description"> & {
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  title?: string;
  description?: string;
};

/** Result pairing the persisted or deduplicated `Incident` with a flag indicating whether a new record was created. */
export interface OpenIncidentResult {
  incident: Incident;
  created: boolean;
}

/**
 * Opens an operational, medical, or radiation incident with automatic catalog enrichment and deduplication.
 *
 * Invariants:
 * - Catalog types (`CONT-01`..`CONT-05`) inherit default title, description, severity, protocolId, and checklist.
 * - Deduplicates against any active (`OPEN` or `ACKNOWLEDGED`) incident matching `(type, astronautId)`.
 * - Escalates an existing `WARNING` incident in place if the incoming event has `CRITICAL` severity,
 *   publishing `incident:escalated`; newly created incidents publish `incident:opened`.
 */
export class OpenIncidentUseCase {
  constructor(private readonly incidentRepo: IIncidentRepository) {}

  async execute(dto: OpenIncidentInput): Promise<OpenIncidentResult> {
    if (!dto.type?.trim() || !dto.source?.trim()) {
      throw new ValidationError("Los campos type y source son obligatorios para abrir un incidente.");
    }

    const normalizedType = dto.type.trim();
    const catalogSpec = getMissionContingencySpec(normalizedType);

    const resolvedTitle = dto.title?.trim() || catalogSpec?.title || "";
    const resolvedDescription = dto.description?.trim() || catalogSpec?.description || "";
    const resolvedCategory = dto.category ?? catalogSpec?.category ?? IncidentCategory.MISSION;
    const resolvedSeverity = dto.severity ?? catalogSpec?.defaultSeverity ?? IncidentSeverity.CRITICAL;
    const resolvedProtocolId = dto.protocolId ?? catalogSpec?.protocolId ?? null;

    if (!resolvedTitle || !resolvedDescription) {
      throw new ValidationError(
        "Los campos title y description son obligatorios para abrir un incidente fuera del catálogo de misión."
      );
    }

    const resolvedMetadata = catalogSpec
      ? {
          code: catalogSpec.code,
          abortEva: catalogSpec.abortEva,
          evacuateModule: catalogSpec.evacuateModule,
          immediateActions: catalogSpec.immediateActions,
          ...(typeof dto.metadata === "object" && dto.metadata !== null ? (dto.metadata as Record<string, unknown>) : {}),
        }
      : dto.metadata;

    const astronautScope = dto.astronautId ?? null;

    const existing = await this.incidentRepo.findActiveByType(normalizedType, astronautScope);
    if (existing) {
      // Deduplicate against an active incident of the same type and scope;
      // if severity escalated from WARNING to CRITICAL, upgrade the active incident in place.
      if (
        existing.severity === IncidentSeverity.WARNING &&
        resolvedSeverity === IncidentSeverity.CRITICAL
      ) {
        const escalated = await this.incidentRepo.update(existing.id, {
          severity: IncidentSeverity.CRITICAL,
          title: resolvedTitle,
          description: resolvedDescription,
          readingId: dto.readingId ?? existing.readingId,
          protocolId: resolvedProtocolId ?? existing.protocolId,
          metadata: resolvedMetadata ?? existing.metadata ?? {},
        });
        const resultIncident = escalated ?? existing;
        incidentNotificationBus.publish("incident:escalated", resultIncident, "Severidad escalada a CRITICAL");
        return { incident: resultIncident, created: false };
      }

      return { incident: existing, created: false };
    }

    const created = await this.incidentRepo.create({
      ...dto,
      category: resolvedCategory,
      severity: resolvedSeverity,
      type: normalizedType,
      title: resolvedTitle,
      description: resolvedDescription,
      source: dto.source.trim(),
      protocolId: resolvedProtocolId,
      metadata: resolvedMetadata,
      astronautId: astronautScope,
    });

    incidentNotificationBus.publish("incident:opened", created);
    return { incident: created, created: true };
  }
}
