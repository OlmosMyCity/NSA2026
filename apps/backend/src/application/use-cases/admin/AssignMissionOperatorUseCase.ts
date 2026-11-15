import { Role } from "@prisma/client";
import { IUserRepository } from "../../../domain/repository/IUserRepository.js";
import { IOperatorCrewRepository } from "../../../domain/repository/IOperatorCrewRepository.js";
import { NotFoundError, ValidationError } from "../../../domain/errors/AppError.js";

/** Asigna (o retira, con `null`) el operador en Tierra de una misión. */
export class AssignMissionOperatorUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly crewRepo: IOperatorCrewRepository
  ) {}

  async execute(missionId: string, operatorId: string | null): Promise<void> {
    if (operatorId !== null) {
      const user = await this.userRepo.findById(operatorId);
      if (!user) throw new NotFoundError("Usuario", operatorId);
      if (user.role !== Role.OPERATOR) {
        throw new ValidationError("El usuario indicado no tiene rol de operador.");
      }
    }

    const assigned = await this.crewRepo.setMissionOperator(missionId, operatorId);
    if (!assigned) throw new NotFoundError("Misión", missionId);
  }
}
