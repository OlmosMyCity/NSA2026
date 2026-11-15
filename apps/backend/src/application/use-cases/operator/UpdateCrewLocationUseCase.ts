import { CrewLocation, Role } from "@prisma/client";
import { IAstronautRepository } from "../../../domain/repository/IAstronautRepository.js";
import { IOperatorCrewRepository } from "../../../domain/repository/IOperatorCrewRepository.js";
import { ForbiddenError, NotFoundError } from "../../../domain/errors/AppError.js";

export interface UpdateCrewLocationInput {
  astronautId: string;
  location: CrewLocation;
  requester: { id: string; role: Role };
}

/** La ubicación la declara el propio tripulante o el cirujano de vuelo; el operador solo la lee. */
export class UpdateCrewLocationUseCase {
  constructor(
    private readonly astronautRepo: IAstronautRepository,
    private readonly crewRepo: IOperatorCrewRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(input: UpdateCrewLocationInput): Promise<{ currentLocation: CrewLocation; locationUpdatedAt: string }> {
    if (input.requester.role !== Role.ADMIN) {
      const own =
        input.requester.role === Role.USER ? await this.astronautRepo.findByUserId?.(input.requester.id) : null;
      if (!own || own.id !== input.astronautId) {
        throw new ForbiddenError("Solo puedes actualizar tu propia ubicación.");
      }
    }

    const updated = await this.crewRepo.updateLocation(input.astronautId, input.location, this.now());
    if (!updated) throw new NotFoundError("Astronauta", input.astronautId);

    return {
      currentLocation: updated.currentLocation,
      locationUpdatedAt: updated.locationUpdatedAt.toISOString(),
    };
  }
}
