import { HealthStatus } from "@prisma/client";
import { NOAAStormScale } from "@nsa2026/radiation-engine";

const S3_OR_HIGHER: ReadonlySet<string> = new Set([
  "S3_STRONG",
  "S4_SEVERE",
  "S5_EXTREME",
]);

export function isS3OrHigherStorm(stormScale: string | null | undefined): boolean {
  return Boolean(stormScale && S3_OR_HIGHER.has(stormScale));
}

export interface CorrelatedTriageFields {
  priorityBoosted: boolean;
  triagePriorityScore: number;
  triagePriorityLabel: string;
  adaptedProtocol: string | null;
  recommendation: string | null;
}

export function correlateTriageWithRadiation(
  status: HealthStatus,
  recommendation: string | null,
  stormScale: NOAAStormScale | string | null | undefined
): CorrelatedTriageFields {
  const stormActive = isS3OrHigherStorm(stormScale);

  if (stormActive && status === HealthStatus.CRITICAL) {
    const shelterNote = `ATENCIÓN EN REFUGIO ANTITORMENTA (${stormScale}): Prohibido EVA o traslado por módulo sin blindaje; atender y estabilizar al tripulante dentro del refugio.`;
    return {
      priorityBoosted: true,
      triagePriorityScore: 0,
      triagePriorityLabel: "P0_STORM_CRITICAL",
      adaptedProtocol: shelterNote,
      recommendation: recommendation ? `${shelterNote} | ${recommendation}` : shelterNote,
    };
  }

  const baseScore: Record<HealthStatus, number> = {
    CRITICAL: 1,
    WARNING: 2,
    OK: 3,
  };

  return {
    priorityBoosted: false,
    triagePriorityScore: baseScore[status],
    triagePriorityLabel:
      status === HealthStatus.CRITICAL
        ? "P1_CRITICAL"
        : status === HealthStatus.WARNING
          ? "P2_WARNING"
          : "P3_NOMINAL",
    adaptedProtocol: null,
    recommendation,
  };
}
