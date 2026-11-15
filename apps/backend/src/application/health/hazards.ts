/**
 * @module application/health/hazards
 * Matrix of the 5 Hazards of Human Spaceflight (NASA Human Research Program — HRP)
 * and mission habitat environment profiles with radiation shielding modifiers.
 *
 * Conceptual reference: NASA HRP — The 5 Hazards of Human Spaceflight
 * (https://www.nasa.gov/hrp/hazards) and `docs/NASA_SPACE_APPS_CHALLENGE.md`.
 */

/** Physiological body zones modeled by the Astronaut Digital Twin. */
export type BodyZoneId = "heart" | "brain" | "blood" | "bones" | "sleep";

/** Five canonical spaceflight health hazards defined by the NASA Human Research Program. */
export type SpaceHazard =
  | "radiation"
  | "isolation"
  | "distance"
  | "gravity"
  | "hostileEnvironment";

/** Operational habitat profiles that determine baseline environmental hazard intensity. */
export type MissionEnvironment =
  | "SPACECRAFT"
  | "STATION"
  | "ROVER"
  | "LUNAR_BASE"
  | "MARS_BASE";

/** Crew shielding configuration modulating ionizing radiation exposure. */
export type ShieldingType =
  | "EVA_SUIT"
  | "CREW_CABIN_NOMINAL"
  | "STORM_SHELTER";

/** NOAA Space Weather Prediction Center solar radiation storm scale (S0 nominal to S5 extreme). */
export type NOAAStormScale =
  | "S0_NOMINAL"
  | "S1_MINOR"
  | "S2_MODERATE"
  | "S3_STRONG"
  | "S4_SEVERE"
  | "S5_EXTREME";

/** Active radiation storm and shielding state injected into Digital Twin hazard evaluations. */
export interface RadiationContext {
  stormScale: NOAAStormScale;
  shielding: ShieldingType;
  /** Optional >10 MeV proton flux in particle flux units (pfu), informational only. */
  fluxPfu?: number;
}

/** Normalized [0, 1] environmental hazard load aggregated onto a single body zone. */
export interface ZoneHazardLoad {
  /** Normalized aggregate environmental load [0, 1] across all 5 hazards on this zone. */
  total: number;
  /** Space hazard contributing the highest weighted impact in this zone. */
  topHazard: SpaceHazard;
  /** Individual weighted contribution [0, 1] for each HRP space hazard. */
  breakdown: Record<SpaceHazard, number>;
}

/** Canonical ordered list of body zones evaluated by the Digital Twin and decision engine. */
export const BODY_ZONES: readonly BodyZoneId[] = [
  "heart",
  "brain",
  "blood",
  "bones",
  "sleep",
] as const;

/** Canonical ordered list of the 5 NASA HRP spaceflight hazards. */
export const SPACE_HAZARDS: readonly SpaceHazard[] = [
  "radiation",
  "isolation",
  "distance",
  "gravity",
  "hostileEnvironment",
] as const;

/**
 * Base physiological sensitivity weights [0..1] mapping how each HRP hazard affects each body zone:
 * - `radiation`: immune/hematologic system (`blood`: 0.95), CNS (`brain`: 0.55), cardiovascular (`heart`: 0.45)
 * - `isolation`: mood/cognition (`brain`: 0.95), circadian rhythm (`sleep`: 0.90), stress response (`heart`: 0.35)
 * - `distance`: autonomy/comms-delay stress (`brain`: 0.75), metabolic/nutrition (`blood`: 0.60)
 * - `gravity`: bone/muscle loss (`bones`: 0.95), cephalad fluid shift (`heart`: 0.85), `sleep` (0.30)
 * - `hostileEnvironment`: CO2/O2 & thermal regulation (`blood`: 0.90), cabin noise/lighting (`sleep`: 0.55)
 */
export const HAZARD_ZONE_WEIGHTS: Record<SpaceHazard, Record<BodyZoneId, number>> = {
  radiation: {
    heart: 0.45,
    brain: 0.55,
    blood: 0.95,
    bones: 0.25,
    sleep: 0.20,
  },
  isolation: {
    heart: 0.35,
    brain: 0.95,
    blood: 0.25,
    bones: 0.15,
    sleep: 0.90,
  },
  distance: {
    heart: 0.30,
    brain: 0.75,
    blood: 0.60,
    bones: 0.25,
    sleep: 0.45,
  },
  gravity: {
    heart: 0.85,
    brain: 0.35,
    blood: 0.40,
    bones: 0.95,
    sleep: 0.30,
  },
  hostileEnvironment: {
    heart: 0.50,
    brain: 0.45,
    blood: 0.90,
    bones: 0.20,
    sleep: 0.55,
  },
};

