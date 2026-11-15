import { httpClient } from '@/services/httpClient';
import type { CrewLocation } from '@/domain/operator/types';
import type {
  Astronaut,
  AstronautFilters,
  CreateAstronautInput,
  FaceBiometricSample,
  MissionBiometricProfile,
  PaginatedAstronauts,
  UpdateAstronautInput,
} from '../domain/astronauts/types';

/** En modo mock, httpClient responde con el backend simulado (src/mocks). */
export const astronautService = {
  list: ({ page = 1, limit = 6, ...filters }: AstronautFilters = {}) =>
    httpClient.get<PaginatedAstronauts>('/astronauts', { params: { page, limit, ...filters } }),

  getById: (id: string) => httpClient.get<Astronaut>(`/astronauts/${id}`),

  create: (input: CreateAstronautInput) => httpClient.post<Astronaut>('/astronauts', input),

  update: (id: string, input: UpdateAstronautInput) => httpClient.put<Astronaut>(`/astronauts/${id}`, input),

  delete: async (id: string): Promise<void> => {
    await httpClient.delete(`/astronauts/${id}`);
  },

  /** Ubicación actual: solo el propio tripulante o el Flight Surgeon (ruta autenticada). */
  getLocation: async (id: string): Promise<CrewLocation | null> => {
    const res = await httpClient.get<{ currentLocation: CrewLocation | null }>(`/astronauts/${id}/location`);
    return res.currentLocation;
  },

  updateLocation: async (id: string, location: CrewLocation): Promise<void> => {
    await httpClient.patch(`/astronauts/${id}/location`, { location });
  },

  listBiometrics: async (astronautId: string): Promise<FaceBiometricSample[]> => {
    const res = await httpClient.get<{ data: FaceBiometricSample[] }>(`/astronauts/${astronautId}/biometrics`);
    return res.data;
  },

  getBiometricGallery: async (missionId?: string): Promise<MissionBiometricProfile[]> => {
    const params: Record<string, string> = {};
    if (missionId) params.missionId = missionId;
    const res = await httpClient.get<{ data: MissionBiometricProfile[] }>('/astronauts/biometrics/gallery', {
      params,
    });
    return res.data;
  },

  enrollBiometric: (
    astronautId: string,
    input: { imageUrl: string; label?: string; embedding: number[]; qualityScore?: number }
  ) => httpClient.post<FaceBiometricSample>(`/astronauts/${astronautId}/biometrics`, input),

  deleteBiometric: async (astronautId: string, sampleId: string): Promise<void> => {
    await httpClient.delete(`/astronauts/${astronautId}/biometrics/${sampleId}`);
  },
};
