import { Incident, IncidentCategory, IncidentSeverity } from "@prisma/client";
import { OpenIncidentDTO } from "../../../domain/models/Incident.js";
import { IIncidentRepository } from "../../../domain/repository/IIncidentRepository.js";
import { ValidationError } from "../../../domain/errors/AppError.js";
import { getMissionContingencySpec } from "../../incident/missionCatalog.js";

export type OpenIncidentInput = Omit<OpenIncidentDTO, "category" | "severity" | "title" | "description"> & {
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  title?: string;
  description?: string;
};

export interface OpenIncidentResult {
  incident: Incident;
  created: boolean;
}

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
      // Si ya existe uno activo del mismo tipo, evitar duplicados.
      // Si la severidad escaló de WARNING a CRITICAL, actualizar el incidente activo.
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
        return { incident: escalated ?? existing, created: false };
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

    return { incident: created, created: true };
  }
}
