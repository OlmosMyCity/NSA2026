/**
 * @module application/use-cases/health/CreateHealthReadingUseCase
 * Use case for validating, deterministically evaluating, persisting, and alerting on
 * new astronaut biomedical health readings.
 */

import { HealthReading } from "@prisma/client";
import { IHealthReadingRepository } from "../../../domain/repository/IHealthReadingRepository.js";
import { CreateHealthReadingDTO } from "../../../domain/models/HealthReading.js";
import { evaluateReading } from "../../health/evaluateReading.js";
import { ValidationError } from "../../../domain/errors/AppError.js";
import { OpenIncidentUseCase } from "../incident/OpenIncidentUseCase.js";
import { openMedicalIncidentsFromReading } from "../incident/syncSystemIncidents.js";

/**
 * Validates that all 8 physiological/behavioral metrics are finite numbers, cardiovascular
 * vitals (`heartRateBpm`, `systolicMmHg`, `diastolicMmHg`) are positive, and `mood` is in `1..5`.
 */
export function assertValidVitals(metrics: {
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  glucoseMgDl: number;
  temperatureC: number;
  spo2Pct: number;
  sleepHours: number;
  mood: number;
}): void {
  const numericValues = [
    metrics.heartRateBpm,
    metrics.systolicMmHg,
    metrics.diastolicMmHg,
    metrics.glucoseMgDl,
    metrics.temperatureC,
    metrics.spo2Pct,
    metrics.sleepHours,
    metrics.mood,
  ];

  if (numericValues.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    throw new ValidationError("Todos los indicadores vitales deben ser números finitos válidos.");
  }

  if (metrics.heartRateBpm <= 0 || metrics.systolicMmHg <= 0 || metrics.diastolicMmHg <= 0) {
    throw new ValidationError("Los valores cardiovasculares deben ser números positivos.");
  }

  if (metrics.mood < 1 || metrics.mood > 5) {
    throw new ValidationError("El estado de ánimo debe estar entre 1 y 5.");
  }
}

/**
 * Validates incoming vital metrics, runs deterministic NASA HRP rule evaluation (`evaluateReading`),
 * persists the annotated `HealthReading`, and opens deduplicated medical incidents for any alerts.
 */
export class CreateHealthReadingUseCase {
  constructor(
    private readonly readingRepo: IHealthReadingRepository,
    private readonly openIncidentUseCase?: OpenIncidentUseCase
  ) {}

  async execute(dto: CreateHealthReadingDTO): Promise<HealthReading> {
    if (!dto.astronautId) {
      throw new ValidationError("El ID del astronauta es obligatorio.");
    }

    assertValidVitals(dto);

    // 1. Evaluate clinically using deterministic NASA HRP rules
    const evaluation = evaluateReading({
      heartRateBpm: dto.heartRateBpm,
      systolicMmHg: dto.systolicMmHg,
      diastolicMmHg: dto.diastolicMmHg,
      glucoseMgDl: dto.glucoseMgDl,
      temperatureC: dto.temperatureC,
      spo2Pct: dto.spo2Pct,
      sleepHours: dto.sleepHours,
      mood: dto.mood,
    });

    // 2. Persist reading with deterministic clinical status, alerts, and recommendation
    const created = await this.readingRepo.create({
      astronautId: dto.astronautId,
      heartRateBpm: dto.heartRateBpm,
      systolicMmHg: dto.systolicMmHg,
      diastolicMmHg: dto.diastolicMmHg,
      glucoseMgDl: dto.glucoseMgDl,
      temperatureC: dto.temperatureC,
      spo2Pct: dto.spo2Pct,
      sleepHours: dto.sleepHours,
      mood: dto.mood,
      status: evaluation.status,
      alerts: evaluation.alerts,
      recommendation: evaluation.recommendation,
      notes: dto.notes,
      takenAt: dto.takenAt,
    });

    // 3. Open deduplicated medical incidents for triggered alerts
    if (this.openIncidentUseCase && evaluation.alerts.length > 0) {
      await openMedicalIncidentsFromReading(
        this.openIncidentUseCase,
        created.astronautId,
        created.id,
        evaluation
      );
    }

    return created;
  }
}

