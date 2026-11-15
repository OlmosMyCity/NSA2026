import { httpClient } from '@/services/httpClient';

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
    return httpClient.get<OperatorAccess>('/admin/operators');
  }

  async createOperator(input: CreateOperatorInput): Promise<OperatorAccount> {
    return httpClient.post<OperatorAccount>('/admin/users', { ...input, role: 'OPERATOR' });
  }

  async assignMission(missionId: string, operatorId: string | null): Promise<void> {
    await httpClient.put(`/admin/missions/${missionId}/operator`, { operatorId });
  }
}

export const operatorAccessService = new OperatorAccessService();
