import { CreateUserDTO, PublicUser, PublicUserWithAstronaut, UserWithAstronaut } from "../models/User.js";

export interface IUserRepository {
  /** Incluye `passwordHash` y el astronauta vinculado: solo para verificar credenciales en el login. */
  findByEmail(email: string): Promise<UserWithAstronaut | null>;
  findById(id: string): Promise<PublicUserWithAstronaut | null>;
  create(data: CreateUserDTO): Promise<PublicUser>;
}
