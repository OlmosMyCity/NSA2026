/**
 * @module service/health/BiodosimetryTriageUseCase
 * Use case orchestrating Signal vs. Noise biodosimetry attribution across biomedical vitals,
 * optional radiation biomarkers (gamma-H2AX, urinary 8-OHdG, FDXR fold change), and live
 * space-weather radiation telemetry.
 */

import { Role } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../../exception/AppError.js";
import { IAstronautRepository } from "../../repository/IAstronautRepository.js";
import { IHealthReadingRepository } from "../../repository/IHealthReadingRepository.js";
import { radiationEngine } from "../radiation/radiationEngine.js";

/** Shielding configuration submitted for radiation dose attenuation attribution. */
export type ShieldingType = "EVA_SUIT" | "CREW_CABIN_NOMINAL" | "STORM_SHELTER";

/** Input contract for biodosimetry differential triage execution. */
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

/** Attribution percentages and clinical guidance returned by the Signal vs. Noise microservice. */
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

/** Full biodosimetry triage response including radiation telemetry provenance and degradation flag. */
export interface BiodosimetryTriageResult {
  astronautId: string | null;
  shieldingType: ShieldingType;
  radiationSource: "radiation-engine" | "request-override" | "fallback-nominal";
  telemetryDegraded: boolean;
  healthReadingTimestamp: string | null;
  triage: BiodosimetryAttributionResponse;
}

const DEFAULT_SIGNAL_NOISE_URL = process.env.SIGNAL_NOISE_ENGINE_URL || "http://localhost:8001";

function buildNominalRadiationFallback(): Record<string, unknown> {
  return {
    telemetryDegraded: true,
    currentTelemetry: { stormScale: "S0_NOMINAL" },
    biologicalDoses: {
      EVA_SUIT: { doseRateMicroSvPerHour: 28.0 },
      CREW_CABIN_NOMINAL: { doseRateMicroSvPerHour: 18.0 },
      STORM_SHELTER: { doseRateMicroSvPerHour: 4.0 },
    },
  };
}

/**
 * Orchestrates biodosimetry differential diagnosis to distinguish ionizing-radiation injury
 * from microgravity fluid shifts or sleep/psychosocial confounders.
 *
 * Invariants:
 * - Only `ADMIN` (Flight Surgeon) may supply manual `healthReading` / `radiationState`
 *   overrides or execute triage on another crew member.
 * - Radiation state resolves via: request override -> injected provider -> external
 *   `RADIATION_ENGINE_URL` -> in-process `radiationEngine` -> nominal degraded fallback.
 */
export class BiodosimetryTriageUseCase {
  constructor(
    private readonly readingRepo: IHealthReadingRepository,
    private readonly astronautRepo: IAstronautRepository,
    private readonly radiationStatusProvider?: () => Promise<Record<string, unknown>>
  ) {}

  private async resolveRadiationState(
    overrideState?: Record<string, unknown>
  ): Promise<{
    radiationState: Record<string, unknown>;
    radiationSource: BiodosimetryTriageResult["radiationSource"];
    telemetryDegraded: boolean;
  }> {
    if (overrideState) {
      return {
        radiationState: overrideState,
        radiationSource: "request-override",
        telemetryDegraded: Boolean((overrideState as { telemetryDegraded?: unknown }).telemetryDegraded),
      };
    }

    const externalEngineUrl = process.env.RADIATION_ENGINE_URL;
    if (this.radiationStatusProvider) {
      try {
        const state = await this.radiationStatusProvider();
        return {
          radiationState: state,
          radiationSource: "radiation-engine",
          telemetryDegraded: Boolean((state as { telemetryDegraded?: unknown }).telemetryDegraded),
        };
      } catch {
        return {
          radiationState: buildNominalRadiationFallback(),
          radiationSource: "fallback-nominal",
          telemetryDegraded: true,
        };
      }
    }

    if (externalEngineUrl) {
      try {
        const radRes = await fetch(`${externalEngineUrl.replace(/\/+$/, "")}/api/radiation/status`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!radRes.ok) {
          throw new Error(`Radiation engine HTTP ${radRes.status}`);
        }
        const state = (await radRes.json()) as Record<string, unknown>;
        return {
          radiationState: state,
          radiationSource: "radiation-engine",
          telemetryDegraded: Boolean((state as { telemetryDegraded?: unknown }).telemetryDegraded),
        };
      } catch {
        // Fall back to the in-process radiation engine before declaring telemetry degraded
      }
    }

    try {
      const state = (await radiationEngine.getCurrentState()) as unknown as Record<string, unknown>;
      return {
        radiationState: state,
        radiationSource: "radiation-engine",
        telemetryDegraded: Boolean((state as { telemetryDegraded?: unknown }).telemetryDegraded),
      };
    } catch {
      return {
        radiationState: buildNominalRadiationFallback(),
        radiationSource: "fallback-nominal",
        telemetryDegraded: true,
      };
    }
  }

  async execute(input: BiodosimetryTriageInput): Promise<BiodosimetryTriageResult> {
    const shieldingType: ShieldingType = input.shieldingType ?? "CREW_CABIN_NOMINAL";
    let targetAstronautId = input.astronautId ?? null;

    if (input.requestingUserRole && input.requestingUserRole !== Role.ADMIN) {
      if (input.healthReading !== undefined || input.radiationState !== undefined) {
        throw new ForbiddenError(
          "Only the Flight Surgeon (ADMIN) can submit manual telemetry overrides."
        );
      }
    }

    if (input.requestingUserId && input.requestingUserRole !== Role.ADMIN) {
      const ownAstronaut = this.astronautRepo.findByUserId
        ? await this.astronautRepo.findByUserId(input.requestingUserId)
        : null;
      if (targetAstronautId && targetAstronautId !== ownAstronaut?.id) {
        throw new ForbiddenError("You do not have permission to run triage for another crewmember.");
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

    const { radiationState, radiationSource, telemetryDegraded } = await this.resolveRadiationState(
      input.radiationState
    );

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.AI_SERVICE_TOKEN) {
      headers["X-Service-Token"] = process.env.AI_SERVICE_TOKEN;
    }

    const triageRes = await fetch(`${DEFAULT_SIGNAL_NOISE_URL}/api/biodosimetry/triage-from-engine`, {
      method: "POST",
      headers,
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
      telemetryDegraded,
      healthReadingTimestamp,
      triage,
    };
  }
}
