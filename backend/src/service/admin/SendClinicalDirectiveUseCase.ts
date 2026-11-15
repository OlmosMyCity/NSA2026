import { Directive } from "@prisma/client";
import { ICrewTriageRepository } from "../../repository/ICrewTriageRepository.js";
import { IDirectiveRepository } from "../../repository/IDirectiveRepository.js";
import { NotFoundError } from "../../exception/AppError.js";

export interface SendClinicalDirectiveInput {
  astronautId: string;
  content: string;
  issuedById?: string | null;
  incidentId?: string | null;
}

/** La directiva vive en su propia tabla: nunca se anota sobre una lectura ni se fabrica una. */
export class SendClinicalDirectiveUseCase {
  constructor(
    private readonly crewRepo: ICrewTriageRepository,
    private readonly directiveRepo: IDirectiveRepository
  ) {}

  async execute(input: SendClinicalDirectiveInput): Promise<{ astronautName: string; directive: Directive }> {
    const astronautName = await this.crewRepo.findAstronautName(input.astronautId);
    if (!astronautName) throw new NotFoundError("Astronauta", input.astronautId);

    const directive = await this.directiveRepo.create({
      astronautId: input.astronautId,
      issuedById: input.issuedById ?? null,
      incidentId: input.incidentId ?? null,
      content: input.content,
    });

    return { astronautName, directive };
  }
}

export class ListAstronautDirectivesUseCase {
  constructor(
    private readonly crewRepo: ICrewTriageRepository,
    private readonly directiveRepo: IDirectiveRepository
  ) {}

  async execute(astronautId: string): Promise<Directive[]> {
    if (!(await this.crewRepo.findAstronautName(astronautId))) {
      throw new NotFoundError("Astronauta", astronautId);
    }
    return this.directiveRepo.findByAstronautId(astronautId);
  }
}
