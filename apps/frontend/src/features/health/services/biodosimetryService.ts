import { ENV, isReachableServiceUrl } from '@/features/common/config/env';
import { httpClient } from '@/features/common/services/httpClient';
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

export const SIMULATION_PRESETS: Record<
  Exclude<SimulationScenarioKey, 'LIVE_READING'>,
  { label: string; description: string; payload: BiodosimetryPayload }
> = {
  SLEEP_DEPRIVATION_FALSE_POSITIVE: {
    label: 'Privación de Sueño (S0 Nominal)',
    description: '8-OHdG elevado por falta de sueño y estrés en día S0 sin radiación.',
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
    label: 'Microgravedad / Fluido (S0)',
    description: 'Estrés cardiovascular y oxidativo por adaptación a microgravedad.',
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
    label: 'Tormenta Solar S4 en EVA',
    description: 'Exposición aguda en traje EVA con DSB (γ-H2AX) y respuesta FDXR.',
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

export function buildPayloadFromReading(
  reading: Partial<ApiHealthReading> | null | undefined,
  shieldingType: ShieldingType
): BiodosimetryPayload {
  const sleepHours = reading?.sleepHours ?? 7.5;
  const mood = reading?.mood ?? 4;
  const hr = reading?.heartRateBpm ?? 72;
  const sys = reading?.systolicMmHg ?? 118;

  // Estimar biomarcadores in-situ coherentes si la lectura no los trae explícitos
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
        'Evacuar inmediatamente a STORM_SHELTER si está en EVA_SUIT o módulo sin blindaje.',
        'Iniciar protocolo radioprotector oral (N-acetilcisteína, Vitaminas C y E).',
        'Programar ensayo de γ-H2AX en linfocitos y 8-OHdG urinario en 2–4 horas.',
      ],
      explanation: `Firma genotóxica de radiación confirmada (γ-H2AX=${payload.gammaH2axFociPerCell.toFixed(
        1
      )} foci/célula, FDXR=${payload.fdxrFoldChange.toFixed(1)}x, dosis=${payload.doseRateMicroSvPerHour.toFixed(
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
        'No se requiere evacuación a refugio de radiación según dosimetría física actual.',
        'Priorizar recuperación circadiana de 7–8h de sueño y fototerapia.',
        'Reevaluar estado de ánimo y repetir 8-OHdG urinario en 12 horas.',
      ],
      explanation: oxidative
        ? `Falsa alarma filtrada: estrés oxidativo elevado (8-OHdG=${payload.urine8OhdgNgMg.toFixed(
            1
          )} ng/mg) coincide con privación de sueño (${payload.sleepHours.toFixed(
            1
          )}h) y ánimo bajo (${payload.mood}/5), sin marcadores de DSB/FDXR.`
        : `Patrón de estrés fisiológico por sueño/ánimo (${payload.sleepHours.toFixed(1)}h) con radiación basal.`,
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
        'No se requiere protocolo agudo de radiación; el estrés oxidativo corresponde a adaptación a microgravedad.',
        'Ejecutar sesión de contramedidas cardiovasculares/ARED y mantener hidratación.',
        'Monitorear presión arterial en reposo y tolerancia ortostática en el próximo control.',
      ],
      explanation: oxidative
        ? `Falsa alarma filtrada: 8-OHdG elevado (${payload.urine8OhdgNgMg.toFixed(
            1
          )} ng/mg) y carga cardiovascular (${payload.systolicMmHg}/${payload.diastolicMmHg} mmHg) reflejan adaptación a microgravedad.`
        : 'Marcadores cardiovasculares reflejan adaptación de fluidos en microgravedad.',
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
      'Todos los signos vitales, dosimetría física y biomarcadores están dentro de límites nominales.',
      'Continuar con la rutina estándar de salud de la misión.',
    ],
    explanation: 'Estado fisiológico y radiobiológico nominal.',
  };
}

class BiodosimetryService {
  async runTriage(params: {
    astronautId?: string;
    shieldingType: ShieldingType;
    payload: BiodosimetryPayload;
    useLiveBridge?: boolean;
  }): Promise<BiodosimetryTriageResult> {
    if (!ENV.USE_MOCKS && params.useLiveBridge) {
      try {
        const res = await httpClient.post<{ triage: BiodosimetryResponse }>(
          '/health-readings/biodosimetry-triage',
          {
            astronautId: params.astronautId,
            shieldingType: params.shieldingType,
            biomarkers: {
              gammaH2axFociPerCell: params.payload.gammaH2axFociPerCell,
              urine8OhdgNgMg: params.payload.urine8OhdgNgMg,
              fdxrFoldChange: params.payload.fdxrFoldChange,
            },
          }
        );
        return { source: 'backend-bridge', triage: res.triage };
      } catch {
        // Fallback a microservicio directo o simulación local
      }
    }

    if (isReachableServiceUrl(ENV.SIGNAL_NOISE_URL)) {
      try {
        const res = await fetch(`${ENV.SIGNAL_NOISE_URL}/api/biodosimetry/attribution`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params.payload),
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          const triage = (await res.json()) as BiodosimetryResponse;
          return { source: 'signal-noise-fastapi', triage };
        }
      } catch {
        // Microservicio FastAPI no disponible en este entorno: usar simulación determinística local
      }
    }

    return {
      source: 'local-simulation',
      triage: computeLocalFallback(params.payload),
    };
  }
}

export const biodosimetryService = new BiodosimetryService();
