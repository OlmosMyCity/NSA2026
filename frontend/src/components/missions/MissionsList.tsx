'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMissions } from '../../hooks/useMissions';
import { Mission, Environment } from '../../domain/missions/types';
import { MissionCard } from './MissionCard';
import { SkeletonCard } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useAuth } from '@/context/AuthContext';
import { astronautService } from '@/services/astronautService';
import { missionService } from '../../services/missionService';
import {
  Rocket,
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Orbit,
  Sparkles,
} from 'lucide-react';

const SAMPLE_MISSIONS = [
  {
    name: 'Apollo 11 — First Lunar Landing',
    description:
      '8-day crewed lunar landing mission (July 16–24, 1969) aboard Saturn V SA-506, CSM Columbia, and LM Eagle with Neil Armstrong, Buzz Aldrin, and Michael Collins touching down at Mare Tranquillitatis.',
    environment: 'LUNAR_BASE' as Environment,
    status: 'IN_PROGRESS' as const,
    daysAgo: 4,
  },
  {
    name: 'ISS Expedition 72 — Low Earth Orbit',
    description:
      'Crewed orbital science aboard the International Space Station at 415 km LEO, 51.64° inclination, and 7.66 km/s (~92.9 min orbital period) with Crew Dragon and Soyuz MS crew rotations.',
    environment: 'STATION' as Environment,
    status: 'IN_PROGRESS' as const,
    daysAgo: 1,
  },
  {
    name: 'Apollo 13 — Cislunar Free-Return Abort',
    description:
      '6-day crewed lunar free-return mission (April 11–17, 1970) with Jim Lovell, Jack Swigert, and Fred Haise rounding the lunar far side at 254 km pericynthion after the O2 tank #2 anomaly.',
    environment: 'SPACECRAFT' as Environment,
    status: 'IN_PROGRESS' as const,
    daysAgo: 3,
  },
  {
    name: 'Apollo 17 — Taurus-Littrow Lunar Expedition',
    description:
      '12.6-day crewed lunar mission (Dec 7–19, 1972) with Gene Cernan, Harrison Schmitt, and Ron Evans conducting 22 h of Lunar Roving Vehicle EVA at Taurus-Littrow Valley.',
    environment: 'ROVER' as Environment,
    status: 'IN_PROGRESS' as const,
    daysAgo: 5,
  },
  {
    name: 'Artemis II — Crewed Lunar Free-Return',
    description:
      '9-day crewed flight test aboard SLS Block 1 and Orion (Integrity) with Reid Wiseman, Victor Glover, Christina Koch, and Jeremy Hansen reaching 6,545 km above the lunar far side.',
    environment: 'SPACECRAFT' as Environment,
    status: 'IN_PROGRESS' as const,
    daysAgo: 4,
  },
  {
    name: 'Apollo 8 — First Crewed Lunar Orbit',
    description:
      '6.1-day historic flight (Dec 21–27, 1968) with Frank Borman, Jim Lovell, and Bill Anders completing 10 lunar orbits at 111 km altitude aboard Saturn V SA-503.',
    environment: 'SPACECRAFT' as Environment,
    status: 'IN_PROGRESS' as const,
    daysAgo: 3,
  },
];

