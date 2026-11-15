/**
 * @module repository/IMissionRepository
 * Repository contract for space mission persistence and habitat configuration queries.
 */

import { Mission } from "@prisma/client";
import {
  CreateMissionDTO,
  MissionFilters,
  PaginatedResult,
  UpdateMissionDTO,
} from "../entity/Mission.js";

/** Persistence port for managing space missions (supports soft deletion). */
export interface IMissionRepository {
  findMany(filters: MissionFilters): Promise<PaginatedResult<Mission>>;
  findById(id: string): Promise<Mission | null>;
  create(data: CreateMissionDTO): Promise<Mission>;
  update(id: string, data: UpdateMissionDTO): Promise<Mission | null>;
  softDelete(id: string): Promise<boolean>;
}

