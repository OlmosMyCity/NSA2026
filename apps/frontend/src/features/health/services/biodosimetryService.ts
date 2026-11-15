/**
 * @module health/services/biodosimetryService
 * Radiobiological Signal-vs.-Noise attribution service.
 * Separates genuine ionizing radiation genotoxicity (`γ-H2AX` double-strand break
 * foci, `FDXR` transcriptional fold-change, physical dose rate) from non-radiation
 * oxidative stress (`8-OHdG`) induced by sleep deprivation or microgravity fluid shifts.
 */

import type { ApiHealthReading } from '../domain/api-adapter';

export type ShieldingType = 'EVA_SUIT' | 'CREW_CABIN_NOMINAL' | 'STORM_SHELTER';
export type PrimaryCause =
  | 'NOMINAL'
  | 'IONIZING_RADIATION'
  | 'MICROGRAVITY_STRESS'
  | 'SLEEP_PSYCH_STRESS';

export type SimulationScenarioKey =
  | 'LIVE_READING'
  | 'SLEEP_DEPRIVATION_FALSE_POSITIVE'
  | 'MICROGRAVITY_FLUID_SHIFT'
  | 'EVA_PEAK_STORM_S4';

export interface AttributionBreakdown {
  nominalPct: number;
  ionizingRadiationPct: number;
  microgravityStressPct: number;
  sleepPsychStressPct: number;
}

export interface BiodosimetryResponse {
  primaryCause: PrimaryCause;
  confidence: number;
  falsePositiveFiltered: boolean;
  oxidativeStressDetected: boolean;
  attribution: AttributionBreakdown;
  clinicalGuidance: string[];
  explanation: string;
}

export interface BiodosimetryPayload {
  doseRateMicroSvPerHour: number;
  stormScaleLevel: number;
  shieldingType: ShieldingType;
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  glucoseMgDl: number;
  temperatureC: number;
  spo2Pct: number;
  sleepHours: number;
  mood: number;
  gammaH2axFociPerCell: number;
  urine8OhdgNgMg: number;
  fdxrFoldChange: number;
}

export interface BiodosimetryTriageResult {
  source: 'backend-bridge' | 'signal-noise-fastapi' | 'local-simulation';
  triage: BiodosimetryResponse;
}

/** Curated benchmark scenarios illustrating false-positive filtering vs. true S4 SPE exposure. */
export const SIMULATION_PRESETS: Record<
  Exclude<SimulationScenarioKey, 'LIVE_READING'>,
  { label: string; description: string; payload: BiodosimetryPayload }
> = {
  SLEEP_DEPRIVATION_FALSE_POSITIVE: {
    label: 'Sleep Deprivation (S0 Nominal)',
    description: 'Elevated 8-OHdG driven by sleep loss and stress on a nominal S0 day.',
    payload: {
      doseRateMicroSvPerHour: 18.0,
      stormScaleLevel: 0,
      shieldingType: 'CREW_CABIN_NOMINAL',
      heartRateBpm: 88,
      systolicMmHg: 126,
      diastolicMmHg: 82,
      glucoseMgDl: 106,
      temperatureC: 36.8,
      spo2Pct: 98,
      sleepHours: 4.0,
      mood: 2,
      gammaH2axFociPerCell: 0.9,
      urine8OhdgNgMg: 26.5,
      fdxrFoldChange: 1.1,
    },
  },
  MICROGRAVITY_FLUID_SHIFT: {
    label: 'Microgravity / Fluid Shift (S0)',
    description: 'Cardiovascular and oxidative stress from microgravity fluid-shift adaptation.',
    payload: {
      doseRateMicroSvPerHour: 20.0,
      stormScaleLevel: 0,
      shieldingType: 'CREW_CABIN_NOMINAL',
      heartRateBpm: 94,
      systolicMmHg: 138,
      diastolicMmHg: 88,
      glucoseMgDl: 102,
      temperatureC: 36.9,
      spo2Pct: 97,
      sleepHours: 7.0,
      mood: 3,
      gammaH2axFociPerCell: 0.8,
      urine8OhdgNgMg: 24.0,
      fdxrFoldChange: 1.0,
    },
  },
  EVA_PEAK_STORM_S4: {
    label: 'S4 Solar Storm in EVA',
    description: 'Acute EVA exposure with DSBs (γ-H2AX) and p53/FDXR transcriptional response.',
    payload: {
      doseRateMicroSvPerHour: 14500.0,
      stormScaleLevel: 4,
      shieldingType: 'EVA_SUIT',
      heartRateBpm: 112,
      systolicMmHg: 134,
      diastolicMmHg: 86,
      glucoseMgDl: 115,
      temperatureC: 37.2,
      spo2Pct: 96,
      sleepHours: 6.5,
      mood: 2,
      gammaH2axFociPerCell: 9.8,
      urine8OhdgNgMg: 48.0,
      fdxrFoldChange: 6.4,
    },
  },
};

/**
 * Builds a complete biodosimetry triage payload from a standard vital-signs reading
 * and active shielding tier, synthesizing coherent baseline molecular markers when absent.
 */
