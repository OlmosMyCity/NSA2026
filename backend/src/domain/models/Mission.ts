import { Environment, MissionStatus } from "@prisma/client";

export interface PaginationMeta {
  total: number;
  currentPage: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface MissionFilters {
  page?: number;
  limit?: number;
  environment?: Environment;
  status?: MissionStatus;
  search?: string;
}

export interface CreateMissionDTO {
  name: string;
  description: string;
  environment?: Environment;
  status?: MissionStatus;
  startDate: Date;
  endDate?: Date | null;
  patchUrl?: string | null;
  createdById: string;
}

export interface UpdateMissionDTO {
  name?: string;
  description?: string;
  environment?: Environment;
  status?: MissionStatus;
  startDate?: Date;
  endDate?: Date | null;
  patchUrl?: string | null;
}

