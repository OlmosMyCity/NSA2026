'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAstronauts } from '../hooks/useAstronauts';
import { Astronaut } from '../domain/types';
import { AstronautCard } from './AstronautCard';
import { SkeletonCard } from '@/features/common/components/Skeleton';
import { EmptyState } from '@/features/common/components/EmptyState';
import { ConfirmModal } from '@/features/common/components/ConfirmModal';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  Users,
  Search,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export function AstronautsList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const {
    astronauts,
    pagination,
    filters,
    isLoading,
    error,
    updateFilters,
    deleteAstronaut,
    refetch,
  } = useAstronauts({ page: 1, limit: 6 });

  const [astronautToDelete, setAstronautToDelete] = useState<Astronaut | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFilters({ search: e.target.value });
  };

  const handleConfirmDelete = async () => {
    if (!astronautToDelete) return;
    try {
      setIsDeleting(true);
      await deleteAstronaut(astronautToDelete.id);
      setAstronautToDelete(null);
    } catch {
      // Handled by service
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
            Flight Crew
          </h1>
          <p className="mt-1.5 text-sm text-stem max-w-2xl">
            Astronauts assigned to lunar exploration missions and continuous biomedical monitoring.
          </p>
        </div>

        {isAdmin && (
          <Link
            href="/astronauts/new"
            className="tactile-press inline-flex items-center gap-2 rounded-sm bg-blueberry px-5 py-2.5 text-xs font-semibold text-plate hover:bg-berry self-start md:self-auto"
          >
            <UserPlus className="h-4 w-4" />
            <span>Register Astronaut</span>
          </Link>
        )}
      </div>

      {/* Search bar — flat underline input */}
      <div className="relative w-full sm:max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
          <Search className="h-4 w-4 text-stem" />
        </div>
        <input
          type="text"
          value={filters.search || ''}
          onChange={handleSearchChange}
          placeholder="Search by name or operational role..."
          aria-label="Search crew members by name or operational role"
          className="ui-input pl-6 text-sm placeholder:text-stem/70"
        />
      </div>

      {/* Error banner with retry */}
      {error && (
        <div
          role="alert"
          className="ui-callout-critical flex items-center justify-between gap-4 text-xs text-status-critical"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="tactile-press inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Crew grid or skeletons */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : astronauts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No astronauts found"
          description="No crew members match your current search in the mission directory."
          actionLabel={isAdmin ? 'Register First Astronaut' : 'Clear Search'}
          actionHref={isAdmin ? '/astronauts/new' : undefined}
          onActionClick={!isAdmin ? () => updateFilters({ search: '', page: 1 }) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {astronauts.map((astronaut) => (
            <AstronautCard
              key={astronaut.id}
              astronaut={astronaut}
              onDeleteRequest={(a) => setAstronautToDelete(a)}
            />
          ))}
        </div>
      )}

      {!isLoading && astronauts.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-stem">
          <div className="tabular-nums">
            <span>Total: </span>
            <strong className="font-semibold text-blueberry">{pagination.total}</strong>
            <span> astronauts · Page </span>
            <strong className="font-semibold text-blueberry">{pagination.currentPage}</strong>
            <span> of </span>
            <strong className="font-semibold text-blueberry">{pagination.totalPages}</strong>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => updateFilters({ page: pagination.currentPage - 1 })}
              disabled={pagination.currentPage <= 1}
              className="tactile-press flex items-center gap-1 py-1 text-xs font-medium text-blueberry hover:text-berry disabled:opacity-35 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              onClick={() => updateFilters({ page: pagination.currentPage + 1 })}
              disabled={pagination.currentPage >= pagination.totalPages}
              className="tactile-press flex items-center gap-1 py-1 text-xs font-medium text-blueberry hover:text-berry disabled:opacity-35 disabled:pointer-events-none"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!astronautToDelete}
        title="Remove crew member"
        message={`Are you sure you want to remove "${astronautToDelete?.name}" from the active mission directory?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setAstronautToDelete(null)}
      />
    </div>
  );
}
