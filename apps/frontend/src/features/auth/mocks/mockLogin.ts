import { ApiError } from '@/features/common/services/httpClient';
import { mockDb } from '@/features/common/mocks/mockDb';
import type { AuthResponse, LoginInput } from '../domain/types';

/**
 * Login simulado (NEXT_PUBLIC_USE_MOCKS=true) con las credenciales de demo del seed.
 * Solo se carga con import dinámico desde authService, así que no llega al bundle de
 * producción. Nunca importar este módulo de forma estática.
 */
export function mockLogin(credentials: LoginInput): AuthResponse {
  // Simulación con las credenciales de prueba oficiales del seed
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
    return response;
  }

  // Comprobar si es un usuario recién registrado en el mock
  const existingUser = mockDb.users.find((u) => u.email.toLowerCase() === email);
  // Solo cuentas registradas en el mock, con la contraseña que se guardó al registrarse.
  if (existingUser?.passwordHash && existingUser.passwordHash === password) {
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
    return response;
  }

  throw new ApiError('Credenciales de acceso orbital inválidas o no autorizadas.', 401);
}
