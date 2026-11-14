'use client';

import { useState, useEffect, useCallback } from 'react';
import { astronautService } from '../services/astronautService';
import { Astronaut, AstronautFilters, PaginationMeta } from '../domain/types';

export function useAstronauts(initialFilters: AstronautFilters = { page: 1, limit: 6 }) {
  const [astronauts, setAstronauts] = useState<Astronaut[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    currentPage: 1,
    limit: 6,
    totalPages: 1,
  });
  const [filters, setFilters] = useState<AstronautFilters>(initialFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAstronauts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await astronautService.list(filters);
      setAstronauts(res.data);
      setPagination(res.pagination);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load crew directory.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAstronauts();
  }, [fetchAstronauts]);

  const updateFilters = (newFilters: Partial<AstronautFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: newFilters.page !== undefined ? newFilters.page : 1,
    }));
  };

  const deleteAstronaut = async (id: string) => {
    await astronautService.delete(id);
    await fetchAstronauts();
  };

  return {
    astronauts,
    pagination,
    filters,
    isLoading,
    error,
    updateFilters,
    deleteAstronaut,
    refetch: fetchAstronauts,
  };
}

