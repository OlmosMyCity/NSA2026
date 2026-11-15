/**
 * Space weather and solar radiation incident client.
 * Fetches NOAA S-scale telemetry, SPE early-warning predictions, active mitigation
 * checklists, and incident acknowledgement mutations from the backend.
 *
 * @module features/radiation/services/radiationService
 */

import { httpClient } from '@/features/common/services/httpClient';
import { authStorage } from '@/features/common/services/storage';

/** NOAA Solar Radiation Storm scale levels (S0 nominal through S5 extreme). */
export type NOAAStormScale =
  | 'S0_NOMINAL'
  | 'S1_MINOR'
  | 'S2_MODERATE'
  | 'S3_STRONG'
  | 'S4_SEVERE'
  | 'S5_EXTREME';

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

class RadiationService {
  /** Fetches public NOAA solar radiation telemetry, proton flux (>10 MeV pfu), and mitigation protocols. */
  async getStatus(): Promise<RadiationStatusResponse> {
    return httpClient.get<RadiationStatusResponse>('/radiation/status', { skipAuth: true });
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
