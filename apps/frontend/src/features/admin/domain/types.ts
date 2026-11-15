/** `NO_DATA`: sin lecturas. Nunca se presenta como `OK`. */
export type TriageStatus = 'CRITICAL' | 'WARNING' | 'OK' | 'NO_DATA';

export interface CrewMemberTriage {
  astronautId: string;
  astronautName: string;
  missionId: string;
  missionName: string;
  role: string;
  environment: string | null;
  status: TriageStatus;
  /** Los valores clínicos son `null` cuando el tripulante no tiene lecturas. */
  heartRate: number | null;
  bloodPressure: string | null;
  spo2: number | null;
  glucose: number | null;
  temperature: number | null;
  sleepHours: number | null;
  mood: number | null;
  alerts: string[];
  recommendation?: string | null;
  lastReadingAt: string | null;
  /** Los signos vivos de la última lectura siguen dentro de la ventana de vigencia. */
  isFresh: boolean;
  expiresAt: string | null;
  photoUrl?: string | null;
}

export interface FlightSurgeonMetrics {
  totalCrew: number;
  criticalCount: number;
  warningCount: number;
  nominalCount: number;
  noDataCount: number;
}
