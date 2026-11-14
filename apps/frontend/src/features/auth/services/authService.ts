import { ENV } from '@/features/common/config/env';
import { httpClient, ApiError } from '@/features/common/services/httpClient';
import { authStorage } from '@/features/common/services/storage';
import { mockDb } from '@/features/common/mocks/mockDb';
import { AuthResponse, AuthUser, LoginInput, RegisterInput } from '../domain/types';

class AuthService {
  async login(credentials: LoginInput): Promise<AuthResponse> {
    // Comparación literal con process.env: Next.js la resuelve en el build y, con los mocks
    // apagados, elimina este import dinámico y las credenciales de demo del bundle.
    if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
      const { mockLogin } = await import('../mocks/mockLogin');
      const response = mockLogin(credentials);
      authStorage.setToken(response.token);
      authStorage.setUser(response.user);
      return response;
    }

    try {
      const response = await httpClient.post<AuthResponse>('/auth/login', credentials, {
        skipAuth: true,
      });
      authStorage.setToken(response.token);
      authStorage.setUser(response.user);
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Fallo en el servicio de autenticación.', 500);
    }
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    if (ENV.USE_MOCKS) {
      const email = input.email.trim().toLowerCase();

      // Validación de duplicados
      const duplicate = mockDb.users.some((u) => u.email.toLowerCase() === email);
      if (duplicate) {
        throw new ApiError('El correo electrónico ya se encuentra registrado en el centro de control.', 409);
      }

      const newUser = {
        id: `user-registered-${Date.now()}`,
        email,
        name: input.name.trim(),
        role: 'USER' as const,
        // Solo modo mock (localStorage del navegador): el backend real guarda un hash bcrypt.
        passwordHash: input.password,
      };

      mockDb.users.push(newUser);
      mockDb.save();

      const response: AuthResponse = {
        user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
        token: `simulated-jwt-token-registered-${Date.now()}`,
      };

      authStorage.setToken(response.token);
      authStorage.setUser(response.user);
      return response;
    }

    try {
      const response = await httpClient.post<AuthResponse>('/auth/register', input, {
        skipAuth: true,
      });
      authStorage.setToken(response.token);
      authStorage.setUser(response.user);
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to register new user in the system.', 500);
    }
  }

  logout(): void {
    authStorage.clearSession();
  }

  getCurrentUser(): AuthUser | null {
    return authStorage.getUser();
  }

  getToken(): string | null {
    return authStorage.getToken();
  }
}

export const authService = new AuthService();

