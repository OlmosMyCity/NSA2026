import { Incident, IncidentSeverity } from "@prisma/client";
import { OpenIncidentDTO } from "../../../domain/models/Incident.js";
import { IIncidentRepository } from "../../../domain/repository/IIncidentRepository.js";
import { ValidationError } from "../../../domain/errors/AppError.js";

export interface OpenIncidentResult {
  incident: Incident;
  created: boolean;
}

export class OpenIncidentUseCase {
  constructor(private readonly incidentRepo: IIncidentRepository) {}

  async execute(dto: OpenIncidentDTO): Promise<OpenIncidentResult> {
    if (!dto.type?.trim() || !dto.title?.trim() || !dto.description?.trim() || !dto.source?.trim()) {
      throw new ValidationError("Los campos type, title, description y source son obligatorios para abrir un incidente.");
    }

    const normalizedType = dto.type.trim();
    const astronautScope = dto.astronautId ?? null;

    const existing = await this.incidentRepo.findActiveByType(normalizedType, astronautScope);
    if (existing) {
      // Si ya existe uno activo del mismo tipo, evitar duplicados.
      // Si la severidad escaló de WARNING a CRITICAL, actualizar el incidente activo.
      if (
        existing.severity === IncidentSeverity.WARNING &&
        dto.severity === IncidentSeverity.CRITICAL
      ) {
        const escalated = await this.incidentRepo.update(existing.id, {
          severity: IncidentSeverity.CRITICAL,
          title: dto.title.trim(),
          description: dto.description.trim(),
          readingId: dto.readingId ?? existing.readingId,
          protocolId: dto.protocolId ?? existing.protocolId,
          metadata: dto.metadata ?? existing.metadata ?? {},
        });
        return { incident: escalated ?? existing, created: false };
      }

      return { incident: existing, created: false };
    }

    const created = await this.incidentRepo.create({
      ...dto,
      type: normalizedType,
      title: dto.title.trim(),
      description: dto.description.trim(),
      source: dto.source.trim(),
      astronautId: astronautScope,
    });

    return { incident: created, created: true };
  }
}
