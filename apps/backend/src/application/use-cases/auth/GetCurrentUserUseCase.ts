/**
 * @module application/use-cases/auth/GetCurrentUserUseCase
 * Use case for resolving the currently authenticated user profile from a verified JWT subject.
 */

import { UserState } from "@prisma/client";
import { IUserRepository } from "../../../domain/repository/IUserRepository.js";
import { AuthUser, toAuthUser } from "../../../domain/models/User.js";
import { UnauthorizedError } from "../../../domain/errors/AppError.js";

/**
 * Fetches the authenticated user and projects it to `AuthUser`.
 * Rejects deleted or non-`ACTIVE` accounts even if the bearer token is still cryptographically valid.
 */
export class GetCurrentUserUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  /** Rejects with 401 `UnauthorizedError` if the account was removed or deactivated while the JWT remains unexpired. */
  async execute(userId: string): Promise<AuthUser> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.state !== UserState.ACTIVE) {
      throw new UnauthorizedError("La sesión ya no es válida. Inicia sesión nuevamente.");
    }
    return toAuthUser(user);
  }
}
