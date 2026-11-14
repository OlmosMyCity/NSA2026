import { Mission } from "@prisma/client";
import {
  CreateMissionDTO,
  MissionFilters,
  PaginatedResult,
  UpdateMissionDTO,
} from "../models/Mission.js";

export interface IMissionRepository {
  findMany(filters: MissionFilters): Promise<PaginatedResult<Mission>>;
  findById(id: string): Promise<Mission | null>;
  create(data: CreateMissionDTO): Promise<Mission>;
  update(id: string, data: UpdateMissionDTO): Promise<Mission | null>;
  softDelete(id: string): Promise<boolean>;
}

