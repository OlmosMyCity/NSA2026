import { Role } from "@prisma/client";
import { IUserRepository } from "../../repository/IUserRepository.js";
import { AuthUser, PasswordHasher, toAuthUser } from "../../entity/User.js";
import { ConflictError } from "../../exception/AppError.js";

export interface CreateUserByAdminInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

/**
 * Alta de cuentas con rol. El registro público solo crea astronautas; las cuentas
 * que ven datos de terceros (operador, cirujano) las crea un cirujano de vuelo.
 */
export class CreateUserByAdminUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly hasher: PasswordHasher
  ) {}

  async execute(input: CreateUserByAdminInput): Promise<AuthUser> {
    const email = input.email.trim().toLowerCase();
    if (await this.userRepo.findByEmail(email)) {
      throw new ConflictError("Ya existe una cuenta registrada con ese email.");
    }

    const user = await this.userRepo.create({
      name: input.name.trim(),
      email,
      passwordHash: await this.hasher.hash(input.password),
      role: input.role,
    });

    return toAuthUser(user);
  }
}
