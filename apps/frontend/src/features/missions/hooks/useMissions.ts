'use client';

import { useState, useEffect, useCallback } from 'react';
import { missionService } from '../services/missionService';
import { Mission, MissionFilters, PaginationMeta } from '../domain/types';

/**
 * React hook managing paginated mission registry queries, filter state, and
 * soft-delete actions via `missionService`.
 */
export function useMissions(initialFilters: MissionFilters = { page: 1, limit: 6 }) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    currentPage: 1,
    limit: 6,
    totalPages: 1,
  });
  const [filters, setFilters] = useState<MissionFilters>(initialFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await missionService.list(filters);
      setMissions(res.data);
      setPagination(res.pagination);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load mission registry.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  const updateFilters = (newFilters: Partial<MissionFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      // Reset to page 1 whenever search or environment filters change
      page: newFilters.page !== undefined ? newFilters.page : 1,
    }));
  };

  const deleteMission = async (id: string) => {
    await missionService.delete(id);
    await fetchMissions();
  };

  return {
    missions,
    pagination,
    filters,
    isLoading,
    error,
    updateFilters,
    deleteMission,
    refetch: fetchMissions,
  };
}

