'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/common/AppLayout';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { useAuth } from '@/context/AuthContext';
import { astronautService } from '@/services/astronautService';
import { Astronaut } from '@/domain/astronauts/types';
import { routineService } from '@/services/routineService';
import { AstronautRoutineState } from '@/domain/routine/types';
import { StreakBanner } from '@/components/routine/StreakBanner';
import { BadgeGrid } from '@/components/routine/BadgeGrid';
import { RoutineChecklist } from '@/components/routine/RoutineChecklist';
import { Users, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

export default function RoutinePage() {
  const { user } = useAuth();
  const [astronauts, setAstronauts] = useState<Astronaut[]>([]);
  const [selectedAstronautId, setSelectedAstronautId] = useState<string>('');
  const [routineState, setRoutineState] = useState<AstronautRoutineState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    async function loadCrew() {
      try {
        setLoadError(null);
        // ADMIN revisa a cualquier tripulante; un USER solo ve su propia rutina.
        const crew = isAdmin
          ? (await astronautService.list({ limit: 50 })).data
          : user?.astronautId
            ? [await astronautService.getById(user.astronautId)]
            : [];
        setAstronauts(crew);
        const initialId = crew[0]?.id ?? '';
        setSelectedAstronautId(initialId);
        setRoutineState(initialId ? routineService.getRoutineState(initialId) : null);
      } catch (err: unknown) {
        setLoadError(err instanceof Error ? err.message : 'Unable to load the crew list.');
      } finally {
        setIsLoading(false);
      }
    }

    loadCrew();
  }, [user, isAdmin]);

  const handleSelectAstronaut = (astroId: string) => {
    setSelectedAstronautId(astroId);
    setRoutineState(routineService.getRoutineState(astroId));
  };

  const handleToggleTask = (taskId: string) => {
    if (!selectedAstronautId) return;
    const updated = routineService.toggleTask(selectedAstronautId, taskId);
    setRoutineState(updated);
  };

  const currentAstronaut = astronauts.find((a) => a.id === selectedAstronautId);

  return (
    <RouteGuard>
      <AppLayout>
        <div className="space-y-8 py-2">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line pb-5">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
                Daily HRP Countermeasure Routine
              </h1>
              <p className="mt-1.5 text-sm text-stem max-w-2xl">
                Execute prioritized countermeasures, exercise, and circadian protocols.
              </p>
            </div>

            {isAdmin && (
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-stem flex items-center gap-1.5">
                <Users className="h-4 w-4 text-berry" />
                <span>Astronaut:</span>
              </span>
              <select
                value={selectedAstronautId}
                onChange={(e) => handleSelectAstronaut(e.target.value)}
                disabled={isLoading}
                aria-label="Select astronaut"
                className="ui-select w-auto pr-4 text-xs font-medium"
              >
                {astronauts.map((astro) => (
                  <option key={astro.id} value={astro.id}>
                    {astro.name} — {astro.role}
                  </option>
                ))}
              </select>
            </div>
            )}
          </div>

          {loadError ? (
            <p role="alert" className="ui-callout-critical text-sm text-status-critical">
              {loadError}
            </p>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-stem">
              <RefreshCw className="h-7 w-7 animate-spin text-berry mb-3" />
              <p className="text-sm font-medium">Loading crew operational protocol...</p>
            </div>
          ) : !routineState ? (
            <EmptyState
              title="No crew profile linked"
              description="Your account is not linked to a crew member yet. Ask the Flight Surgeon to add you to a mission's crew."
            />
          ) : (
            <div className="space-y-10">
              <div className="surface-card p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-8">
                  <div>
                    <h2 className="text-base font-bold text-blueberry">
                      Daily Operational Checklist
                    </h2>
                    <span className="text-xs text-stem tabular-nums">
                      Mission date: {routineState.date} · Subject:{' '}
                      {currentAstronaut?.name || 'Astronaut'}
                    </span>
                  </div>
                  <span className="ui-badge text-stem">
                    <span className="h-2 w-2 rounded-full bg-stem" aria-hidden="true" />
                    <span>Saved on this device</span>
                  </span>
                </div>

                <RoutineChecklist tasks={routineState.tasks} onToggleTask={handleToggleTask} />
              </div>

              <StreakBanner streakDays={routineState.streakDays} badges={routineState.badges} />

              <BadgeGrid badges={routineState.badges} streakDays={routineState.streakDays} />
            </div>
          )}
        </div>
      </AppLayout>
    </RouteGuard>
  );
}

