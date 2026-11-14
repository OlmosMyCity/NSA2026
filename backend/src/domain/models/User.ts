import { Role, User } from "@prisma/client";

/** Usuario tal como se expone fuera de la capa de datos: nunca incluye el hash de la contraseña. */
export type PublicUser = Omit<User, "passwordHash">;

export type UserWithAstronaut = User & { astronaut: { id: string } | null };
export type PublicUserWithAstronaut = PublicUser & { astronaut: { id: string } | null };

export interface CreateUserDTO {
  email: string;
  name: string;
  passwordHash: string;
  role?: Role;
}

/** Datos que viajan dentro del JWT y que los middlewares inyectan en `req.user`. */
export interface AuthTokenPayload {
  id: string;
  email: string;
  role: Role;
}

/** Usuario que recibe el frontend tras register/login (contrato de `AuthResponse`). */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  astronautId?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

/** Puertos que implementa infrastructure/services (bcrypt y JWT). */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export function toAuthUser(user: PublicUser & { astronaut?: { id: string } | null }): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ...(user.astronaut ? { astronautId: user.astronaut.id } : {}),
  };
}

export interface TokenSigner {
  sign(payload: AuthTokenPayload): string;
}
