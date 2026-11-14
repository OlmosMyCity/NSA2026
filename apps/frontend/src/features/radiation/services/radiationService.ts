import { httpClient } from '@/features/common/services/httpClient';
import { authStorage } from '@/features/common/services/storage';

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
  async getStatus(): Promise<RadiationStatusResponse> {
    return httpClient.get<RadiationStatusResponse>('/radiation/status', { skipAuth: true });
  }

  async getActiveRadiationIncident(): Promise<RadiationIncident | null> {
    if (!authStorage.getToken()) return null;
    const res = await httpClient.get<{ data: RadiationIncident[] }>('/incidents', {
      params: { category: 'RADIATION', type: 'SOLAR_RADIATION_STORM', limit: 5 },
    });
    return (
      res.data.find((item) => item.status === 'OPEN' || item.status === 'ACKNOWLEDGED') ?? null
    );
  }

  async acknowledgeIncident(incidentId: string): Promise<RadiationIncident> {
    return httpClient.patch<RadiationIncident>(`/incidents/${incidentId}/acknowledge`);
  }
}

export const radiationService = new RadiationService();
