import { Role } from "@prisma/client";
import { IUserRepository } from "../../repository/IUserRepository.js";
import { IOperatorCrewRepository } from "../../repository/IOperatorCrewRepository.js";
import { NotFoundError, ValidationError } from "../../exception/AppError.js";

/** Asigna (o retira, con `null`) el operador en Tierra de una misión. */
export class AssignMissionOperatorUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly crewRepo: IOperatorCrewRepository
  ) {}

  async execute(missionId: string, operatorId: string | null): Promise<void> {
    if (operatorId !== null) {
      const user = await this.userRepo.findById(operatorId);
      if (!user) throw new NotFoundError("User", operatorId);
      if (user.role !== Role.OPERATOR) {
        throw new ValidationError("The specified user does not have the operator role.");
      }
    }

    const assigned = await this.crewRepo.setMissionOperator(missionId, operatorId);
    if (!assigned) throw new NotFoundError("Mission", missionId);
  }
}
