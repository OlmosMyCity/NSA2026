/**
 * @module domain/repository/IDirectiveRepository
 * Repository contract for crew operational and clinical directives.
 */

import { Directive } from "@prisma/client";
import { CreateDirectiveDTO } from "../models/Directive.js";

/** Persistence port for issuing, querying, and acknowledging astronaut directives. */
export interface IDirectiveRepository {
  create(data: CreateDirectiveDTO): Promise<Directive>;
  findByAstronautId(astronautId: string, limit?: number): Promise<Directive[]>;
  acknowledge(id: string): Promise<Directive | null>;
}
