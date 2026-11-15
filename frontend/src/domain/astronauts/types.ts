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
  _count?: {
    faceSamples?: number;
  };
}

export interface FaceBiometricSample {
  id: string;
  astronautId: string;
  imageUrl: string;
  label: string | null;
  embedding: number[];
  qualityScore: number;
  uploadedById: string | null;
  createdAt: string;
}

export interface MissionBiometricProfile {
  astronautId: string;
  astronautName: string;
  role: string;
  missionId: string;
  photoUrl: string | null;
  sampleCount: number;
  embeddings: number[][];
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
