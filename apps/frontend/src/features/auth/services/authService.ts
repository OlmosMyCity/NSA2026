import { httpClient, ApiError } from '@/features/common/services/httpClient';
import { authStorage } from '@/features/common/services/storage';
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from '../domain/types';

/** En modo mock, httpClient responde con el backend simulado (features/common/mocks). */
class AuthService {
  async login(credentials: LoginInput): Promise<AuthResponse> {
    try {
      const response = await httpClient.post<AuthResponse>('/auth/login', credentials, { skipAuth: true });
      authStorage.setToken(response.token);
      authStorage.setUser(response.user);
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Authentication service failure.', 500);
    }
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    try {
      const response = await httpClient.post<AuthResponse>('/auth/register', input, { skipAuth: true });
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

