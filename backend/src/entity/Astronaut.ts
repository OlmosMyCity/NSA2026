/**
 * @module entity/Astronaut
 * Domain DTOs and projections for crew astronaut profiles and mission assignments.
 */

import { Astronaut } from "@prisma/client";
import { PaginatedResult } from "./Mission.js";

export type { PaginatedResult };

/** Sin ubicación: se consulta aparte, con sesión (ver IOperatorCrewRepository). */
export type AstronautWithMission = Omit<Astronaut, "currentLocation" | "locationUpdatedAt"> & {
  mission?: {
    id: string;
    name: string;
  };
  _count?: {
    faceSamples?: number;
  };
};

/** Input payload required to enroll an astronaut in a mission. */
export interface CreateAstronautDTO {
  name: string;
  role: string;
  age: number;
  missionId: string;
  userId?: string | null;
  photoUrl?: string | null;
}

/** Partial update payload for modifying an existing astronaut profile. */
export interface UpdateAstronautDTO {
  name?: string;
  role?: string;
  age?: number;
  missionId?: string;
  userId?: string | null;
  photoUrl?: string | null;
}

/** Query filters for paginated astronaut listings. */
export interface AstronautFilters {
  page?: number;
  limit?: number;
  missionId?: string;
  search?: string;
}

