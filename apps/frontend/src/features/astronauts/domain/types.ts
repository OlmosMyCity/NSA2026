import { PaginationMeta } from '@/features/missions/domain/types';
import type { CrewLocation } from '@/features/operator/domain/types';

export type { PaginationMeta };

export interface Astronaut {
  id: string;
  missionId: string;
  userId?: string | null;
  name: string;
  role: string;
  age: number;
  photoUrl?: string | null;
  currentLocation?: CrewLocation | null;
  locationUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  mission?: {
    id: string;
    name: string;
  };
}

export interface PaginatedAstronauts {
  data: Astronaut[];
  pagination: PaginationMeta;
}

export interface AstronautFilters {
  page?: number;
  limit?: number;
  missionId?: string;
  search?: string;
}

export interface CreateAstronautInput {
  name: string;
  role: string;
  age: number;
  missionId: string;
  userId?: string | null;
  photoUrl?: string | null;
}

export interface UpdateAstronautInput extends Partial<CreateAstronautInput> {}
