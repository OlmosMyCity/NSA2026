import { httpClient } from '@/features/common/services/httpClient';
import type { Astronaut, AstronautFilters, CreateAstronautInput, PaginatedAstronauts, UpdateAstronautInput } from '../domain/types';

/** En modo mock, httpClient responde con el backend simulado (features/common/mocks). */
export const astronautService = {
  list: ({ page = 1, limit = 6, ...filters }: AstronautFilters = {}) =>
    httpClient.get<PaginatedAstronauts>('/astronauts', { params: { page, limit, ...filters } }),

  getById: (id: string) => httpClient.get<Astronaut>(`/astronauts/${id}`),

  create: (input: CreateAstronautInput) => httpClient.post<Astronaut>('/astronauts', input),

  update: (id: string, input: UpdateAstronautInput) => httpClient.put<Astronaut>(`/astronauts/${id}`, input),

  delete: async (id: string): Promise<void> => {
    await httpClient.delete(`/astronauts/${id}`);
  },
};
