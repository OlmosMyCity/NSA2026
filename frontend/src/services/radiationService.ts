/**
 * Space weather and solar radiation incident client.
 * Fetches NOAA S-scale telemetry, SPE early-warning predictions, active mitigation
 * checklists, and incident acknowledgement mutations from the backend.
 *
 * @module services/radiationService
 */

import { httpClient } from '@/services/httpClient';
import { authStorage } from '@/services/storage';

/** NOAA Solar Radiation Storm scale levels (S0 nominal through S5 extreme). */
export type NOAAStormScale =
  | 'S0_NOMINAL'
  | 'S1_MINOR'
  | 'S2_MODERATE'
  | 'S3_STRONG'
  | 'S4_SEVERE'
  | 'S5_EXTREME';

/** Spacecraft shielding zone keys modeled by the radiation dose engine. */
export type RadiationShieldingKey = 'EVA_SUIT' | 'CREW_CABIN_NOMINAL' | 'STORM_SHELTER';

export interface BiologicalDoseEstimate {
  shieldingType: RadiationShieldingKey;
  doseRateMicroSvPerHour: number;
  projected30DayDoseMsv: number;
  careerDosePercentage: number;
  clinicalRiskLevel: 'NOMINAL' | 'ELEVATED' | 'WARNING' | 'CRITICAL';
}

export interface RadiationStatusResponse {
  timestamp: string;
  isSimulated: boolean;
  telemetryDegraded?: boolean;
  degradationReason?: string;
  currentTelemetry: {
    stormScale: NOAAStormScale;
    latestXray?: {
      currentClass?: string;
    };
    latestProtons?: Array<{
      energyChannel: string;
      fluxPfu: number;
    }>;
  };
  earlyWarning?: {
    isWarningActive: boolean;
    triggerEvent: string | null;
    estimatedProtonArrivalMinutes: number | null;
    predictedStormScale: NOAAStormScale;
  };
  biologicalDoses?: Partial<Record<RadiationShieldingKey, BiologicalDoseEstimate>>;
  mitigation: {
    stormScale: NOAAStormScale;
    abortEvaImmediately: boolean;
    evacuateToStormShelter: boolean;
    powerDownExternalSensors: boolean;
    medicalCountermeasures: string[];
    actionChecklist: string[];
  };
}

export interface RadiationIncident {
  id: string;
  category: 'MEDICAL' | 'RADIATION' | 'MISSION';
  type: string;
  severity: 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED';
  title: string;
  description: string;
  openedAt: string;
  acknowledgedAt: string | null;
}

export function buildFallbackRadiationStatus(): RadiationStatusResponse {
  return {
    timestamp: new Date().toISOString(),
    isSimulated: true,
    telemetryDegraded: true,
    degradationReason: 'Backend offline — using local NOAA SWPC solar wind baseline',
    currentTelemetry: {
      stormScale: 'S1_MINOR',
      latestXray: { currentClass: 'M1.4' },
      latestProtons: [{ energyChannel: '>=10 MeV', fluxPfu: 14.2 }],
    },
    earlyWarning: {
      isWarningActive: true,
      triggerEvent: 'Solar wind stream ~585 km/s · Bz -6.2 nT (forecast window)',
      estimatedProtonArrivalMinutes: 110,
      predictedStormScale: 'S2_MODERATE',
    },
    mitigation: {
      stormScale: 'S1_MINOR',
      abortEvaImmediately: false,
      evacuateToStormShelter: false,
      powerDownExternalSensors: false,
      medicalCountermeasures: [
        'Increase hydration and prepare radioprotective protocol before arrival window.',
        'Schedule follow-up vitals and mood check-in every 4–6 h during elevated flux.',
      ],
      actionChecklist: [
        'Pause non-essential EVA scheduling during predicted solar wind peak.',
        'Verify STORM_SHELTER readiness and passive spacecraft orientation.',
      ],
    },
  };
}

class RadiationService {
  /** Fetches public NOAA solar radiation telemetry, proton flux (>10 MeV pfu), and mitigation protocols. */
  async getStatus(): Promise<RadiationStatusResponse> {
    try {
      return await httpClient.get<RadiationStatusResponse>('/radiation/status', { skipAuth: true });
    } catch {
      return buildFallbackRadiationStatus();
    }
  }

  /** Returns the currently OPEN or ACKNOWLEDGED solar radiation storm incident, if authenticated. */
  async getActiveRadiationIncident(): Promise<RadiationIncident | null> {
    if (!authStorage.getToken()) return null;
    const res = await httpClient.get<{ data: RadiationIncident[] }>('/incidents', {
      params: { category: 'RADIATION', type: 'SOLAR_RADIATION_STORM', limit: 5 },
    });
    return (
      res.data.find((item) => item.status === 'OPEN' || item.status === 'ACKNOWLEDGED') ?? null
    );
  }

  /** Transitions an active radiation incident from OPEN to ACKNOWLEDGED for the current operator. */
  async acknowledgeIncident(incidentId: string): Promise<RadiationIncident> {
    return httpClient.patch<RadiationIncident>(`/incidents/${incidentId}/acknowledge`);
  }
}

export const radiationService = new RadiationService();
