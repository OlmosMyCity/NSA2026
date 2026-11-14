import { Astronaut } from "@prisma/client";
import { PaginatedResult } from "./Mission.js";

export type { PaginatedResult };

export type AstronautWithMission = Astronaut & {
  mission?: {
    id: string;
    name: string;
  };
};

export interface CreateAstronautDTO {
  name: string;
  role: string;
  age: number;
  missionId: string;
  userId?: string | null;
  photoUrl?: string | null;
}

export interface UpdateAstronautDTO {
  name?: string;
  role?: string;
  age?: number;
  missionId?: string;
  userId?: string | null;
  photoUrl?: string | null;
}

export interface AstronautFilters {
  page?: number;
  limit?: number;
  missionId?: string;
  search?: string;
}

