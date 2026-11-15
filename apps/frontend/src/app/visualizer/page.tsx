'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rocket } from 'lucide-react';
import { AppLayout } from '@/features/common/components/AppLayout';
import { useAuth } from '@/features/auth/context/AuthContext';
import { astronautService } from '@/features/astronauts/services/astronautService';
import { missionService } from '@/features/missions/services/missionService';
import type { Mission } from '@/features/missions/domain/types';
import { MissionHealthView } from '@/features/visualizer/components/MissionHealthView';

export default function VisualizerPage() {
  const { user, isAuthenticated } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');
  const [loadingMissions, setLoadingMissions] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!isAuthenticated) {
        if (alive) setLoadingMissions(false);
        return;
      }
      try {
        const res = await missionService.list({ limit: 50 });
        if (!alive) return;
        const list = res.data;
        setMissions(list);

        let defaultId =
          list.find((m) => m.status === 'IN_PROGRESS')?.id ?? list[0]?.id ?? '';

        if (user?.astronautId) {
          try {
            const astro = await astronautService.getById(user.astronautId);
            if (alive && astro.missionId && list.some((m) => m.id === astro.missionId)) {
              defaultId = astro.missionId;
            }
          } catch {
            // Keep active/first mission fallback
          }
        }

        if (alive) setSelectedMissionId((cur) => cur || defaultId);
      } catch {
        // Fallback if missions cannot be fetched
      } finally {
        if (alive) setLoadingMissions(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [isAuthenticated, user?.astronautId]);

  return (
    <AppLayout>
      <div className="py-6 sm:py-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-line pb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
              3D Mission Trajectory Visualizer
            </h1>
            <p className="mt-1.5 text-sm text-stem max-w-2xl">
              Track any crewed mission&apos;s live elapsed-time moment across Earth LEO and cislunar
              space.
            </p>
          </div>
        </div>

        <div className="space-y-5">
            {missions.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-stem">Mission:</span>
                  {missions.map((m) => {
                    const active = m.id === selectedMissionId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMissionId(m.id)}
                        className={`tactile-press rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'bg-blueberry text-white shadow-sm'
                            : 'border border-line bg-surface text-stem hover:text-blueberry'
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
                <Link
                  href={`/missions/${selectedMissionId}`}
                  className="text-xs font-semibold text-berry underline underline-offset-4 hover:text-blueberry"
                >
                  Open dedicated mission page
                </Link>
              </div>
            )}

            {selectedMissionId ? (
              <MissionHealthView missionId={selectedMissionId} />
            ) : loadingMissions ? (
              <div className="surface-card p-8 text-center text-sm text-stem">
                Loading active mission simulation…
              </div>
            ) : (
              <div className="surface-card p-8 text-center space-y-3">
                <p className="text-sm text-blueberry font-medium">
                  Sign in or create a mission to start.
                </p>
                <Link
                  href="/missions/new"
                  className="tactile-press inline-flex items-center gap-1.5 rounded-pill bg-blueberry px-4 py-2 text-xs font-semibold text-white"
                >
                  <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Create a Mission</span>
                </Link>
              </div>
            )}
          </div>
      </div>
    </AppLayout>
  );
}
