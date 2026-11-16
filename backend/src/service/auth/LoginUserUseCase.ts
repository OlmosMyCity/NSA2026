/**
 * @module service/auth/LoginUserUseCase
 * Use case for authenticating users with email/password credentials and issuing a JWT.
 */

import { UserState } from "@prisma/client";
import { IUserRepository } from "../../repository/IUserRepository.js";
import { AuthResponse, PasswordHasher, TokenSigner, toAuthUser } from "../../entity/User.js";
import { UnauthorizedError, ValidationError } from "../../exception/AppError.js";

/** Credentials payload accepted by `LoginUserUseCase`. */
export interface LoginUserInput {
  email: string;
  password: string;
}

// Generic message: avoids leaking whether the email exists or the password failed.
const INVALID_CREDENTIALS = "Invalid email or password.";

/**
 * Normalizes email, verifies the password hash via `PasswordHasher`, enforces `UserState.ACTIVE`,
 * and returns a sanitized `AuthUser` paired with a signed JWT (`AuthResponse`).
 */
export class LoginUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenSigner
  ) {}

  async execute(input: LoginUserInput): Promise<AuthResponse> {
    const email = input.email?.trim().toLowerCase();
    if (!email || !input.password) {
      throw new ValidationError("Email and password are required.");
    }

    const user = await this.userRepo.findByEmail(email);
    if (!user || !(await this.hasher.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }

    if (user.state !== UserState.ACTIVE) {
      throw new UnauthorizedError("Account is disabled.");
    }

    const { passwordHash: _omit, ...publicUser } = user;
    return {
      user: toAuthUser(publicUser),
      token: this.tokens.sign({ id: user.id, email: user.email, role: user.role }),
    };
  }
}
