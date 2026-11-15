import { CrewLocation, Role } from "@prisma/client";
import { IAstronautRepository } from "../../../domain/repository/IAstronautRepository.js";
import { IOperatorCrewRepository } from "../../../domain/repository/IOperatorCrewRepository.js";
import { ForbiddenError, NotFoundError } from "../../../domain/errors/AppError.js";

export interface LocationRequester {
  id: string;
  role: Role;
}

/** La ubicación es del propio tripulante o del cirujano de vuelo; el operador la ve solo en su resumen. */
async function assertOwnOrSurgeon(
  astronautRepo: IAstronautRepository,
  requester: LocationRequester,
  astronautId: string
): Promise<void> {
  if (requester.role === Role.ADMIN) return;

  const own = requester.role === Role.USER ? await astronautRepo.findByUserId?.(requester.id) : null;
  if (!own || own.id !== astronautId) {
    throw new ForbiddenError("Solo puedes consultar o actualizar tu propia ubicación.");
  }
}

export class GetCrewLocationUseCase {
  constructor(
    private readonly astronautRepo: IAstronautRepository,
    private readonly crewRepo: IOperatorCrewRepository
  ) {}

  async execute(
    astronautId: string,
    requester: LocationRequester
  ): Promise<{ currentLocation: CrewLocation | null; locationUpdatedAt: string | null }> {
    await assertOwnOrSurgeon(this.astronautRepo, requester, astronautId);

    const found = await this.crewRepo.findLocation(astronautId);
    if (!found) throw new NotFoundError("Astronauta", astronautId);

    return {
      currentLocation: found.currentLocation,
      locationUpdatedAt: found.locationUpdatedAt?.toISOString() ?? null,
    };
  }
}

export interface UpdateCrewLocationInput {
  astronautId: string;
  location: CrewLocation;
  requester: LocationRequester;
}

export class UpdateCrewLocationUseCase {
  constructor(
    private readonly astronautRepo: IAstronautRepository,
    private readonly crewRepo: IOperatorCrewRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async execute(input: UpdateCrewLocationInput): Promise<{ currentLocation: CrewLocation; locationUpdatedAt: string }> {
    await assertOwnOrSurgeon(this.astronautRepo, input.requester, input.astronautId);

    const updated = await this.crewRepo.updateLocation(input.astronautId, input.location, this.now());
    if (!updated) throw new NotFoundError("Astronauta", input.astronautId);

    return {
      currentLocation: updated.currentLocation,
      locationUpdatedAt: updated.locationUpdatedAt.toISOString(),
    };
  }
}
