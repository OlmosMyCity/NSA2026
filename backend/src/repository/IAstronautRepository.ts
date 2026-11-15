/**
 * @module repository/IAstronautRepository
 * Repository contract for astronaut persistence and mission-scoped queries.
 */

import {
  AstronautFilters,
  AstronautWithMission,
  CreateAstronautDTO,
  PaginatedResult,
  UpdateAstronautDTO,
} from "../entity/Astronaut.js";

/** Persistence port for managing crew astronaut profiles (supports soft deletion). */
export interface IAstronautRepository {
  findMany(filters: AstronautFilters): Promise<PaginatedResult<AstronautWithMission>>;
  findById(id: string): Promise<AstronautWithMission | null>;
  /** Optional lookup resolving the astronaut profile linked to an authenticated user ID. */
  findByUserId?(userId: string): Promise<AstronautWithMission | null>;
  create(data: CreateAstronautDTO): Promise<AstronautWithMission>;
  update(id: string, data: UpdateAstronautDTO): Promise<AstronautWithMission | null>;
  /** Marks the astronaut record as deleted (`deletedAt`) without removing historical telemetry. */
  softDelete(id: string): Promise<boolean>;
}

