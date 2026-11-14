/**
 * Matriz de los 5 peligros del vuelo espacial (NASA Human Research Program - HRP)
 * y perfiles de entorno de misión con multiplicadores de exposición.
 *
 * Fuente conceptual: NASA HRP — The 5 Hazards of Human Spaceflight
 * (https://www.nasa.gov/hrp/hazards) y docs/NASA_SPACE_APPS_CHALLENGE.md.
 */

export type BodyZoneId = "heart" | "brain" | "blood" | "bones" | "sleep";

export type SpaceHazard =
  | "radiation"
  | "isolation"
  | "distance"
  | "gravity"
  | "hostileEnvironment";

export type MissionEnvironment =
  | "SPACECRAFT"
  | "STATION"
  | "ROVER"
  | "LUNAR_BASE"
  | "MARS_BASE";

export type ShieldingType =
  | "EVA_SUIT"
  | "CREW_CABIN_NOMINAL"
  | "STORM_SHELTER";

export type NOAAStormScale =
  | "S0_NOMINAL"
  | "S1_MINOR"
  | "S2_MODERATE"
  | "S3_STRONG"
  | "S4_SEVERE"
  | "S5_EXTREME";

export interface RadiationContext {
  stormScale: NOAAStormScale;
  shielding: ShieldingType;
  /** Flujo de protones >10 MeV en pfu (opcional, informativo). */
  fluxPfu?: number;
}

export interface ZoneHazardLoad {
  /** Carga ambiental normalizada [0, 1] sobre la zona. */
  total: number;
  /** Peligro con mayor contribución en la zona. */
  topHazard: SpaceHazard;
  /** Contribución individual [0, 1] por cada peligro HRP. */
  breakdown: Record<SpaceHazard, number>;
}

export const BODY_ZONES: readonly BodyZoneId[] = [
  "heart",
  "brain",
  "blood",
  "bones",
  "sleep",
] as const;

export const SPACE_HAZARDS: readonly SpaceHazard[] = [
  "radiation",
  "isolation",
  "distance",
  "gravity",
  "hostileEnvironment",
] as const;

/**
 * Pesos base [0..1] de cómo cada peligro espacial afecta cada zona corporal.
 * Refleja la sensibilidad fisiológica documentada por NASA HRP:
 * - radiation: sistema inmune/sangre (0.95), SNC/cerebro (0.55), cardiovascular (0.45)
 * - isolation: cerebro/ánimo (0.95), sueño (0.90), cardiovascular por estrés (0.35)
 * - distance: cerebro/estrés por autonomía y retraso (0.75), metabólico/nutrición (0.60)
 * - gravity: huesos/músculos (0.95), corazón/fluidos (0.85), sueño (0.30)
 * - hostileEnvironment: sangre/respiratorio CO2-O2 (0.90), sueño por ruido/luz (0.55)
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
 * Perfiles de entorno: intensidad base [0..1] de cada peligro según el hábitat.
 * - SPACECRAFT (Orión): tránsito cislunar, espacio confinado, microgravedad.
 * - STATION (Gateway / ISS): mejor soporte vital y rutina, microgravedad prolongada.
 * - ROVER: exposición directa en superficie, alto riesgo de ambiente hostil/radiación.
 * - LUNAR_BASE: gravedad 1/6 g, polvo lunar, radiación moderada-alta.
 * - MARS_BASE: distancia extrema (latencia de comunicaciones), aislamiento prolongado, 3/8 g.
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

/** Escala NOAA S0-S5 convertida a severidad normalizada [0..1]. */
export const STORM_SCALE_SEVERITY: Record<NOAAStormScale, number> = {
  S0_NOMINAL: 0.15,
  S1_MINOR: 0.35,
  S2_MODERATE: 0.55,
  S3_STRONG: 0.75,
  S4_SEVERE: 0.92,
  S5_EXTREME: 1.0,
};

/**
 * Factor de transmisión efectiva del blindaje sobre el componente de radiación.
 * Coherente con DoseCalculator (`EVA_SUIT`=0.95, `CREW_CABIN_NOMINAL`=0.25, `STORM_SHELTER`=0.04),
 * normalizado para modular el peligro ambiental en el gemelo.
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
 * Calcula la intensidad efectiva [0..1] de los 5 peligros para un entorno y contexto de radiación.
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
    // Combina exposición base del entorno con la tormenta solar modulada por blindaje
    intensities.radiation = clamp01(
      Math.max(base.radiation * shieldingMod, stormSeverity * shieldingMod)
    );
  }

  return intensities;
}

/**
 * Calcula el impacto ponderado de los 5 peligros sobre una zona corporal.
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

