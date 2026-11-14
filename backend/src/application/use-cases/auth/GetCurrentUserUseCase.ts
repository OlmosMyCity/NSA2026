import { UserState } from "@prisma/client";
import { IUserRepository } from "../../../domain/repository/IUserRepository.js";
import { AuthUser, toAuthUser } from "../../../domain/models/User.js";
import { UnauthorizedError } from "../../../domain/errors/AppError.js";

export class GetCurrentUserUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  /** El token puede seguir vigente aunque la cuenta se haya borrado o desactivado: en ese caso, 401. */
  async execute(userId: string): Promise<AuthUser> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.state !== UserState.ACTIVE) {
      throw new UnauthorizedError("La sesión ya no es válida. Inicia sesión nuevamente.");
    }
    return toAuthUser(user);
  }
}