/**
 * Habitat environment profiles defining baseline hazard intensity [0..1]:
 * - `SPACECRAFT` (Orion): cislunar transit, confined volume, microgravity.
 * - `STATION` (Gateway / ISS): stronger life support & routine, prolonged microgravity.
 * - `ROVER`: direct surface exposure, high hostile-environment and radiation risk.
 * - `LUNAR_BASE`: 1/6 g partial gravity, lunar dust exposure, moderate-high radiation.
 * - `MARS_BASE`: extreme comms latency (`distance`: 1.00), prolonged isolation, 3/8 g.
 */
export const ENVIRONMENT_PROFILES: Record<MissionEnvironment, Record<SpaceHazard, number>> = {
  SPACECRAFT: {
    radiation: 0.55,
    isolation: 0.65,
    distance: 0.50,
    gravity: 0.90,
    hostileEnvironment: 0.65,
  },
  STATION: {
    radiation: 0.45,
    isolation: 0.55,
    distance: 0.35,
    gravity: 0.95,
    hostileEnvironment: 0.45,
  },
  ROVER: {
    radiation: 0.80,
    isolation: 0.60,
    distance: 0.55,
    gravity: 0.55,
    hostileEnvironment: 0.90,
  },
  LUNAR_BASE: {
    radiation: 0.65,
    isolation: 0.65,
    distance: 0.50,
    gravity: 0.60,
    hostileEnvironment: 0.70,
  },
  MARS_BASE: {
    radiation: 0.75,
    isolation: 0.95,
    distance: 1.00,
    gravity: 0.50,
    hostileEnvironment: 0.75,
  },
};

/** NOAA S0–S5 solar radiation storm scale mapped to normalized severity [0..1]. */
export const STORM_SCALE_SEVERITY: Record<NOAAStormScale, number> = {
  S0_NOMINAL: 0.15,
  S1_MINOR: 0.35,
  S2_MODERATE: 0.55,
  S3_STRONG: 0.75,
  S4_SEVERE: 0.92,
  S5_EXTREME: 1.0,
};

/**
 * Effective transmission multiplier applied to the radiation hazard component.
 * Normalized from `DoseCalculator` physical attenuation (`EVA_SUIT`=0.95, `CREW_CABIN_NOMINAL`=0.25,
 * `STORM_SHELTER`=0.04) so nominal crew cabin remains the 1.0x reference baseline.
 */
export const SHIELDING_MODIFIER: Record<ShieldingType, number> = {
  EVA_SUIT: 1.35,
  CREW_CABIN_NOMINAL: 1.0,
  STORM_SHELTER: 0.25,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Resolves effective [0..1] hazard intensities for a mission environment and optional radiation context.
 */
export function resolveHazardIntensities(
  environment: MissionEnvironment,
  radiation?: RadiationContext
): Record<SpaceHazard, number> {
  const base = ENVIRONMENT_PROFILES[environment];
  const intensities: Record<SpaceHazard, number> = { ...base };

  if (radiation) {
    const stormSeverity = STORM_SCALE_SEVERITY[radiation.stormScale];
    const shieldingMod = SHIELDING_MODIFIER[radiation.shielding];
    // Combine baseline habitat radiation and solar storm severity, both modulated by shielding
    intensities.radiation = clamp01(
      Math.max(base.radiation * shieldingMod, stormSeverity * shieldingMod)
    );
  }

  return intensities;
}

/**
 * Computes the weighted environmental hazard load (`[0, 1]`), dominant hazard, and per-hazard breakdown for a body zone.
 */
export function computeZoneHazardLoad(
  zone: BodyZoneId,
  environment: MissionEnvironment,
  radiation?: RadiationContext
): ZoneHazardLoad {
  const intensities = resolveHazardIntensities(environment, radiation);
  const breakdown = {} as Record<SpaceHazard, number>;

  let weightedSum = 0;
  let weightTotal = 0;
  let topHazard: SpaceHazard = "radiation";
  let topValue = -1;

  for (const hazard of SPACE_HAZARDS) {
    const weight = HAZARD_ZONE_WEIGHTS[hazard][zone];
    const impact = Number((intensities[hazard] * weight).toFixed(3));
    breakdown[hazard] = impact;
    weightedSum += impact;
    weightTotal += weight;

    if (impact > topValue) {
      topValue = impact;
      topHazard = hazard;
    }
  }

  const total = weightTotal > 0 ? Number(clamp01(weightedSum / weightTotal).toFixed(3)) : 0;

  return {
    total,
    topHazard,
    breakdown,
  };
}

