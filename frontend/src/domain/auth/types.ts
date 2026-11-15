/** `OPERATOR`: supervisión desde Tierra, sin acceso a valores clínicos. */
export type Role = 'ADMIN' | 'USER' | 'OPERATOR';

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

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

