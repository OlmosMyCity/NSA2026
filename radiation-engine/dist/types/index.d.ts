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
export interface RadiationEngineState {
    timestamp: string;
    isSimulated: boolean;
    activeScenario?: string;
    probabilities: NOAASolarProbability[];
    currentTelemetry: {
        latestXray: GOESXrayReading | null;
        latestProtons: GOESProtonReading[];
        stormScale: NOAAStormScale;
    };
    earlyWarning: EarlyWarningWindow;
    biologicalDoses: Record<ShieldingType, BiologicalDoseEstimate>;
    mitigation: RadiationMitigationProtocol;
}
