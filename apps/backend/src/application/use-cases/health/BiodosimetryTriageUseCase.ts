import { Role } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../../../domain/errors/AppError.js";
import { IAstronautRepository } from "../../../domain/repository/IAstronautRepository.js";
import { IHealthReadingRepository } from "../../../domain/repository/IHealthReadingRepository.js";

export type ShieldingType = "EVA_SUIT" | "CREW_CABIN_NOMINAL" | "STORM_SHELTER";

export interface BiodosimetryTriageInput {
  astronautId?: string;
  requestingUserId?: string;
  requestingUserRole?: Role;
  shieldingType?: ShieldingType;
  healthReading?: Record<string, unknown>;
  radiationState?: Record<string, unknown>;
  biomarkers?: {
    gammaH2axFociPerCell?: number;
    urine8OhdgNgMg?: number;
    fdxrFoldChange?: number;
  };
}

export interface BiodosimetryAttributionResponse {
  primaryCause: "NOMINAL" | "IONIZING_RADIATION" | "MICROGRAVITY_STRESS" | "SLEEP_PSYCH_STRESS";
  confidence: number;
  falsePositiveFiltered: boolean;
  oxidativeStressDetected: boolean;
  attribution: {
    nominalPct: number;
    ionizingRadiationPct: number;
    microgravityStressPct: number;
    sleepPsychStressPct: number;
  };
  clinicalGuidance: string[];
  explanation: string;
}

export interface BiodosimetryTriageResult {
  astronautId: string | null;
  shieldingType: ShieldingType;
  radiationSource: "radiation-engine" | "request-override" | "fallback-nominal";
  healthReadingTimestamp: string | null;
  triage: BiodosimetryAttributionResponse;
}

const DEFAULT_RADIATION_ENGINE_URL = process.env.RADIATION_ENGINE_URL || "http://localhost:4001";
const DEFAULT_SIGNAL_NOISE_URL = process.env.SIGNAL_NOISE_ENGINE_URL || "http://localhost:8001";

function buildNominalRadiationFallback(): Record<string, unknown> {
  return {
    currentTelemetry: { stormScale: "S0_NOMINAL" },
    biologicalDoses: {
      EVA_SUIT: { doseRateMicroSvPerHour: 28.0 },
      CREW_CABIN_NOMINAL: { doseRateMicroSvPerHour: 18.0 },
      STORM_SHELTER: { doseRateMicroSvPerHour: 4.0 },
    },
  };
}

export class BiodosimetryTriageUseCase {
  constructor(
    private readonly readingRepo: IHealthReadingRepository,
    private readonly astronautRepo: IAstronautRepository
  ) {}

  async execute(input: BiodosimetryTriageInput): Promise<BiodosimetryTriageResult> {
    const shieldingType: ShieldingType = input.shieldingType ?? "CREW_CABIN_NOMINAL";
    let targetAstronautId = input.astronautId ?? null;

    if (input.requestingUserId && input.requestingUserRole !== Role.ADMIN) {
      const ownAstronaut = this.astronautRepo.findByUserId
        ? await this.astronautRepo.findByUserId(input.requestingUserId)
        : null;
      if (targetAstronautId && targetAstronautId !== ownAstronaut?.id) {
        throw new ForbiddenError("No tienes permiso para ejecutar triaje sobre otro tripulante.");
      }
      targetAstronautId = ownAstronaut?.id ?? null;
    }

    let readingPayload: Record<string, unknown> | null = input.healthReading
      ? { ...input.healthReading }
      : null;
    let healthReadingTimestamp: string | null = null;

    if (!readingPayload) {
      const latest = await this.readingRepo.findMany({
        page: 1,
        limit: 1,
        astronautId: targetAstronautId ?? undefined,
      });

      const first = latest.data[0];
      if (!first) {
        throw new NotFoundError("HealthReading");
      }

      targetAstronautId = first.astronautId;
      healthReadingTimestamp = first.takenAt.toISOString();
      readingPayload = {
        heartRateBpm: first.heartRateBpm,
        systolicMmHg: first.systolicMmHg,
        diastolicMmHg: first.diastolicMmHg,
        glucoseMgDl: first.glucoseMgDl,
        temperatureC: first.temperatureC,
        spo2Pct: first.spo2Pct,
        sleepHours: first.sleepHours,
        mood: first.mood,
      };
    }

    if (input.biomarkers) {
      if (input.biomarkers.gammaH2axFociPerCell !== undefined) {
        readingPayload.gammaH2axFociPerCell = input.biomarkers.gammaH2axFociPerCell;
      }
      if (input.biomarkers.urine8OhdgNgMg !== undefined) {
        readingPayload.urine8OhdgNgMg = input.biomarkers.urine8OhdgNgMg;
      }
      if (input.biomarkers.fdxrFoldChange !== undefined) {
        readingPayload.fdxrFoldChange = input.biomarkers.fdxrFoldChange;
      }
    }

    let radiationState = input.radiationState;
    let radiationSource: BiodosimetryTriageResult["radiationSource"] = "request-override";

    if (!radiationState) {
      try {
        const radRes = await fetch(`${DEFAULT_RADIATION_ENGINE_URL}/api/radiation/status`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!radRes.ok) {
          throw new Error(`Radiation engine HTTP ${radRes.status}`);
        }
        radiationState = (await radRes.json()) as Record<string, unknown>;
        radiationSource = "radiation-engine";
      } catch {
        radiationState = buildNominalRadiationFallback();
        radiationSource = "fallback-nominal";
      }
    }

    const triageRes = await fetch(`${DEFAULT_SIGNAL_NOISE_URL}/api/biodosimetry/triage-from-engine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shieldingType,
        healthReading: readingPayload,
        radiationState,
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (!triageRes.ok) {
      const detail = await triageRes.text().catch(() => "");
      throw new Error(`Signal vs. Noise engine error (${triageRes.status}): ${detail}`);
    }

    const triage = (await triageRes.json()) as BiodosimetryAttributionResponse;

    return {
      astronautId: targetAstronautId,
      shieldingType,
      radiationSource,
      healthReadingTimestamp,
      triage,
    };
  }
}
