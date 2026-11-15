import { HealthReading, Incident, IncidentCategory, IncidentSeverity, IncidentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../../infrastructure/database/prismaClient.js";
import { NotFoundError, ValidationError } from "../../../domain/errors/AppError.js";
import { evaluateReading, HealthAlert } from "../../health/evaluateReading.js";
import { incidentNotificationBus } from "../../incident/incidentNotificationBus.js";

export interface VisionTelemetryIngestDTO {
  astronautId: string;
  heartRateBpm: number;
  mood?: number;
  moodValence?: number;
  stressIndex?: number;
  alertnessScore?: number;
  dominantMood?: string;
  sleepHours?: number;
  sleepQualityScore?: number;
  perclos?: number;
  hrvRmssdMs?: number;
  respirationRpm?: number;
  signalQuality?: number;
  overallHealthIndex?: number;
  cameraMode?: string;
  context?: string;
  fatigueLevel?: string;
  identityConfidence?: number;
  recordedById?: string | null;
  notes?: string | null;
  takenAt?: Date | null;
}

export interface VisionIngestResult {
  reading: HealthReading;
  incidentsTriggered: number;
  derivedVitals: {
    heartRateBpm: number;
    mood: number;
    sleepHours: number;
  };
}

const INDICATOR_LABELS: Record<string, string> = {
  heartRate: "Frecuencia cardiaca",
  bloodPressure: "Presión arterial",
  glucose: "Glucosa en sangre",
  temperature: "Temperatura corporal",
  spo2: "Saturación de O2 (SpO2)",
  sleep: "Horas de sueño",
  mood: "Estado de ánimo",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Maps Vision AI mood_valence (-1..+1) and stress_index (0..100) to the 1..5 NASA HRP mood scale.
 */
export function deriveMoodScore(dto: VisionTelemetryIngestDTO, fallbackMood = 4): number {
  if (typeof dto.mood === "number" && Number.isFinite(dto.mood)) {
    return clamp(Math.round(dto.mood), 1, 5);
  }
  if (typeof dto.moodValence === "number" && Number.isFinite(dto.moodValence)) {
    const baseFromValence = ((clamp(dto.moodValence, -1, 1) + 1) / 2) * 4 + 1;
    const stressPenalty =
      typeof dto.stressIndex === "number" && Number.isFinite(dto.stressIndex)
        ? (clamp(dto.stressIndex, 0, 100) / 100) * 1.2
        : 0;
    return clamp(Math.round(baseFromValence - stressPenalty), 1, 5);
  }
  if (typeof dto.stressIndex === "number" && Number.isFinite(dto.stressIndex)) {
    return clamp(Math.round(5 - (clamp(dto.stressIndex, 0, 100) / 100) * 4), 1, 5);
  }
  return clamp(Math.round(fallbackMood), 1, 5);
}

/**
 * Derives sleepHours (0..24) from explicit sleepHours, Vision sleepQualityScore, or latest reading.
 */
export function deriveSleepHours(dto: VisionTelemetryIngestDTO, fallbackSleepHours = 7.5): number {
  if (typeof dto.sleepHours === "number" && Number.isFinite(dto.sleepHours)) {
    return Number(clamp(dto.sleepHours, 0, 24).toFixed(2));
  }
  if (typeof dto.sleepQualityScore === "number" && Number.isFinite(dto.sleepQualityScore)) {
    // Maps 0..100 sleep quality score onto a realistic 4.0..9.0 hour equivalent
    const mapped = 4.0 + (clamp(dto.sleepQualityScore, 0, 100) / 100) * 5.0;
    return Number(mapped.toFixed(2));
  }
  return Number(clamp(fallbackSleepHours, 0, 24).toFixed(2));
}

function buildVisionNotes(dto: VisionTelemetryIngestDTO): string | null {
  if (dto.notes && dto.notes.trim()) {
    return dto.notes.trim().slice(0, 1000);
  }
  if (typeof dto.identityConfidence === "number" && Number.isFinite(dto.identityConfidence) && dto.identityConfidence > 0) {
    return `Optical biometric ingestion (Face ID match ${dto.identityConfidence.toFixed(1)}%).`;
  }
  return null;
}

export type TransactionRunner = <T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
) => Promise<T>;

export class IngestVisionTelemetryUseCase {
  constructor(
    private readonly runInTransaction: TransactionRunner = (fn) => prisma.$transaction(fn)
  ) {}

  async execute(dto: VisionTelemetryIngestDTO): Promise<VisionIngestResult> {
    if (!dto.astronautId?.trim()) {
      throw new ValidationError("El ID del astronauta es obligatorio.");
    }

    const pendingNotifications: Array<{ event: "incident:opened" | "incident:escalated"; incident: Incident; reason?: string }> = [];

    const result = await this.runInTransaction(async (tx) => {
      const astronaut = await tx.astronaut.findFirst({
        where: { id: dto.astronautId, deletedAt: null },
        select: { id: true },
      });

      if (!astronaut) {
        throw new NotFoundError("Astronauta no encontrado.");
      }

      const latest = await tx.healthReading.findFirst({
        where: { astronautId: dto.astronautId, isValid: true },
        orderBy: { takenAt: "desc" },
      });

      const resolvedHeartRate =
        dto.heartRateBpm > 0
          ? clamp(Math.round(dto.heartRateBpm), 20, 260)
          : latest?.heartRateBpm ?? 72;

      const resolvedMood = deriveMoodScore(dto, latest?.mood ?? 4);
      const resolvedSleepHours = deriveSleepHours(dto, latest?.sleepHours ?? 7.5);
      const systolicMmHg = latest?.systolicMmHg ?? 118;
      const diastolicMmHg = latest?.diastolicMmHg ?? 76;
      const glucoseMgDl = latest?.glucoseMgDl ?? 95;
      const temperatureC = latest?.temperatureC ?? 36.6;
      const spo2Pct = latest?.spo2Pct ?? 98;

      const evaluation = evaluateReading({
        heartRateBpm: resolvedHeartRate,
        systolicMmHg,
        diastolicMmHg,
        glucoseMgDl,
        temperatureC,
        spo2Pct,
        sleepHours: resolvedSleepHours,
        mood: resolvedMood,
      });

      const createdReading = await tx.healthReading.create({
        data: {
          astronautId: dto.astronautId,
          heartRateBpm: resolvedHeartRate,
          systolicMmHg,
          diastolicMmHg,
          glucoseMgDl,
          temperatureC,
          spo2Pct,
          sleepHours: resolvedSleepHours,
          mood: resolvedMood,
          status: evaluation.status,
          alerts: evaluation.alerts as unknown as Prisma.InputJsonValue,
          recommendation: evaluation.recommendation,
          notes: buildVisionNotes(dto),
          takenAt: dto.takenAt ?? new Date(),
          recordedById: dto.recordedById ?? null,
        },
      });

      let incidentsTriggered = 0;

      for (const alert of evaluation.alerts as HealthAlert[]) {
        const severity = alert.level === "CRITICAL" ? IncidentSeverity.CRITICAL : IncidentSeverity.WARNING;
        const label = INDICATOR_LABELS[alert.indicator] ?? alert.indicator;
        const title = `Alerta médica (${alert.level}): ${label}`;

        const existing = await tx.incident.findFirst({
          where: {
            type: alert.indicator,
            astronautId: dto.astronautId,
            status: { in: [IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED] },
          },
          orderBy: { openedAt: "desc" },
        });

        const metadata = {
          indicator: alert.indicator,
          protocolId: alert.protocolId,
          value: alert.value,
          readingStatus: evaluation.status,
          origin: "VISION_AI",
        };

        if (existing) {
          if (existing.severity === IncidentSeverity.WARNING && severity === IncidentSeverity.CRITICAL) {
            const escalated = await tx.incident.update({
              where: { id: existing.id },
              data: {
                severity: IncidentSeverity.CRITICAL,
                title,
                description: alert.message,
                readingId: createdReading.id,
                protocolId: alert.protocolId,
                metadata,
              },
            });
            pendingNotifications.push({
              event: "incident:escalated",
              incident: escalated,
              reason: "Severidad escalada a CRITICAL",
            });
            incidentsTriggered += 1;
          }
        } else {
          const opened = await tx.incident.create({
            data: {
              category: IncidentCategory.MEDICAL,
              type: alert.indicator,
              severity,
              status: IncidentStatus.OPEN,
              title,
              description: alert.message,
              astronautId: dto.astronautId,
              source: "HEALTH_READING",
              readingId: createdReading.id,
              protocolId: alert.protocolId,
              metadata,
            },
          });
          pendingNotifications.push({
            event: "incident:opened",
            incident: opened,
          });
          incidentsTriggered += 1;
        }
      }

      return {
        reading: createdReading,
        incidentsTriggered,
        derivedVitals: {
          heartRateBpm: resolvedHeartRate,
          mood: resolvedMood,
          sleepHours: resolvedSleepHours,
        },
      };
    });

    for (const item of pendingNotifications) {
      incidentNotificationBus.publish(item.event, item.incident, item.reason);
    }

    return result;
  }
}
