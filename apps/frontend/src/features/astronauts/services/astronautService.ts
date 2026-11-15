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
} from '../domain/types';

class AstronautService {
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

      // Asociar nombre de misión
      const withMission = filtered.map((a) => {
        const mission = mockDb.missions.find((m) => m.id === a.missionId);
        return {
          ...a,
          mission: mission ? { id: mission.id, name: mission.name } : undefined,
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
}

export const astronautService = new AstronautService();

