import {
  AstronautFilters,
  AstronautWithMission,
  CreateAstronautDTO,
  PaginatedResult,
  UpdateAstronautDTO,
} from "../models/Astronaut.js";

export interface IAstronautRepository {
  findMany(filters: AstronautFilters): Promise<PaginatedResult<AstronautWithMission>>;
  findById(id: string): Promise<AstronautWithMission | null>;
  findByUserId?(userId: string): Promise<AstronautWithMission | null>;
  create(data: CreateAstronautDTO): Promise<AstronautWithMission>;
  update(id: string, data: UpdateAstronautDTO): Promise<AstronautWithMission | null>;
  softDelete(id: string): Promise<boolean>;
}

