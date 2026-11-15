import { httpClient } from '@/features/common/services/httpClient';
import type { CreateMissionInput, Mission, MissionFilters, PaginatedMissions, UpdateMissionInput } from '../domain/types';

/** En modo mock, httpClient responde con el backend simulado (features/common/mocks). */
export const missionService = {
  list: ({ page = 1, limit = 6, ...filters }: MissionFilters = {}) =>
    httpClient.get<PaginatedMissions>('/missions', { params: { page, limit, ...filters } }),

  getById: (id: string) => httpClient.get<Mission>(`/missions/${id}`),

  create: (input: CreateMissionInput) => httpClient.post<Mission>('/missions', input),

  update: (id: string, input: UpdateMissionInput) => httpClient.put<Mission>(`/missions/${id}`, input),

  delete: async (id: string): Promise<void> => {
    await httpClient.delete(`/missions/${id}`);
  },
};
