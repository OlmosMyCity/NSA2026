import { HealthReading } from "@prisma/client";
import { IHealthReadingRepository } from "../../../domain/repository/IHealthReadingRepository.js";
import { CreateHealthReadingDTO } from "../../../domain/models/HealthReading.js";
import { evaluateReading } from "../../health/evaluateReading.js";
import { ValidationError } from "../../../domain/errors/AppError.js";

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

export class CreateHealthReadingUseCase {
  constructor(private readonly readingRepo: IHealthReadingRepository) {}

  async execute(dto: CreateHealthReadingDTO): Promise<HealthReading> {
    if (!dto.astronautId) {
      throw new ValidationError("El ID del astronauta es obligatorio.");
    }

    assertValidVitals(dto);

    // 1. Evaluar clínicamente con la regla pura de la NASA
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

    // 2. Persistir lectura con diagnóstico y alertas
    return this.readingRepo.create({
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
  }
}

