/**
 * Contrato de la vista de supervisión desde Tierra (`GET /api/operator/crew`).
 * No hay campos clínicos: el operador ve estado, ubicación, aptitud y fecha.
 */

export type OperatorCrewStatus = 'CRITICAL' | 'WARNING' | 'OK' | 'NO_DATA';

export const CREW_LOCATIONS = ['CREW_CABIN', 'HABITAT', 'ROVER', 'EVA', 'STORM_SHELTER', 'MEDICAL_BAY'] as const;
export type CrewLocation = (typeof CREW_LOCATIONS)[number];

export const CREW_LOCATION_LABEL: Record<CrewLocation, string> = {
  CREW_CABIN: 'Crew cabin',
  HABITAT: 'Habitat',
  ROVER: 'Rover',
  EVA: 'EVA · outside',
  STORM_SHELTER: 'Storm shelter',
  MEDICAL_BAY: 'Medical bay',
};

export const DESTINATIONS = ['EVA', 'ROVER', 'HABITAT', 'MODULE_TRANSFER', 'STORM_SHELTER'] as const;
export type Destination = (typeof DESTINATIONS)[number];

export const DESTINATION_LABEL: Record<Destination, string> = {
  EVA: 'EVA',
  ROVER: 'Rover',
  HABITAT: 'Habitat',
  MODULE_TRANSFER: 'Module transfer',
  STORM_SHELTER: 'Storm shelter',
};

export type ReadinessVerdict = 'FIT' | 'FIT_WITH_CAUTION' | 'NOT_FIT' | 'NO_DATA';

export type OperatorReadinessNote =
  | 'CLEARED'
  | 'MEDICAL_CAUTION'
  | 'MEDICAL_HOLD'
  | 'READING_EXPIRED'
  | 'NO_READINGS'
  | 'PROTECTIVE_SHELTER';

export interface OperatorDestinationReadiness {
  destination: Destination;
  verdict: ReadinessVerdict;
  note: OperatorReadinessNote;
}

export interface OperatorCrewMember {
  astronautId: string;
  name: string;
  crewRole: string;
  photoUrl: string | null;
  missionId: string;
  missionName: string;
  status: OperatorCrewStatus;
  location: CrewLocation | null;
  locationUpdatedAt: string | null;
  lastReadingAt: string | null;
  expiresAt: string | null;
  isFresh: boolean;
  readiness: OperatorDestinationReadiness[];
}

export interface OperatorCrewOverview {
  crew: OperatorCrewMember[];
  serverTime: string;
  freshnessWindowMin: number;
}
