import type { Paginated, PaginationMeta } from '@/domain/common/pagination';

export type { PaginationMeta };

export interface Astronaut {
  id: string;
  missionId: string;
  userId?: string | null;
  name: string;
  role: string;
  age: number;
  photoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  mission?: {
    id: string;
    name: string;
  };
}

export type PaginatedAstronauts = Paginated<Astronaut>;

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

export type UpdateAstronautInput = Partial<CreateAstronautInput>;
