/**
 * @module types
 * Domain contracts, telemetry schemas, and physical unit definitions for the
 * Deep Space Radiation Prediction Engine.
 *
 * Units used throughout these interfaces:
 * - Energy: MeV (megaelectronvolts)
 * - Distance: AU (astronomical units) and Re (Earth radii, ~6,371 km)
 * - X-ray flux: W/m^2 (watts per square meter in GOES 0.05-0.4 nm and 0.1-0.8 nm bands)
 * - Proton flux: pfu (particle flux units = protons / cm^2 / s / sr)
 * - Biological dose rate / cumulative dose: uSv/h and mSv (sieverts)
 * - Shielding areal density: g/cm^2
 * - Solar wind & IMF: km/s, p/cm^3, K, nT, nPa
 */

/** NOAA/GOES soft X-ray (0.1-0.8 nm) solar flare magnitude class. */
export type SolarFlareClass = 'A' | 'B' | 'C' | 'M' | 'X';

/** Official NOAA Space Weather Scale for Solar Radiation Storms (S1-S5) plus nominal baseline (S0). */
export type NOAAStormScale = 'S0_NOMINAL' | 'S1_MINOR' | 'S2_MODERATE' | 'S3_STRONG' | 'S4_SEVERE' | 'S5_EXTREME';

/** Reference spacecraft/habitat radiation shielding configuration tiers. */
export type ShieldingType = 'EVA_SUIT' | 'CREW_CABIN_NOMINAL' | 'STORM_SHELTER';

/** Physical shielding properties and ionizing flux transmission multiplier for a habitat tier. */
export interface ShieldingProperty {
  type: ShieldingType;
  name: string;
  arealDensityGcm2: number; // g/cm²
  attenuationFactor: number; // Fractional ionizing flux transmission factor (0.0 to 1.0; lower = stronger shielding)
  description: string;
}

/** NOAA SWPC 1-, 2-, and 3-day operational flare and >=10 MeV proton event forecast probabilities. */
export interface NOAASolarProbability {
  date: string;
  cClass1DayPct: number;
  cClass2DayPct: number;
  cClass3DayPct: number;
  mClass1DayPct: number;
  mClass2DayPct: number;
  mClass3DayPct: number;
  xClass1DayPct: number;
  xClass2DayPct: number;
  xClass3DayPct: number;
  protonEvent1DayPct: number; // 10 MeV protons
  protonEvent2DayPct: number;
  protonEvent3DayPct: number;
  polarCapAbsorption: 'green' | 'yellow' | 'red';
}

/** GOES primary satellite X-ray flux measurement and 5-minute rate of rise. */
export interface GOESXrayReading {
  timestamp: string;
  satellite: number;
  fluxShort: number; // 0.05-0.4nm (W/m²)
  fluxLong: number;  // 0.1-0.8nm (W/m²)
  currentClass: string; // e.g., 'C2.4', 'M1.8', 'X3.2'
  derivativePerMinute: number; // dF/dt
}

/** GOES primary satellite integral solar proton flux reading for an energy channel. */
export interface GOESProtonReading {
  timestamp: string;
  energyChannel: string; // e.g., '>10 MeV', '>50 MeV', '>100 MeV'
  fluxPfu: number;       // Particle Flux Units (protons / cm²·s·sr)
}

/** Electromagnetic flare precursor window estimating SEP proton arrival lead time. */
export interface EarlyWarningWindow {
  isWarningActive: boolean;
  triggerEvent: string | null; // e.g., "Solar Flare X3.2 detected by GOES-18"
  flareOnsetTimestamp: string | null;
  estimatedProtonArrivalMinutes: number | null; // e.g., 42 min
  estimatedPeakFluxPfu: number | null;
  predictedStormScale: NOAAStormScale;
  confidenceScore: number; // 0.0 to 1.0
}

/** Shielded biological dose rate, 30-day projection, and NASA-STD-3001 risk classification. */
export interface BiologicalDoseEstimate {
  shieldingType: ShieldingType;
  doseRateMicroSvPerHour: number; // µSv/h
  projected30DayDoseMsv: number;   // mSv
  careerDosePercentage: number;   // Percentage of 500 mSv NASA-STD-3001 reference limit
  clinicalRiskLevel: 'NOMINAL' | 'ELEVATED' | 'HAZARDOUS' | 'LETHAL_WITHOUT_SHELTER';
}

