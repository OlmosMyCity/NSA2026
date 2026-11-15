/**
 * @module service/health/correlation
 * Cross-domain triage correlation combining clinical health reading severity with
 * active NOAA solar radiation storm scales (`S3_STRONG` through `S5_EXTREME`).
 */

import { HealthStatus } from "@prisma/client";
import { NOAAStormScale } from "../radiation/engine/index.js";

const S3_OR_HIGHER: ReadonlySet<string> = new Set([
  "S3_STRONG",
  "S4_SEVERE",
  "S5_EXTREME",
]);

/** Returns `true` when the NOAA storm scale is `S3_STRONG` or higher (`S3`–`S5`). */
export function isS3OrHigherStorm(stormScale: string | null | undefined): boolean {
  return Boolean(stormScale && S3_OR_HIGHER.has(stormScale));
}

/** Triage priority metadata computed from biomedical status and radiation storm state. */
export interface CorrelatedTriageFields {
  priorityBoosted: boolean;
  triagePriorityScore: number;
  triagePriorityLabel: string;
  adaptedProtocol: string | null;
  recommendation: string | null;
}

/**
 * Correlates a deterministic health reading status with the active solar storm scale.
 *
 * Invariant: A `CRITICAL` reading during an `S3_STRONG`+ solar storm elevates triage to
 * `P0_STORM_CRITICAL` (score `0`), prohibits EVA or unshielded module transit, and
 * prepends an in-shelter stabilization directive to `recommendation`.
 */
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
