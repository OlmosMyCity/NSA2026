'use client';

import { usePaginatedList } from '@/features/common/hooks/usePaginatedList';
import { missionService } from '../services/missionService';
import type { MissionFilters } from '../domain/types';

export function useMissions(initialFilters: MissionFilters = { page: 1, limit: 6 }) {
  const { items, refetch, ...list } = usePaginatedList(missionService.list, initialFilters, 'Failed to load mission registry.');

  const deleteMission = async (id: string) => {
    await missionService.delete(id);
    await refetch();
  };

  return { missions: items, refetch, deleteMission, ...list };
}