export function buildPayloadFromReading(
  reading: Partial<ApiHealthReading> | null | undefined,
  shieldingType: ShieldingType
): BiodosimetryPayload {
  const sleepHours = reading?.sleepHours ?? 7.5;
  const mood = reading?.mood ?? 4;
  const hr = reading?.heartRateBpm ?? 72;
  const sys = reading?.systolicMmHg ?? 118;

  // Synthesize coherent in-situ molecular biomarkers when the live reading omits them
  const sleepStress = sleepHours < 5.5 || mood <= 2;
  const microgravityLoad = sys >= 135 || hr >= 92;
  const urine8Ohdg = sleepStress || microgravityLoad ? 24.5 : 12.0;

  return {
    doseRateMicroSvPerHour: shieldingType === 'EVA_SUIT' ? 28.0 : shieldingType === 'STORM_SHELTER' ? 4.0 : 18.0,
    stormScaleLevel: 0,
    shieldingType,
    heartRateBpm: hr,
    systolicMmHg: sys,
    diastolicMmHg: reading?.diastolicMmHg ?? 76,
    glucoseMgDl: reading?.glucoseMgDl ?? 95,
    temperatureC: reading?.temperatureC ?? 36.8,
    spo2Pct: reading?.spo2Pct ?? 98,
    sleepHours,
    mood,
    gammaH2axFociPerCell: 0.85,
    urine8OhdgNgMg: urine8Ohdg,
    fdxrFoldChange: 1.05,
  };
}

function computeLocalFallback(payload: BiodosimetryPayload): BiodosimetryResponse {
  const isRadiation =
    payload.gammaH2axFociPerCell >= 3.0 ||
    payload.fdxrFoldChange >= 2.5 ||
    payload.doseRateMicroSvPerHour >= 500;

  const oxidative = payload.urine8OhdgNgMg >= 20.0;

  if (isRadiation) {
    return {
      primaryCause: 'IONIZING_RADIATION',
      confidence: 0.96,
      falsePositiveFiltered: false,
      oxidativeStressDetected: oxidative,
      attribution: {
        nominalPct: 1.5,
        ionizingRadiationPct: 92.0,
        microgravityStressPct: 3.5,
        sleepPsychStressPct: 3.0,
      },
      clinicalGuidance: [
        'Evacuate immediately to STORM_SHELTER if currently in EVA_SUIT or an unshielded module.',
        'Initiate oral radioprotector protocol (N-acetylcysteine, Vitamins C & E).',
        'Schedule follow-up lymphocyte γ-H2AX and urinary 8-OHdG assay in 2–4 hours.',
      ],
      explanation: `Genotoxic radiation signature confirmed (γ-H2AX=${payload.gammaH2axFociPerCell.toFixed(
        1
      )} foci/cell, FDXR=${payload.fdxrFoldChange.toFixed(1)}x, dose=${payload.doseRateMicroSvPerHour.toFixed(
        1
      )} µSv/h).`,
    };
  }

  if (payload.sleepHours < 6.0 || payload.mood <= 2) {
    return {
      primaryCause: 'SLEEP_PSYCH_STRESS',
      confidence: 0.89,
      falsePositiveFiltered: oxidative,
      oxidativeStressDetected: oxidative,
      attribution: {
        nominalPct: 4.0,
        ionizingRadiationPct: 4.5,
        microgravityStressPct: 8.5,
        sleepPsychStressPct: 83.0,
      },
      clinicalGuidance: [
        'No acute radiation shelter evacuation required based on current physical dosimetry.',
        'Prioritize 7–8h circadian sleep recovery and light-therapy schedule.',
        'Re-evaluate mood and repeat urinary 8-OHdG assay in 12 hours.',
      ],
      explanation: oxidative
        ? `False positive filtered: elevated oxidative stress (8-OHdG=${payload.urine8OhdgNgMg.toFixed(
            1
          )} ng/mg) aligns with sleep deprivation (${payload.sleepHours.toFixed(
            1
          )}h) and low mood (${payload.mood}/5), without DSB/FDXR radiation markers.`
        : `Physiological stress pattern detected (sleep=${payload.sleepHours.toFixed(1)}h) with baseline radiation.`,
    };
  }

  if (payload.systolicMmHg >= 132 || payload.heartRateBpm >= 90 || oxidative) {
    return {
      primaryCause: 'MICROGRAVITY_STRESS',
      confidence: 0.86,
      falsePositiveFiltered: oxidative,
      oxidativeStressDetected: oxidative,
      attribution: {
        nominalPct: 6.0,
        ionizingRadiationPct: 5.0,
        microgravityStressPct: 81.0,
        sleepPsychStressPct: 8.0,
      },
      clinicalGuidance: [
        'No acute radiation protocol needed; oxidative stress is consistent with microgravity fluid shift.',
        'Execute ARED / cardiovascular countermeasure session and maintain hydration.',
        'Monitor resting blood pressure and orthostatic tolerance on next routine check.',
      ],
      explanation: oxidative
        ? `False positive filtered: elevated 8-OHdG (${payload.urine8OhdgNgMg.toFixed(
            1
          )} ng/mg) and cardiovascular load (${payload.systolicMmHg}/${payload.diastolicMmHg} mmHg) reflect microgravity adaptation.`
        : 'Cardiovascular markers reflect microgravity fluid-shift adaptation.',
    };
  }

  return {
    primaryCause: 'NOMINAL',
    confidence: 0.94,
    falsePositiveFiltered: false,
    oxidativeStressDetected: false,
    attribution: {
      nominalPct: 91.0,
      ionizingRadiationPct: 2.0,
      microgravityStressPct: 4.0,
      sleepPsychStressPct: 3.0,
    },
    clinicalGuidance: [
      'All vitals, physical dosimetry, and molecular biomarkers remain within nominal limits.',
      'Continue standard mission health routine.',
    ],
    explanation: 'Nominal physiological and radiobiological status.',
  };
}

class BiodosimetryService {
  async runTriage(params: {
    astronautId?: string;
    shieldingType: ShieldingType;
    payload: BiodosimetryPayload;
    useLiveBridge?: boolean;
  }): Promise<BiodosimetryTriageResult> {
    return {
      source: 'local-simulation',
      triage: computeLocalFallback(params.payload),
    };
  }
}

export const biodosimetryService = new BiodosimetryService();
