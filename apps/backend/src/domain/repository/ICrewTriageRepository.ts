import { HealthReading } from "@prisma/client";

/** Tripulante con su última lectura registrada (o `null` si nunca ha medido). */
export interface CrewTriageRecord {
  astronautId: string;
  astronautName: string;
  crewRole: string;
  photoUrl: string | null;
  missionId: string;
  missionName: string | null;
  environment: string | null;
  latestReading: HealthReading | null;
}

export interface ICrewTriageRepository {
  listCrewWithLatestReading(): Promise<CrewTriageRecord[]>;
  findAstronautName(astronautId: string): Promise<string | null>;
  /** Devuelve `false` si el tripulante no tiene ninguna lectura donde anotar la directiva. */
  setLatestReadingRecommendation(astronautId: string, recommendation: string): Promise<boolean>;
}
