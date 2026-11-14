import { IAstronautRepository } from "../../../domain/repository/IAstronautRepository.js";
import { AstronautWithMission, CreateAstronautDTO } from "../../../domain/models/Astronaut.js";
import { ValidationError } from "../../../domain/errors/AppError.js";

export class CreateAstronautUseCase {
  constructor(private readonly astronautRepo: IAstronautRepository) {}

  async execute(data: CreateAstronautDTO): Promise<AstronautWithMission> {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError("El nombre del astronauta es obligatorio.");
    }
    if (!data.role || data.role.trim().length === 0) {
      throw new ValidationError("El rol del astronauta en la misión es obligatorio.");
    }
    if (!data.missionId || data.missionId.trim().length === 0) {
      throw new ValidationError("La misión asignada ('missionId') es obligatoria.");
    }
    if (typeof data.age !== "number" || isNaN(data.age) || data.age <= 0) {
      throw new ValidationError("La edad del astronauta debe ser un número entero positivo.");
    }

    return this.astronautRepo.create({
      ...data,
      name: data.name.trim(),
      role: data.role.trim(),
    });
  }
}

