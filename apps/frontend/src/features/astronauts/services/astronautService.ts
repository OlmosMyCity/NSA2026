/**
 * Service layer for astronaut roster CRUD operations and pagination.
 * Switches transparently between the local `mockDb` store and the REST API
 * based on `ENV.USE_MOCKS`.
 *
 * @module features/astronauts/services/astronautService
 */

import { ENV } from '@/features/common/config/env';
import type { CrewLocation } from '@/features/operator/domain/types';
import { httpClient } from '@/features/common/services/httpClient';
import { mockDb, MockAstronaut } from '@/features/common/mocks/mockDb';
import {
  Astronaut,
  PaginatedAstronauts,
  AstronautFilters,
  CreateAstronautInput,
  UpdateAstronautInput,
  FaceBiometricSample,
  MissionBiometricProfile,
} from '../domain/types';

class AstronautService {
  /** Lists active (non-deleted) astronauts with optional mission, search, and page filters. */
  async list(filters: AstronautFilters = {}): Promise<PaginatedAstronauts> {
    const page = filters.page || 1;
    const limit = filters.limit || 6;

    if (ENV.USE_MOCKS) {
      let filtered = mockDb.astronauts.filter((a) => !a.deletedAt);

      if (filters.missionId) {
        filtered = filtered.filter((a) => a.missionId === filters.missionId);
      }

      if (filters.search && filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        filtered = filtered.filter(
          (a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)
        );
      }

      // Attach parent mission name and biometric sample count
      const withMission = filtered.map((a) => {
        const mission = mockDb.missions.find((m) => m.id === a.missionId);
        const faceSamplesCount = mockDb.faceSamples.filter((s) => s.astronautId === a.id).length;
        return {
          ...a,
          mission: mission ? { id: mission.id, name: mission.name } : undefined,
          _count: { faceSamples: faceSamplesCount },
        };
      });

      const total = withMission.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const startIndex = (page - 1) * limit;
      const paginatedData = withMission.slice(startIndex, startIndex + limit);

      return {
        data: paginatedData as Astronaut[],
        pagination: {
          total,
          currentPage: page,
          limit,
          totalPages,
        },
      };
    }

    const params: Record<string, string | number> = {
      page,
      limit,
    };
    if (filters.missionId) params.missionId = filters.missionId;
    if (filters.search) params.search = filters.search;

    return httpClient.get<PaginatedAstronauts>('/astronauts', { params });
  }

  async getById(id: string): Promise<Astronaut> {
    if (ENV.USE_MOCKS) {
      const astronaut = mockDb.astronauts.find((a) => a.id === id && !a.deletedAt);
      if (!astronaut) throw new Error('Astronaut not found in active crew.');
      const mission = mockDb.missions.find((m) => m.id === astronaut.missionId);
      return {
        ...astronaut,
        mission: mission ? { id: mission.id, name: mission.name } : undefined,
      } as Astronaut;
    }

    return httpClient.get<Astronaut>(`/astronauts/${id}`);
  }

