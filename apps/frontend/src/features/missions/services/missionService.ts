/**
 * Service layer for space mission CRUD operations and paginated filtering.
 * Routes operations to `mockDb` when `ENV.USE_MOCKS` is enabled or `/missions` via `httpClient`.
 *
 * @module features/missions/services/missionService
 */

import { ENV } from '@/features/common/config/env';
import { httpClient } from '@/features/common/services/httpClient';
import { mockDb, MockMission } from '@/features/common/mocks/mockDb';
import {
  Mission,
  PaginatedMissions,
  MissionFilters,
  CreateMissionInput,
  UpdateMissionInput,
} from '../domain/types';

class MissionService {
  /** Lists active missions filtered by environment, lifecycle status, and search query. */
  async list(filters: MissionFilters = {}): Promise<PaginatedMissions> {
    const page = filters.page || 1;
    const limit = filters.limit || 6;

    if (ENV.USE_MOCKS) {
      let filtered = mockDb.missions.filter((m) => !m.deletedAt);

      if (filters.environment) {
        filtered = filtered.filter((m) => m.environment === filters.environment);
      }

      if (filters.status) {
        filtered = filtered.filter((m) => m.status === filters.status);
      }

      if (filters.search && filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        filtered = filtered.filter(
          (m) => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
        );
      }

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const startIndex = (page - 1) * limit;
      const paginatedData = filtered.slice(startIndex, startIndex + limit);

      return {
        data: paginatedData as Mission[],
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
    if (filters.environment) params.environment = filters.environment;
    if (filters.status) params.status = filters.status;
    if (filters.search) params.search = filters.search;

    return httpClient.get<PaginatedMissions>('/missions', { params });
  }

  async getById(id: string): Promise<Mission> {
    if (ENV.USE_MOCKS) {
      const mission = mockDb.missions.find((m) => m.id === id && !m.deletedAt);
      if (!mission) throw new Error('Mission not found in the orbital registry.');
      return mission as Mission;
    }

    return httpClient.get<Mission>(`/missions/${id}`);
  }

  async create(input: CreateMissionInput): Promise<Mission> {
    if (ENV.USE_MOCKS) {
      const newMission: MockMission = {
        id: `mission-${Date.now()}`,
        name: input.name,
        description: input.description,
        environment: input.environment,
        status: input.status,
        startDate: input.startDate,
        endDate: input.endDate || null,
        patchUrl: input.patchUrl || null,
        createdById: 'user-admin-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockDb.missions.unshift(newMission);
      mockDb.save();
      return newMission as Mission;
    }

    return httpClient.post<Mission>('/missions', input);
  }

  async update(id: string, input: UpdateMissionInput): Promise<Mission> {
    if (ENV.USE_MOCKS) {
      const idx = mockDb.missions.findIndex((m) => m.id === id && !m.deletedAt);
      if (idx === -1) throw new Error('Mission not found.');
      const updated = {
        ...mockDb.missions[idx],
        ...input,
        updatedAt: new Date().toISOString(),
      };
      mockDb.missions[idx] = updated;
      mockDb.save();
      return updated as Mission;
    }

    return httpClient.put<Mission>(`/missions/${id}`, input);
  }

  async delete(id: string): Promise<void> {
    if (ENV.USE_MOCKS) {
      const mission = mockDb.missions.find((m) => m.id === id);
      if (mission) {
        mission.deletedAt = new Date().toISOString();
        mockDb.save();
      }
      return;
    }

    await httpClient.delete(`/missions/${id}`);
  }
}

export const missionService = new MissionService();

