'use client';

import { useState } from 'react';
import type { Paginated, PaginationMeta } from '../domain/common/pagination';
import { useAsync } from './useAsync';

const EMPTY_PAGINATION: PaginationMeta = { total: 0, currentPage: 1, limit: 6, totalPages: 1 };

/** Listado paginado con filtros: cambiar cualquier filtro distinto de `page` vuelve a la página 1. */
export function usePaginatedList<T, F extends { page?: number }>(
  list: (filters: F) => Promise<Paginated<T>>,
  initialFilters: F,
  fallbackError: string,
) {
  const [filters, setFilters] = useState<F>(initialFilters);
  const { data, error, isLoading, refetch } = useAsync(() => list(filters), [filters], fallbackError);

  const updateFilters = (changes: Partial<F>) =>
    setFilters((prev) => ({ ...prev, ...changes, page: changes.page ?? 1 }));

  return {
    items: data?.data ?? [],
    pagination: data?.pagination ?? EMPTY_PAGINATION,
    filters,
    isLoading,
    error,
    updateFilters,
    refetch,
  };
}
