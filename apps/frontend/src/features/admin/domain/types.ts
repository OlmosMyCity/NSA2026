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
  lastReadingAt: string;
  photoUrl?: string | null;
}

export interface FlightSurgeonMetrics {
  totalCrew: number;
  criticalCount: number;
  warningCount: number;
  nominalCount: number;
}
