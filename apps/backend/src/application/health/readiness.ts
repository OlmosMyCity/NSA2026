import { BODY_ZONES, type BodyZoneId } from "./hazards.js";
import type { ZoneHealthStatus } from "./digitalTwin.js";

/**
 * Aptitud por destino. Regla pura y determinista: estado por zona + vigencia + destino
 * → veredicto + motivo. Es orientación para la tripulación y el operador; la decisión
 * sigue siendo del oficial médico.
 *
 * La matriz es una propuesta del equipo (CMO_CONFIGURABLE), no un criterio de la NASA.
 */

export const DESTINATIONS = ["EVA", "ROVER", "HABITAT", "MODULE_TRANSFER", "STORM_SHELTER"] as const;
export type Destination = (typeof DESTINATIONS)[number];

export type ReadinessVerdict = "FIT" | "FIT_WITH_CAUTION" | "NOT_FIT" | "NO_DATA";

export type ReadinessReason =
  | "ALL_NOMINAL"
  | "RECOVERY_WATCH"
  | "VITAL_WATCH"
  | "CRITICAL_FINDING"
  | "READING_EXPIRED"
  | "PROTECTIVE_SHELTER";

export interface DestinationReadiness {
  destination: Destination;
  verdict: ReadinessVerdict;
  reasonCode: ReadinessReason;
}

/** Zonas cuyo deterioro compromete de inmediato una actividad exigente. */
const VITAL_ZONES: readonly BodyZoneId[] = ["heart", "blood", "brain"];

type Condition = Exclude<ReadinessReason, "READING_EXPIRED" | "PROTECTIVE_SHELTER">;

/** Veredicto de cada destino según la condición clínica. El refugio no está aquí: nunca se bloquea. */
const DESTINATION_PROFILES: Record<Exclude<Destination, "STORM_SHELTER">, Record<Condition, ReadinessVerdict>> = {
  EVA: {
    ALL_NOMINAL: "FIT",
    RECOVERY_WATCH: "FIT_WITH_CAUTION",
    VITAL_WATCH: "NOT_FIT",
    CRITICAL_FINDING: "NOT_FIT",
  },
  ROVER: {
    ALL_NOMINAL: "FIT",
    RECOVERY_WATCH: "FIT_WITH_CAUTION",
    VITAL_WATCH: "FIT_WITH_CAUTION",
    CRITICAL_FINDING: "NOT_FIT",
  },
  HABITAT: {
    ALL_NOMINAL: "FIT",
    RECOVERY_WATCH: "FIT",
    VITAL_WATCH: "FIT_WITH_CAUTION",
    CRITICAL_FINDING: "NOT_FIT",
  },
  MODULE_TRANSFER: {
    ALL_NOMINAL: "FIT",
    RECOVERY_WATCH: "FIT",
    VITAL_WATCH: "FIT",
    CRITICAL_FINDING: "FIT_WITH_CAUTION",
  },
};

export interface ReadinessInput {
  zoneStatus: Record<BodyZoneId, ZoneHealthStatus>;
  /** Los signos vivos de la última lectura siguen vigentes. */
  isFresh: boolean;
}

function classify(zoneStatus: Record<BodyZoneId, ZoneHealthStatus>): Condition {
  if (BODY_ZONES.some((zone) => zoneStatus[zone] === "red")) return "CRITICAL_FINDING";
  if (VITAL_ZONES.some((zone) => zoneStatus[zone] === "amber")) return "VITAL_WATCH";
  if (BODY_ZONES.some((zone) => zoneStatus[zone] === "amber")) return "RECOVERY_WATCH";
  return "ALL_NOMINAL";
}

export function evaluateReadiness(input: ReadinessInput, destination: Destination): DestinationReadiness {
  // Ir al refugio es una medida de protección: no depende del estado ni de la vigencia.
  if (destination === "STORM_SHELTER") {
    return { destination, verdict: "FIT", reasonCode: "PROTECTIVE_SHELTER" };
  }

  // Sin signos vivos vigentes, o sin datos en una zona vital, no hay veredicto.
  const lacksVitalData = VITAL_ZONES.some((zone) => input.zoneStatus[zone] === "unknown");
  if (!input.isFresh || lacksVitalData) {
    return { destination, verdict: "NO_DATA", reasonCode: "READING_EXPIRED" };
  }

  const condition = classify(input.zoneStatus);
  return { destination, verdict: DESTINATION_PROFILES[destination][condition], reasonCode: condition };
}

export function evaluateAllDestinations(input: ReadinessInput): DestinationReadiness[] {
  return DESTINATIONS.map((destination) => evaluateReadiness(input, destination));
}
