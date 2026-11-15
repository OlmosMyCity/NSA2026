/**
 * @module repository/IUserRepository
 * Repository contract for authenticated user accounts and credential lookups.
 */

import { CreateUserDTO, PublicUser, PublicUserWithAstronaut, UserWithAstronaut } from "../entity/User.js";

/** Persistence port for user identity management. */
export interface IUserRepository {
  /** Includes `passwordHash` and linked astronaut; used exclusively for credential verification during login. */
  findByEmail(email: string): Promise<UserWithAstronaut | null>;
  findById(id: string): Promise<PublicUserWithAstronaut | null>;
  create(data: CreateUserDTO): Promise<PublicUser>;
}
