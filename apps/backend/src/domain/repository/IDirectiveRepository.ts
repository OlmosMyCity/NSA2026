import { Directive } from "@prisma/client";
import { CreateDirectiveDTO } from "../models/Directive.js";

export interface IDirectiveRepository {
  create(data: CreateDirectiveDTO): Promise<Directive>;
  findByAstronautId(astronautId: string, limit?: number): Promise<Directive[]>;
  acknowledge(id: string): Promise<Directive | null>;
}
