/**
 * @module service/auth/GetCurrentUserUseCase
 * Use case for resolving the currently authenticated user profile from a verified JWT subject.
 */

import { UserState } from "@prisma/client";
import { IUserRepository } from "../../repository/IUserRepository.js";
import { AuthUser, toAuthUser } from "../../entity/User.js";
import { UnauthorizedError } from "../../exception/AppError.js";

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
      throw new UnauthorizedError("Session is no longer valid. Please sign in again.");
    }
    return toAuthUser(user);
  }
}
