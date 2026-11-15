import { CrewLocation, Environment, HealthReading } from "@prisma/client";

/** Tripulante de una misión asignada a un operador, con sus lecturas más recientes. */
export interface OperatorCrewRecord {
  astronautId: string;
  astronautName: string;
  crewRole: string;
  photoUrl: string | null;
  missionId: string;
  missionName: string;
  environment: Environment;
  currentLocation: CrewLocation | null;
  locationUpdatedAt: Date | null;
  /** De la más reciente a la más antigua. */
  recentReadings: HealthReading[];
}

export interface IOperatorCrewRepository {
  /** Solo devuelve tripulantes de misiones cuyo operador es `operatorId`. */
  listCrewForOperator(operatorId: string): Promise<OperatorCrewRecord[]>;
  /** Devuelve `false` si la misión no existe. */
  setMissionOperator(missionId: string, operatorId: string | null): Promise<boolean>;
  /** Devuelve `null` si el astronauta no existe. */
  updateLocation(
    astronautId: string,
    location: CrewLocation,
    at: Date
  ): Promise<{ currentLocation: CrewLocation; locationUpdatedAt: Date } | null>;
}
