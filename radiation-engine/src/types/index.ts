export type SolarFlareClass = 'A' | 'B' | 'C' | 'M' | 'X';

export type NOAAStormScale = 'S0_NOMINAL' | 'S1_MINOR' | 'S2_MODERATE' | 'S3_STRONG' | 'S4_SEVERE' | 'S5_EXTREME';

export type ShieldingType = 'EVA_SUIT' | 'CREW_CABIN_NOMINAL' | 'STORM_SHELTER';

export interface ShieldingProperty {
  type: ShieldingType;
  name: string;
  arealDensityGcm2: number; // g/cm²
  attenuationFactor: number; // Reducción del flujo de radiación (0.0 a 1.0)
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
  protonEvent1DayPct: number; // 10 MeV protons
  protonEvent2DayPct: number;
  protonEvent3DayPct: number;
  polarCapAbsorption: 'green' | 'yellow' | 'red';
}

export interface GOESXrayReading {
  timestamp: string;
  satellite: number;
  fluxShort: number; // 0.05-0.4nm (W/m²)
  fluxLong: number;  // 0.1-0.8nm (W/m²)
  currentClass: string; // e.g., 'C2.4', 'M1.8', 'X3.2'
  derivativePerMinute: number; // dF/dt
}

export interface GOESProtonReading {
  timestamp: string;
  energyChannel: string; // e.g., '>10 MeV', '>50 MeV', '>100 MeV'
  fluxPfu: number;       // Particle Flux Units (protons / cm²·s·sr)
}

export interface EarlyWarningWindow {
  isWarningActive: boolean;
  triggerEvent: string | null; // e.g., "Solar Flare X3.2 detected by GOES-18"
  flareOnsetTimestamp: string | null;
  estimatedProtonArrivalMinutes: number | null; // e.g., 42 min
  estimatedPeakFluxPfu: number | null;
  predictedStormScale: NOAAStormScale;
  confidenceScore: number; // 0.0 to 1.0
}

export interface BiologicalDoseEstimate {
  shieldingType: ShieldingType;
  doseRateMicroSvPerHour: number; // µSv/h
  projected30DayDoseMsv: number;   // mSv
  careerDosePercentage: number;   // % de límite de 500 mSv
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
