/**
 * @module domain/models/User
 * Domain projections, DTOs, and cryptographic port interfaces for authentication and user identity.
 */

import { Role, User } from "@prisma/client";

/** User projection exposed outside the persistence layer; never includes `passwordHash`. */
export type PublicUser = Omit<User, "passwordHash">;

/** Full user record joined with an optional linked astronaut profile ID (for login verification). */
export type UserWithAstronaut = User & { astronaut: { id: string } | null };

/** Public user projection joined with an optional linked astronaut profile ID. */
export type PublicUserWithAstronaut = PublicUser & { astronaut: { id: string } | null };

/** Input payload for persisting a new user account with a pre-hashed password. */
export interface CreateUserDTO {
  email: string;
  name: string;
  passwordHash: string;
  role?: Role;
}

/** Claims embedded in the signed JWT and attached to `req.user` by auth middleware. */
export interface AuthTokenPayload {
  id: string;
  email: string;
  role: Role;
}

/** Sanitized user representation returned to the frontend after register/login (`AuthResponse` contract). */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  astronautId?: string;
}

/** Authentication payload pairing the sanitized user profile with a signed bearer token. */
export interface AuthResponse {
  user: AuthUser;
  token: string;
}

/** Port implemented by `infrastructure/services` (bcrypt) for password hashing and verification. */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

/** Maps a `PublicUser` (and optional linked astronaut ID) into the frontend `AuthUser` contract. */
export function toAuthUser(user: PublicUser & { astronaut?: { id: string } | null }): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ...(user.astronaut ? { astronautId: user.astronaut.id } : {}),
  };
}

/** Port implemented by `infrastructure/services` (JWT) for signing authentication tokens. */
export interface TokenSigner {
  sign(payload: AuthTokenPayload): string;
}