/** Crew flight-rule actions and clinical countermeasures mapped to a storm scale. */
export interface RadiationMitigationProtocol {
  stormScale: NOAAStormScale;
  abortEvaImmediately: boolean;
  evacuateToStormShelter: boolean;
  powerDownExternalSensors: boolean;
  medicalCountermeasures: string[];
  actionChecklist: string[];
}

/** L1 solar wind plasma, interplanetary magnetic field (GSM), and Parker spiral geometry. */
export interface SolarWindReading {
  timestamp: string;
  speedKmS: number; // Bulk solar wind speed (km/s)
  densityPcm3: number; // Proton number density (p/cm³)
  temperatureK: number; // Proton temperature (K)
  btNt: number; // Total Interplanetary Magnetic Field (nT)
  bzNt: number; // IMF Bz GSM component (nT); negative = southward
  dynamicPressureNpa: number; // Ram pressure P_dyn (nPa)
  parkerSpiralAngleDeg: number; // Parker spiral angle at 1 AU (deg)
  parkerFootpointLonDeg: number; // Magnetic footpoint longitude on Sun (deg West)
}

/** Protected orbital or lunar mission regimes evaluated for solar wind / CME impact. */
export type ImpactTargetId =
  | 'EARTH_MAGNETOSPHERE'
  | 'CISLUNAR_TRANSIT'
  | 'GATEWAY_NRHO'
  | 'LUNAR_SURFACE';

/** Exposure classification for an individual Earth-Moon target corridor. */
export type TargetExposureStatus =
  | 'DIRECT_HIT'
  | 'GLANCING_BLOW'
  | 'MAGNETOSPHERE_SHIELDED'
  | 'MISS';

/** Broad spatial trajectory classification of a solar eruption relative to Earth-Moon. */
export type PrimaryImpactZone =
  | 'CISLUNAR_AND_EARTH_DIRECT'
  | 'FLANK_GLANCING_BLOW'
  | 'DEEP_SPACE_MISS';

/** NOAA Geomagnetic Storm Scale (G0 nominal through G5 extreme). */
export type GeomagneticGScale = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5';

/** Target-specific exposure probability, arrival timing, and shielding dose multiplier. */
export interface ImpactTargetPrediction {
  target: ImpactTargetId;
  label: string;
  status: TargetExposureStatus;
  impactProbabilityPct: number;
  estimatedArrivalMinutes: number | null;
  cmeArrivalHours: number | null;
  expectedDoseMultiplier: number;
  notes: string;
}

/** Full Earth-Moon solar wind / CME corridor impact assessment. */
export interface SolarWindImpactPrediction {
  sourceLocation: string;
  sourceLatDeg: number;
  sourceLonDeg: number; // Positive = West, Negative = East (Stonyhurst)
  coneHalfAngleDeg: number;
  cmeSpeedKmS: number;
  angularOffsetFromEarthDeg: number;
  parkerFootpointLonDeg: number;
  magneticConnectionScore: number; // 0.0 to 1.0
  magnetopauseStandoffRe: number; // Earth radii (Re)
  primaryImpactZone: PrimaryImpactZone;
  predictedStormScale: NOAAStormScale;
  geomagneticGScale: GeomagneticGScale;
  targets: ImpactTargetPrediction[];
  summary: string;
}

/** Consolidated radiation engine state returned by live telemetry and simulation scenarios. */
export interface RadiationEngineState {
  timestamp: string;
  isSimulated: boolean;
  telemetryDegraded?: boolean;
  degradationReason?: string;
  activeScenario?: string;
  probabilities: NOAASolarProbability[];
  currentTelemetry: {
    latestXray: GOESXrayReading | null;
    latestProtons: GOESProtonReading[];
    stormScale: NOAAStormScale;
  };
  solarWind: SolarWindReading;
  earlyWarning: EarlyWarningWindow;
  impactPrediction: SolarWindImpactPrediction;
  biologicalDoses: Record<ShieldingType, BiologicalDoseEstimate>;
  mitigation: RadiationMitigationProtocol;
}
