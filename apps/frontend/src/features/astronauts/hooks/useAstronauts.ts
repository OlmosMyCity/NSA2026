'use client';

import { usePaginatedList } from '@/features/common/hooks/usePaginatedList';
import { astronautService } from '../services/astronautService';
import type { AstronautFilters } from '../domain/types';

export function useAstronauts(initialFilters: AstronautFilters = { page: 1, limit: 6 }) {
  const { items, refetch, ...list } = usePaginatedList(astronautService.list, initialFilters, 'Failed to load crew directory.');

  const deleteAstronaut = async (id: string) => {
    await astronautService.delete(id);
    await refetch();
  };

  return { astronauts: items, refetch, deleteAstronaut, ...list };
}
