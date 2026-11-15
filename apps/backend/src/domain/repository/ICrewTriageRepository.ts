import { Directive, HealthReading, Incident } from "@prisma/client";

/** Tripulante con su última lectura (o `null` si nunca ha medido) y su última directiva. */
export interface CrewTriageRecord {
  astronautId: string;
  astronautName: string;
  crewRole: string;
  photoUrl: string | null;
  missionId: string;
  missionName: string | null;
  environment: string | null;
  latestReading: HealthReading | null;
  latestDirective: Directive | null;
}

export interface ICrewTriageRepository {
  listCrewWithLatestReading(): Promise<CrewTriageRecord[]>;
  findAstronautName(astronautId: string): Promise<string | null>;
  /** Incidente de radiación abierto o reconocido más reciente, si lo hay. */
  findActiveRadiationIncident(): Promise<Incident | null>;
}
