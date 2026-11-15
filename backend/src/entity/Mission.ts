/**
 * @module entity/Mission
 * Domain DTOs, mission filters, and shared pagination types.
 */

import { Environment, MissionStatus } from "@prisma/client";

/** Standard pagination metadata shared across paginated domain queries. */
export interface PaginationMeta {
  total: number;
  currentPage: number;
  limit: number;
  totalPages: number;
}

/** Generic paginated query envelope pairing typed records with pagination metadata. */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** Query filters for paginated mission listings. */
export interface MissionFilters {
  page?: number;
  limit?: number;
  environment?: Environment;
  status?: MissionStatus;
  search?: string;
}

/** Input payload for creating a space mission and defining its habitat environment profile. */
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

/** Partial update payload for modifying mission metadata, lifecycle status, or habitat environment. */
export interface UpdateMissionDTO {
  name?: string;
  description?: string;
  environment?: Environment;
  status?: MissionStatus;
  startDate?: Date;
  endDate?: Date | null;
  patchUrl?: string | null;
}

