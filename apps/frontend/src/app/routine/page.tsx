'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/features/common/components/AppLayout';
import { RouteGuard } from '@/features/auth/components/RouteGuard';
import { useAuth } from '@/features/auth/context/AuthContext';
import { astronautService } from '@/features/astronauts/services/astronautService';
import { Astronaut } from '@/features/astronauts/domain/types';
import { routineService } from '@/features/routine/services/routineService';
import { AstronautRoutineState } from '@/features/routine/domain/types';
import { StreakBanner } from '@/features/routine/components/StreakBanner';
import { BadgeGrid } from '@/features/routine/components/BadgeGrid';
import { RoutineChecklist } from '@/features/routine/components/RoutineChecklist';
import { SignalNoisePanel } from '@/features/health/components/SignalNoisePanel';
import { Users, RefreshCw } from 'lucide-react';

export default function RoutinePage() {
  const { user } = useAuth();
  const [astronauts, setAstronauts] = useState<Astronaut[]>([]);
  const [selectedAstronautId, setSelectedAstronautId] = useState<string>('');
  const [routineState, setRoutineState] = useState<AstronautRoutineState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadCrew() {
      try {
        const res = await astronautService.list({ limit: 50 });
        setAstronauts(res.data);

        if (res.data.length > 0) {
          const matched = res.data.find((a) =>
            a.name.toLowerCase().includes(user?.name?.toLowerCase() || ''),
          );
          const initialId = matched ? matched.id : res.data[0].id;
          setSelectedAstronautId(initialId);
          setRoutineState(routineService.getRoutineState(initialId));
        }
      } catch (err) {
        console.error('Error loading astronauts for routine:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadCrew();
  }, [user]);

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
                Resistive exercise plan, biomedical telemetry, and deep-space risk mitigation.
              </p>
            </div>

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
          </div>

          {isLoading || !routineState ? (
            <div className="flex flex-col items-center justify-center py-20 text-stem">
              <RefreshCw className="h-7 w-7 animate-spin text-berry mb-3" />
              <p className="text-sm font-medium">Loading crew operational protocol...</p>
            </div>
          ) : (
            <div className="space-y-10">
              <StreakBanner streakDays={routineState.streakDays} badges={routineState.badges} />

              <BadgeGrid badges={routineState.badges} streakDays={routineState.streakDays} />

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
                  <span className="ui-badge text-status-nominal">
                    <span className="h-2 w-2 rounded-full bg-status-nominal" aria-hidden="true" />
                    <span>Live sync active</span>
                  </span>
                </div>

                <RoutineChecklist tasks={routineState.tasks} onToggleTask={handleToggleTask} />
              </div>

              <SignalNoisePanel astronautId={selectedAstronautId || undefined} />
            </div>
          )}
        </div>
      </AppLayout>
    </RouteGuard>
  );
}

