/**
 * Domain contracts for the Flight Surgeon triage console, active solar radiation
 * incident summaries, and crew-wide clinical metrics.
 *
 * @module features/admin/domain/types
 */

/** Aggregated clinical triage snapshot for a single crew member's latest health reading. */
export interface CrewMemberTriage {
  astronautId: string;
  astronautName: string;
  missionId: string;
  missionName: string;
  role: string;
  environment: string;
  status: 'CRITICAL' | 'WARNING' | 'OK';
  heartRate: number;
  bloodPressure: string;
  spo2: number;
  glucose: number;
  temperature: number;
  sleepHours: number;
  mood: number;
  alerts: string[];
  recommendation?: string | null;
  priorityBoosted?: boolean;
  triagePriorityLabel?: string;
  adaptedProtocol?: string | null;
  lastReadingAt: string;
  photoUrl?: string | null;
}

export interface ActiveRadiationIncidentSummary {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  stormScale: string;
  openedAt: string;
}

export interface FlightSurgeonMetrics {
  totalCrew: number;
  criticalCount: number;
  warningCount: number;
  nominalCount: number;
}
