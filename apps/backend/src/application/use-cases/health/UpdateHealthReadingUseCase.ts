import { HealthReading } from "@prisma/client";
import { IHealthReadingRepository } from "../../../domain/repository/IHealthReadingRepository.js";
import { UpdateHealthReadingDTO } from "../../../domain/models/HealthReading.js";
import { evaluateReading } from "../../health/evaluateReading.js";
import { NotFoundError } from "../../../domain/errors/AppError.js";
import { assertValidVitals } from "./CreateHealthReadingUseCase.js";
import { OpenIncidentUseCase } from "../incident/OpenIncidentUseCase.js";
import { openMedicalIncidentsFromReading } from "../incident/syncSystemIncidents.js";

export class UpdateHealthReadingUseCase {
  constructor(
    private readonly readingRepo: IHealthReadingRepository,
    private readonly openIncidentUseCase?: OpenIncidentUseCase
  ) {}

  async execute(id: string, data: UpdateHealthReadingDTO): Promise<HealthReading> {
    const existing = await this.readingRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Lectura de salud", id);
    }

    const mergedMetrics = {
      heartRateBpm: data.heartRateBpm ?? existing.heartRateBpm,
      systolicMmHg: data.systolicMmHg ?? existing.systolicMmHg,
      diastolicMmHg: data.diastolicMmHg ?? existing.diastolicMmHg,
      glucoseMgDl: data.glucoseMgDl ?? existing.glucoseMgDl,
      temperatureC: data.temperatureC ?? existing.temperatureC,
      spo2Pct: data.spo2Pct ?? existing.spo2Pct,
      sleepHours: data.sleepHours ?? existing.sleepHours,
      mood: data.mood ?? existing.mood,
    };

    assertValidVitals(mergedMetrics);

    const evaluation = evaluateReading(mergedMetrics);

    const updated = await this.readingRepo.update(id, {
      ...mergedMetrics,
      status: evaluation.status,
      alerts: evaluation.alerts,
      recommendation:
        data.recommendation !== undefined ? data.recommendation : evaluation.recommendation,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      takenAt: data.takenAt ?? existing.takenAt,
    });

    if (!updated) {
      throw new NotFoundError("Lectura de salud", id);
    }

    if (this.openIncidentUseCase && evaluation.alerts.length > 0) {
      await openMedicalIncidentsFromReading(
        this.openIncidentUseCase,
        updated.astronautId,
        updated.id,
        evaluation
      );
    }

    return updated;
  }
}

