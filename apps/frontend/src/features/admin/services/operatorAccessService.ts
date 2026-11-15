import { ENV } from '@/features/common/config/env';
import { httpClient } from '@/features/common/services/httpClient';
import { mockDb } from '@/features/common/mocks/mockDb';

export interface OperatorAccount {
  id: string;
  name: string;
  email: string;
}

export interface MissionAssignment {
  id: string;
  name: string;
  operatorId: string | null;
}

export interface OperatorAccess {
  operators: OperatorAccount[];
  missions: MissionAssignment[];
}

export interface CreateOperatorInput {
  name: string;
  email: string;
  password: string;
}

/** Igual que el backend: estas cuentas ven datos de terceros. */
export const OPERATOR_PASSWORD_MIN = 10;

class OperatorAccessService {
  async getAccess(): Promise<OperatorAccess> {
    if (ENV.USE_MOCKS) {
      return {
        operators: mockDb.users
          .filter((u) => u.role === 'OPERATOR')
          .map(({ id, name, email }) => ({ id, name, email })),
        missions: mockDb.missions
          .filter((m) => !m.deletedAt)
          .map((m) => ({ id: m.id, name: m.name, operatorId: m.operatorId ?? null })),
      };
    }
    return httpClient.get<OperatorAccess>('/admin/operators');
  }

  async createOperator(input: CreateOperatorInput): Promise<OperatorAccount> {
    if (ENV.USE_MOCKS) {
      const email = input.email.trim().toLowerCase();
      if (mockDb.users.some((u) => u.email.toLowerCase() === email)) {
        throw new Error('An account with that email already exists.');
      }
      const operator = { id: `user-operator-${Date.now()}`, name: input.name.trim(), email };
      mockDb.users.push({ ...operator, role: 'OPERATOR' });
      return operator;
    }
    return httpClient.post<OperatorAccount>('/admin/users', { ...input, role: 'OPERATOR' });
  }

  async assignMission(missionId: string, operatorId: string | null): Promise<void> {
    if (ENV.USE_MOCKS) {
      const mission = mockDb.missions.find((m) => m.id === missionId);
      if (!mission) throw new Error('Mission not found.');
      mission.operatorId = operatorId;
      mockDb.save();
      return;
    }
    await httpClient.put(`/admin/missions/${missionId}/operator`, { operatorId });
  }
}

export const operatorAccessService = new OperatorAccessService();