export function MissionsList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const {
    missions,
    pagination,
    filters,
    isLoading,
    error,
    updateFilters,
    deleteMission,
    refetch,
  } = useMissions({ page: 1, limit: 6 });

  const [missionToDelete, setMissionToDelete] = useState<Mission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [assignedMission, setAssignedMission] = useState<Mission | null>(null);
  const [loadingAssigned, setLoadingAssigned] = useState(!isAdmin);

  useEffect(() => {
    if (isAdmin) {
      setLoadingAssigned(false);
      return;
    }
    let alive = true;
    async function loadAssigned() {
      if (!user?.astronautId) {
        if (alive) {
          setAssignedMission(null);
          setLoadingAssigned(false);
        }
        return;
      }
      try {
        const astro = await astronautService.getById(user.astronautId);
        if (!alive) return;
        if (astro.missionId) {
          const m = await missionService.getById(astro.missionId);
          if (alive) setAssignedMission(m);
        } else if (alive) {
          setAssignedMission(null);
        }
      } catch {
        if (alive) setAssignedMission(null);
      } finally {
        if (alive) setLoadingAssigned(false);
      }
    }
    loadAssigned();
    return () => {
      alive = false;
    };
  }, [isAdmin, user?.astronautId]);

  const visibleMissions = isAdmin ? missions : assignedMission ? [assignedMission] : [];
  const effectiveLoading = isAdmin ? isLoading : loadingAssigned;

  const handleCreateSamples = async () => {
    try {
      setIsSeeding(true);
      const existingNames = new Set(missions.map((m) => m.name.toLowerCase()));
      for (const s of SAMPLE_MISSIONS) {
        if (existingNames.has(s.name.toLowerCase())) continue;
        await missionService.create({
          name: s.name,
          description: s.description,
          environment: s.environment,
          status: s.status,
          startDate: new Date(Date.now() - s.daysAgo * 86400000).toISOString(),
        });
      }
      await refetch();
    } catch {
      // ignore
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFilters({ search: e.target.value });
  };

  const handleEnvironmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as Environment | '';
    updateFilters({ environment: value });
  };

  const handleConfirmDelete = async () => {
    if (!missionToDelete) return;
    try {
      setIsDeleting(true);
      await deleteMission(missionToDelete.id);
      setMissionToDelete(null);
    } catch {
      // ignore
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
            {isAdmin ? 'Missions & Habitats' : 'My Assigned Mission'}
          </h1>
          <p className="mt-1.5 text-sm text-stem">
            {isAdmin
              ? 'Active crew habitats and trajectories.'
              : 'Your assigned mission habitat and trajectory telemetry.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <Link
            href="/visualizer"
            className="tactile-press flex items-center gap-2 py-2 text-xs font-semibold text-berry hover:text-blueberry"
          >
            <Orbit className="h-4 w-4" />
            <span>3D Mission Simulation</span>
          </Link>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={handleCreateSamples}
                disabled={isSeeding}
                className="tactile-press flex items-center gap-1.5 rounded-sm border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-blueberry hover:bg-surface-tinted disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-berry" />
                <span>{isSeeding ? 'Creating...' : 'Load Sample Missions'}</span>
              </button>
              <Link
                href="/missions/new"
                className="tactile-press flex items-center gap-2 rounded-sm bg-blueberry px-4 py-2 text-xs font-semibold text-plate hover:bg-berry"
              >
                <Plus className="h-4 w-4" />
                <span>New Mission</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Filter bar — borderless inline inputs (Admin only) */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="relative w-full sm:max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
              <Search className="h-4 w-4 text-stem" />
            </div>
            <input
              type="text"
              value={filters.search || ''}
              onChange={handleSearchChange}
              placeholder="Search by name or description..."
              className="ui-input pl-6 text-xs placeholder-stem/60"
            />
          </div>

          <div className="flex w-full sm:w-auto items-center gap-2">
            <Filter className="h-4 w-4 text-berry flex-shrink-0" />
            <select
              value={filters.environment || ''}
              onChange={handleEnvironmentChange}
              aria-label="Filter by environment"
              className="ui-select w-full sm:w-auto pr-4 text-xs font-medium"
            >
              <option value="">All environments</option>
              <option value="LUNAR_BASE">Lunar Base</option>
              <option value="STATION">Orbital Station</option>
              <option value="ROVER">Lunar Rover</option>
              <option value="SPACECRAFT">Spacecraft</option>
              <option value="MARS_BASE">Mars Base</option>
            </select>
          </div>
        </div>
      )}

      {error && isAdmin && (
        <div className="ui-callout-critical flex items-center justify-between text-xs text-status-critical">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 font-semibold underline"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {effectiveLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: isAdmin ? 6 : 1 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : visibleMissions.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title={isAdmin ? 'No missions found' : 'No mission assigned yet'}
          description={
            isAdmin
              ? 'No registered missions match the current filters.'
              : 'Contact your Flight Surgeon / Admin to be assigned to a mission.'
          }
          actionLabel={isAdmin ? 'Create First Mission' : undefined}
          actionHref={isAdmin ? '/missions/new' : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleMissions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onDeleteRequest={(m) => setMissionToDelete(m)}
            />
          ))}
        </div>
      )}

      {isAdmin && !isLoading && missions.length > 0 && (
        <div className="surface-card flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 text-xs text-stem tabular-nums">
          <div>
            <span>Total: </span>
            <strong className="text-blueberry">{pagination.total}</strong>
            <span> missions · Page </span>
            <strong className="text-blueberry">{pagination.currentPage}</strong>
            <span> of </span>
            <strong className="text-blueberry">{pagination.totalPages}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateFilters({ page: pagination.currentPage - 1 })}
              disabled={pagination.currentPage <= 1}
              className="tactile-press flex items-center gap-1 rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-medium text-blueberry hover:bg-surface-tinted disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              onClick={() => updateFilters({ page: pagination.currentPage + 1 })}
              disabled={pagination.currentPage >= pagination.totalPages}
              className="tactile-press flex items-center gap-1 rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-medium text-blueberry hover:bg-surface-tinted disabled:opacity-40 disabled:pointer-events-none"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!missionToDelete}
        title="Delete Mission"
        message={`Are you sure you want to delete mission "${missionToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setMissionToDelete(null)}
      />
    </div>
  );
}
