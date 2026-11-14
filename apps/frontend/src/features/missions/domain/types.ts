export type Environment =
  | 'SPACECRAFT'
  | 'STATION'
  | 'ROVER'
  | 'LUNAR_BASE'
  | 'MARS_BASE';

export type MissionStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED';

export interface Mission {
  id: string;
  name: string;
  description: string;
  environment: Environment;
  status: MissionStatus;
  startDate: string;
  endDate?: string | null;
  patchUrl?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PaginationMeta {
  total: number;
  currentPage: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedMissions {
  data: Mission[];
  pagination: PaginationMeta;
}

export interface MissionFilters {
  page?: number;
  limit?: number;
  environment?: Environment | '';
  status?: MissionStatus | '';
  search?: string;
}

export interface CreateMissionInput {
  name: string;
  description: string;
  environment: Environment;
  status: MissionStatus;
  startDate: string;
  endDate?: string | null;
  patchUrl?: string | null;
}

export interface UpdateMissionInput extends Partial<CreateMissionInput> {}

