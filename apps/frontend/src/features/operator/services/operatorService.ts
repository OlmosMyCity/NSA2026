import { httpClient } from '@/features/common/services/httpClient';
import type { OperatorCrewDetail, OperatorCrewOverview } from '../domain/types';

/** Vista del operador de tierra: solo la tripulación de las misiones que tiene asignadas. */
class OperatorService {
  async getCrewOverview(): Promise<OperatorCrewOverview> {
    return httpClient.get<OperatorCrewOverview>('/operator/crew');
  }

  /** Ficha individual. Un tripulante de otra misión responde como inexistente (404). */
  async getCrewMember(astronautId: string): Promise<OperatorCrewDetail> {
    return httpClient.get<OperatorCrewDetail>(`/operator/crew/${astronautId}`);
  }
}

export const operatorService = new OperatorService();
