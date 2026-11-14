export type SolarFlareClass = 'A' | 'B' | 'C' | 'M' | 'X';
export type NOAAStormScale = 'S0_NOMINAL' | 'S1_MINOR' | 'S2_MODERATE' | 'S3_STRONG' | 'S4_SEVERE' | 'S5_EXTREME';
export type ShieldingType = 'EVA_SUIT' | 'CREW_CABIN_NOMINAL' | 'STORM_SHELTER';
export interface ShieldingProperty {
    type: ShieldingType;
    name: string;
    arealDensityGcm2: number;
    attenuationFactor: number;
    description: string;
}
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
    protonEvent1DayPct: number;
    protonEvent2DayPct: number;
    protonEvent3DayPct: number;
    polarCapAbsorption: 'green' | 'yellow' | 'red';
}
export interface GOESXrayReading {
    timestamp: string;
    satellite: number;
    fluxShort: number;
    fluxLong: number;
    currentClass: string;
    derivativePerMinute: number;
}
export interface GOESProtonReading {
    timestamp: string;
    energyChannel: string;
    fluxPfu: number;
}
export interface EarlyWarningWindow {
    isWarningActive: boolean;
    triggerEvent: string | null;
    flareOnsetTimestamp: string | null;
    estimatedProtonArrivalMinutes: number | null;
    estimatedPeakFluxPfu: number | null;
    predictedStormScale: NOAAStormScale;
    confidenceScore: number;
}
export interface BiologicalDoseEstimate {
    shieldingType: ShieldingType;
    doseRateMicroSvPerHour: number;
    projected30DayDoseMsv: number;
    careerDosePercentage: number;
    clinicalRiskLevel: 'NOMINAL' | 'ELEVATED' | 'HAZARDOUS' | 'LETHAL_WITHOUT_SHELTER';
}
export interface RadiationMitigationProtocol {
    stormScale: NOAAStormScale;
    abortEvaImmediately: boolean;
    evacuateToStormShelter: boolean;
    powerDownExternalSensors: boolean;
    medicalCountermeasures: string[];
    actionChecklist: string[];
}
export interface SolarWindReading {
    timestamp: string;
    speedKmS: number;
    densityPcm3: number;
    temperatureK: number;
    btNt: number;
    bzNt: number;
    dynamicPressureNpa: number;
    parkerSpiralAngleDeg: number;
    parkerFootpointLonDeg: number;
}
export type ImpactTargetId = 'EARTH_MAGNETOSPHERE' | 'CISLUNAR_TRANSIT' | 'GATEWAY_NRHO' | 'LUNAR_SURFACE';
export type TargetExposureStatus = 'DIRECT_HIT' | 'GLANCING_BLOW' | 'MAGNETOSPHERE_SHIELDED' | 'MISS';
export type PrimaryImpactZone = 'CISLUNAR_AND_EARTH_DIRECT' | 'FLANK_GLANCING_BLOW' | 'DEEP_SPACE_MISS';
export type GeomagneticGScale = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5';
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
export interface SolarWindImpactPrediction {
    sourceLocation: string;
    sourceLatDeg: number;
    sourceLonDeg: number;
    coneHalfAngleDeg: number;
    cmeSpeedKmS: number;
    angularOffsetFromEarthDeg: number;
    parkerFootpointLonDeg: number;
    magneticConnectionScore: number;
    magnetopauseStandoffRe: number;
    primaryImpactZone: PrimaryImpactZone;
    predictedStormScale: NOAAStormScale;
    geomagneticGScale: GeomagneticGScale;
    targets: ImpactTargetPrediction[];
    summary: string;
}
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
