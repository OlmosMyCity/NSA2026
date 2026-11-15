import { httpClient } from '@/services/httpClient';
import type { ActiveRadiationIncidentSummary, CrewMemberTriage, FlightSurgeonMetrics } from '../domain/admin/types';

export interface TriageOverview {
  crew: CrewMemberTriage[];
  metrics: FlightSurgeonMetrics;
  stormScale?: string;
  activeRadiationIncident?: ActiveRadiationIncidentSummary | null;
}

/** En modo mock, httpClient responde con el backend simulado (src/mocks). */
export const adminTriageService = {
  getTriageOverview: () => httpClient.get<TriageOverview>('/admin/triage'),

  sendClinicalDirectives: (astronautId: string, directives: string) =>
    httpClient.post<{ success: boolean; message: string }>(`/admin/astronauts/${astronautId}/directives`, { directives }),
};