  async create(input: CreateAstronautInput): Promise<Astronaut> {
    if (ENV.USE_MOCKS) {
      const newAstronaut: MockAstronaut = {
        id: `astro-${Date.now()}`,
        name: input.name.trim(),
        role: input.role.trim(),
        age: input.age,
        missionId: input.missionId,
        userId: input.userId || null,
        photoUrl: input.photoUrl || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockDb.astronauts.unshift(newAstronaut);
      mockDb.save();
      return newAstronaut as Astronaut;
    }

    return httpClient.post<Astronaut>('/astronauts', input);
  }

  async update(id: string, input: UpdateAstronautInput): Promise<Astronaut> {
    if (ENV.USE_MOCKS) {
      const idx = mockDb.astronauts.findIndex((a) => a.id === id && !a.deletedAt);
      if (idx === -1) throw new Error('Astronaut not found.');
      const updated = {
        ...mockDb.astronauts[idx],
        ...input,
        updatedAt: new Date().toISOString(),
      };
      mockDb.astronauts[idx] = updated;
      mockDb.save();
      return updated as Astronaut;
    }

    return httpClient.put<Astronaut>(`/astronauts/${id}`, input);
  }

  /** La ubicación no viaja en las rutas públicas de astronautas: se consulta con sesión. */
  async getLocation(id: string): Promise<CrewLocation | null> {
    if (ENV.USE_MOCKS) {
      const astronaut = mockDb.astronauts.find((a) => a.id === id && !a.deletedAt);
      return (astronaut?.currentLocation as CrewLocation | undefined) ?? null;
    }

    const res = await httpClient.get<{ currentLocation: CrewLocation | null }>(`/astronauts/${id}/location`);
    return res.currentLocation;
  }

  /** El tripulante (o el cirujano de vuelo) declara dónde se encuentra. */
  async updateLocation(id: string, location: CrewLocation): Promise<void> {
    if (ENV.USE_MOCKS) {
      const astronaut = mockDb.astronauts.find((a) => a.id === id && !a.deletedAt);
      if (!astronaut) throw new Error('Astronaut not found.');
      astronaut.currentLocation = location;
      astronaut.locationUpdatedAt = new Date().toISOString();
      mockDb.save();
      return;
    }

    await httpClient.patch(`/astronauts/${id}/location`, { location });
  }

  async delete(id: string): Promise<void> {
    if (ENV.USE_MOCKS) {
      const astronaut = mockDb.astronauts.find((a) => a.id === id);
      if (astronaut) {
        astronaut.deletedAt = new Date().toISOString();
        mockDb.save();
      }
      return;
    }

    await httpClient.delete(`/astronauts/${id}`);
  }

  async listBiometrics(astronautId: string): Promise<FaceBiometricSample[]> {
    if (ENV.USE_MOCKS) {
      return mockDb.faceSamples.filter((s) => s.astronautId === astronautId);
    }
    const res = await httpClient.get<{ data: FaceBiometricSample[] }>(`/astronauts/${astronautId}/biometrics`);
    return res.data;
  }

  async getBiometricGallery(missionId?: string): Promise<MissionBiometricProfile[]> {
    if (ENV.USE_MOCKS) {
      const astros = mockDb.astronauts.filter(
        (a) => !a.deletedAt && (!missionId || a.missionId === missionId)
      );
      return astros.map((a) => {
        const samples = mockDb.faceSamples.filter((s) => s.astronautId === a.id);
        return {
          astronautId: a.id,
          astronautName: a.name,
          role: a.role,
          missionId: a.missionId,
          photoUrl: a.photoUrl ?? null,
          sampleCount: samples.length,
          embeddings: samples.map((s) => s.embedding),
        };
      });
    }
    const params: Record<string, string> = {};
    if (missionId) params.missionId = missionId;
    const res = await httpClient.get<{ data: MissionBiometricProfile[] }>('/astronauts/biometrics/gallery', {
      params,
    });
    return res.data;
  }

  async enrollBiometric(
    astronautId: string,
    input: { imageUrl: string; label?: string; embedding: number[]; qualityScore?: number }
  ): Promise<FaceBiometricSample> {
    if (ENV.USE_MOCKS) {
      const existing = mockDb.faceSamples.filter((s) => s.astronautId === astronautId);
      if (existing.length >= 5) {
        throw new Error('Maximum of 5 facial biometric samples per crew member reached.');
      }
      const created: FaceBiometricSample = {
        id: `face-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        astronautId,
        imageUrl: input.imageUrl,
        label: input.label || `Sample #${existing.length + 1}`,
        embedding: input.embedding,
        qualityScore: input.qualityScore ?? 92,
        uploadedById: null,
        createdAt: new Date().toISOString(),
      };
      mockDb.faceSamples.push(created);
      const astro = mockDb.astronauts.find((a) => a.id === astronautId);
      if (astro && !astro.photoUrl) {
        astro.photoUrl = input.imageUrl;
      }
      mockDb.save();
      return created;
    }

    return httpClient.post<FaceBiometricSample>(`/astronauts/${astronautId}/biometrics`, input);
  }

  async deleteBiometric(astronautId: string, sampleId: string): Promise<void> {
    if (ENV.USE_MOCKS) {
      mockDb.faceSamples = mockDb.faceSamples.filter(
        (s) => !(s.astronautId === astronautId && s.id === sampleId)
      );
      mockDb.save();
      return;
    }

    await httpClient.delete(`/astronauts/${astronautId}/biometrics/${sampleId}`);
  }
}

export const astronautService = new AstronautService();

