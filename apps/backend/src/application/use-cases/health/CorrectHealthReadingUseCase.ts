import { HealthReading } from "@prisma/client";
import { IHealthReadingRepository } from "../../../domain/repository/IHealthReadingRepository.js";
import { CorrectHealthReadingDTO } from "../../../domain/models/HealthReading.js";
import { evaluateReading } from "../../health/evaluateReading.js";
import { ConflictError, NotFoundError } from "../../../domain/errors/AppError.js";
import { assertValidVitals } from "./CreateHealthReadingUseCase.js";
import { assertInvalidationReason } from "./InvalidateHealthReadingUseCase.js";
import { OpenIncidentUseCase } from "../incident/OpenIncidentUseCase.js";
import { openMedicalIncidentsFromReading } from "../incident/syncSystemIncidents.js";

/**
 * P1 — Corrections are persisted as superseding records.
 * Creates a new clinically re-evaluated health reading pointing to the original via
 * `supersedesId` and invalidates the original reading with an audit reason inside a
 * single database transaction.
 */
export class CorrectHealthReadingUseCase {
  constructor(
    private readonly readingRepo: IHealthReadingRepository,
    private readonly openIncidentUseCase?: OpenIncidentUseCase
  ) {}

  async execute(
    originalId: string,
    dto: CorrectHealthReadingDTO,
    correctedById: string | null
  ): Promise<HealthReading> {
    const reason = assertInvalidationReason(dto.reason);
    assertValidVitals(dto);

    const original = await this.readingRepo.findById(originalId);
    if (!original) {
      throw new NotFoundError("Lectura de salud", originalId);
    }
    if (!original.isValid) {
      throw new ConflictError("Solo se puede corregir una lectura válida; esta ya fue invalidada o corregida.");
    }

    const vitals = {
      heartRateBpm: dto.heartRateBpm,
      systolicMmHg: dto.systolicMmHg,
      diastolicMmHg: dto.diastolicMmHg,
      glucoseMgDl: dto.glucoseMgDl,
      temperatureC: dto.temperatureC,
      spo2Pct: dto.spo2Pct,
      sleepHours: dto.sleepHours,
      mood: dto.mood,
    };
    const evaluation = evaluateReading(vitals);

    const corrected = await this.readingRepo.createCorrection(
      originalId,
      {
        astronautId: original.astronautId,
        ...vitals,
        status: evaluation.status,
        alerts: evaluation.alerts,
        recommendation: evaluation.recommendation,
        notes: dto.notes ?? original.notes,
        // Default to the original clinical timestamp unless an explicit timestamp is supplied
        takenAt: dto.takenAt ?? original.takenAt,
      },
      { reason: `Corregida: ${reason}`, invalidatedById: correctedById }
    );

    if (this.openIncidentUseCase && evaluation.alerts.length > 0) {
      await openMedicalIncidentsFromReading(
        this.openIncidentUseCase,
        corrected.astronautId,
        corrected.id,
        evaluation
      );
    }

    return corrected;
  }
}
