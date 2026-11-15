/**
 * @module service/auth/RegisterUserUseCase
 * Use case for public user self-registration and immediate JWT issuance.
 */

import { IUserRepository } from "../../repository/IUserRepository.js";
import { AuthResponse, PasswordHasher, TokenSigner, toAuthUser } from "../../entity/User.js";
import { ConflictError, ValidationError } from "../../exception/AppError.js";

/** Self-registration input payload accepted by `RegisterUserUseCase`. */
export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Minimum password length enforced symmetrically with the frontend `RegisterForm`. */
export const MIN_PASSWORD_LENGTH = 6; // Matches frontend RegisterForm validation

/**
 * Validates registration input, enforces email uniqueness (`ConflictError` 409),
 * hashes the password via `PasswordHasher`, provisions a `USER` account, and signs a JWT.
 */
export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenSigner
  ) {}

  async execute(input: RegisterUserInput): Promise<AuthResponse> {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();

    if (!name) throw new ValidationError("El nombre es obligatorio.");
    if (!email || !EMAIL_REGEX.test(email)) throw new ValidationError("El email no es válido.");
    if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    if (await this.userRepo.findByEmail(email)) {
      throw new ConflictError("Ya existe una cuenta registrada con ese email.");
    }

    // Public self-registration always creates astronaut (USER) accounts; ADMIN accounts come from seed data.
    const user = await this.userRepo.create({
      name,
      email,
      passwordHash: await this.hasher.hash(input.password),
    });

    return {
      user: toAuthUser(user),
      token: this.tokens.sign({ id: user.id, email: user.email, role: user.role }),
    };
  }
}
