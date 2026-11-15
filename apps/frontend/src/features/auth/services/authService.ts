/**
 * Authentication and session management service.
 * Handles credential sign-in, user registration, and local token/user persistence
 * across both mock mode (`ENV.USE_MOCKS`) and the backend `/auth` API.
 *
 * @module features/auth/services/authService
 */

import { ENV } from '@/features/common/config/env';
import { httpClient, ApiError } from '@/features/common/services/httpClient';
import { authStorage } from '@/features/common/services/storage';
import { mockDb } from '@/features/common/mocks/mockDb';
import { AuthResponse, AuthUser, LoginInput, RegisterInput } from '../domain/types';

class AuthService {
  /** Authenticates a crew member or Flight Surgeon and persists session credentials. */
  async login(credentials: LoginInput): Promise<AuthResponse> {
    if (ENV.USE_MOCKS) {
      // Simulate authentication using official seeded test credentials
      const email = credentials.email.trim().toLowerCase();
      const password = credentials.password;

      if (email === 'elena.rodriguez@nasa.gov' && password === 'HrpFlight#2026') {
        const response: AuthResponse = {
          user: {
            id: 'user-admin-01',
            email: 'elena.rodriguez@nasa.gov',
            name: 'Dra. Elena Rodriguez',
            role: 'ADMIN',
          },
          token: `simulated-jwt-token-admin-${Date.now()}`,
        };
        authStorage.setToken(response.token);
        authStorage.setUser(response.user);
        return response;
      }

      if (email === 'r.wiseman@nasa.gov' && password === 'OrionCrew#4IV') {
        const response: AuthResponse = {
          user: {
            id: 'user-crew-01',
            email: 'r.wiseman@nasa.gov',
            name: 'Reid Wiseman',
            role: 'USER',
            astronautId: 'astro-01',
          },
          token: `simulated-jwt-token-crew-${Date.now()}`,
        };
        authStorage.setToken(response.token);
        authStorage.setUser(response.user);
        return response;
      }

      // Check whether this is a newly registered mock user
      const existingUser = mockDb.users.find((u) => u.email.toLowerCase() === email);
      if (existingUser && password.length >= 6) {
        const response: AuthResponse = {
          user: {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name,
            role: existingUser.role,
            astronautId: existingUser.astronautId,
          },
          token: `simulated-jwt-token-registered-${Date.now()}`,
        };
        authStorage.setToken(response.token);
        authStorage.setUser(response.user);
        return response;
      }

      throw new ApiError('Credenciales de acceso orbital inválidas o no autorizadas.', 401);
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

  /** Registers a new crew account (`USER` role) and initializes an active session. */
  async register(input: RegisterInput): Promise<AuthResponse> {
    if (ENV.USE_MOCKS) {
      const email = input.email.trim().toLowerCase();

      // Duplicate email check
      const duplicate = mockDb.users.some((u) => u.email.toLowerCase() === email);
      if (duplicate) {
        throw new ApiError('El correo electrónico ya se encuentra registrado en el centro de control.', 409);
      }

      const newUser = {
        id: `user-registered-${Date.now()}`,
        email,
        name: input.name.trim(),
        role: 'USER' as const,
      };

      mockDb.users.push(newUser);
      mockDb.save();

      const response: AuthResponse = {
        user: newUser,
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

