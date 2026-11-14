import { UserState } from "@prisma/client";
import { IUserRepository } from "../../../domain/repository/IUserRepository.js";
import { AuthResponse, PasswordHasher, TokenSigner, toAuthUser } from "../../../domain/models/User.js";
import { UnauthorizedError, ValidationError } from "../../../domain/errors/AppError.js";

export interface LoginUserInput {
  email: string;
  password: string;
}

// Mensaje genérico: no revela si el email existe o si falló la contraseña.
const INVALID_CREDENTIALS = "Email o contraseña incorrectos.";

export class LoginUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenSigner
  ) {}

  async execute(input: LoginUserInput): Promise<AuthResponse> {
    const email = input.email?.trim().toLowerCase();
    if (!email || !input.password) {
      throw new ValidationError("El email y la contraseña son obligatorios.");
    }

    const user = await this.userRepo.findByEmail(email);
    if (!user || !(await this.hasher.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }

    if (user.state !== UserState.ACTIVE) {
      throw new UnauthorizedError("La cuenta está desactivada.");
    }

    const { passwordHash: _omit, ...publicUser } = user;
    return {
      user: toAuthUser(publicUser),
      token: this.tokens.sign({ id: user.id, email: user.email, role: user.role }),
    };
  }
}
