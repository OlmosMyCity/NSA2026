import { ICrewTriageRepository } from "../../../domain/repository/ICrewTriageRepository.js";
import { ConflictError, NotFoundError } from "../../../domain/errors/AppError.js";

export interface SendClinicalDirectiveResult {
  astronautName: string;
}

export class SendClinicalDirectiveUseCase {
  constructor(private readonly crewRepo: ICrewTriageRepository) {}

  async execute(astronautId: string, directives: string): Promise<SendClinicalDirectiveResult> {
    const astronautName = await this.crewRepo.findAstronautName(astronautId);
    if (!astronautName) {
      throw new NotFoundError("Astronauta", astronautId);
    }

    // La directiva se anota sobre la última lectura real. Nunca se fabrica una lectura
    // con valores supuestos para poder adjuntarla.
    const saved = await this.crewRepo.setLatestReadingRecommendation(
      astronautId,
      `[DIRECTIVA MÉDICA EN VIGOR]: ${directives}`
    );
    if (!saved) {
      throw new ConflictError(
        `${astronautName} aún no tiene lecturas de salud. Solicita una medición antes de enviar la directiva.`
      );
    }

    return { astronautName };
  }
}
