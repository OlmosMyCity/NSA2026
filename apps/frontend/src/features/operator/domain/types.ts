/**
 * Contrato de la supervisión desde Tierra (`GET /api/operator/crew` y `/crew/:id`).
 * El operador ve la información completa de la tripulación de sus misiones.
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

export type OperatorReadinessReason =
  | 'ALL_NOMINAL'
  | 'RECOVERY_WATCH'
  | 'VITAL_WATCH'
  | 'CRITICAL_FINDING'
  | 'READING_EXPIRED'
  | 'NO_READINGS'
  | 'PROTECTIVE_SHELTER';

export interface OperatorDestinationReadiness {
  destination: Destination;
  verdict: ReadinessVerdict;
  reasonCode: OperatorReadinessReason;
}

export interface CrewVitals {
  heartRateBpm: number;
  systolicMmHg: number;
  diastolicMmHg: number;
  spo2Pct: number;
  temperatureC: number;
  glucoseMgDl: number;
  sleepHours: number;
  mood: number;
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
  /** Valores de la última lectura. Si `isFresh` es `false` son históricos, no el estado actual. */
  vitals: CrewVitals | null;
  readiness: OperatorDestinationReadiness[];
}

type ReadingStatus = Exclude<OperatorCrewStatus, 'NO_DATA'>;

export interface OperatorReadingEntry extends CrewVitals {
  id: string;
  takenAt: string;
  status: ReadingStatus;
}

export interface OperatorCrewDetail extends OperatorCrewMember {
  lastReadingStatus: ReadingStatus | null;
  alerts: string[];
  recommendation: string | null;
  zones: {
    zone: 'heart' | 'brain' | 'blood' | 'bones' | 'sleep';
    status: 'green' | 'amber' | 'red' | 'unknown';
    trend: 'improving' | 'stable' | 'worsening';
  }[];
  latestDirective: { content: string; createdAt: string; acknowledgedAt: string | null } | null;
  /** De la más reciente a la más antigua. */
  history: OperatorReadingEntry[];
  serverTime: string;
  freshnessWindowMin: number;
}

export interface OperatorCrewOverview {
  crew: OperatorCrewMember[];
  serverTime: string;
  freshnessWindowMin: number;
}
