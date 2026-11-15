'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rocket } from 'lucide-react';
import { AppLayout } from '@/components/common/AppLayout';
import { useAuth } from '@/context/AuthContext';
import { astronautService } from '@/services/astronautService';
import { missionService } from '@/services/missionService';
import type { Mission } from '@/domain/missions/types';
import { MissionHealthView } from '@/components/visualizer/MissionHealthView';

export default function VisualizerPage() {
  const { user, isAuthenticated, isAdmin } = useAuth();
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
        if (isAdmin) {
          const res = await missionService.list({ limit: 50 });
          if (!alive) return;
          const list = res.data;
          setMissions(list);

          const defaultId =
            list.find((m) => m.status === 'IN_PROGRESS')?.id ?? list[0]?.id ?? '';
          if (alive) setSelectedMissionId((cur) => cur || defaultId);
        } else if (user?.astronautId) {
          const astro = await astronautService.getById(user.astronautId);
          if (!alive) return;
          if (astro.missionId) {
            const assigned = await missionService.getById(astro.missionId);
            if (!alive) return;
            setMissions([assigned]);
            setSelectedMissionId(assigned.id);
          } else {
            setMissions([]);
            setSelectedMissionId('');
          }
        } else {
          setMissions([]);
          setSelectedMissionId('');
        }
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
  }, [isAuthenticated, isAdmin, user?.astronautId]);

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
            {isAdmin && missions.length > 0 && (
              <div className="surface-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <label className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-stem">
                  <span>Mission:</span>
                  <select
                    aria-label="Select mission"
                    value={selectedMissionId}
                    onChange={(e) => setSelectedMissionId(e.target.value)}
                    className="rounded-pill border border-line bg-surface-tinted px-3.5 py-1.5 text-xs font-semibold text-blueberry"
                  >
                    {missions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Link
                  href={`/missions/${selectedMissionId}`}
                  className="text-xs font-semibold text-berry underline underline-offset-4 hover:text-blueberry"
                >
                  Open dedicated mission page
                </Link>
              </div>
            )}

            {!isAdmin && selectedMissionId && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1 text-xs font-semibold text-stem">
                  <Rocket className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
                  Assigned Mission
                </span>
                <Link
                  href={`/missions/${selectedMissionId}`}
                  className="text-xs font-semibold text-berry underline underline-offset-4 hover:text-blueberry"
                >
                  Open dedicated mission page
                </Link>
              </div>
            )}

            {selectedMissionId ? (
              <MissionHealthView key={selectedMissionId} missionId={selectedMissionId} />
            ) : loadingMissions ? (
              <div className="surface-card p-8 text-center text-sm text-stem">
                Loading active mission simulation…
              </div>
            ) : (
              <div className="surface-card p-8 text-center space-y-3">
                <p className="text-sm text-blueberry font-medium">
                  {isAdmin
                    ? 'Sign in or create a mission to start.'
                    : 'No mission assigned yet. Contact your Flight Surgeon / Admin to be assigned to a mission.'}
                </p>
                {isAdmin && (
                  <Link
                    href="/missions/new"
                    className="tactile-press inline-flex items-center gap-1.5 rounded-pill bg-blueberry px-4 py-2 text-xs font-semibold text-white"
                  >
                    <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Create a Mission</span>
                  </Link>
                )}
              </div>
            )}
          </div>
      </div>
    </AppLayout>
  );
}
