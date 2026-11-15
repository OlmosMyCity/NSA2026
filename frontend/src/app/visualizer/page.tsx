'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Orbit, Rocket } from 'lucide-react';
import { AppLayout } from '@/components/common/AppLayout';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { MissionTabs } from '@/components/common/MissionTabs';
import { RadiationStatusBanner } from '@/components/radiation/RadiationStatusBanner';
import { useAuth } from '@/context/AuthContext';
import { astronautService } from '@/services/astronautService';
import { missionService } from '@/services/missionService';
import type { Mission } from '@/domain/missions/types';
import { MissionHealthView } from '@/components/visualizer/MissionHealthView';
import { MolecularTwinSection } from '@/components/visualizer/MolecularTwinSection';

export default function VisualizerPage() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const canSelectMissions = isAdmin || user?.role === 'OPERATOR';
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
        if (canSelectMissions) {
          const res = await missionService.list({ limit: 50 });
          if (!alive) return;
          const list = Array.isArray(res.data) ? res.data : [];
          setMissions(list);

          const defaultId =
            list.find((m) => m.status === 'IN_PROGRESS')?.id ?? list[0]?.id ?? '';
          if (alive) setSelectedMissionId((cur) => cur || defaultId);
          return;
        }

        let targetMissionId: string | null | undefined;
        if (user?.astronautId) {
          const astro = await astronautService.getById(user.astronautId).catch(() => null);
          targetMissionId = astro?.missionId;
        } else if (user?.id) {
          const astroRes = await astronautService.list({ limit: 50 }).catch(() => null);
          const own = astroRes?.data.find((a) => a.userId === user.id);
          targetMissionId = own?.missionId;
        }

        if (!alive) return;
        if (targetMissionId) {
          const assigned = await missionService.getById(targetMissionId).catch(() => null);
          if (!alive) return;
          if (assigned) {
            setMissions([assigned]);
            setSelectedMissionId(assigned.id);
            return;
          }
        }

        const fallbackRes = await missionService.list({ limit: 10 }).catch(() => null);
        if (!alive) return;
        const fallbackList = Array.isArray(fallbackRes?.data) ? fallbackRes.data : [];
        setMissions(fallbackList);
        const fallbackId =
          fallbackList.find((m) => m.status === 'IN_PROGRESS')?.id ?? fallbackList[0]?.id ?? '';
        setSelectedMissionId(fallbackId);
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
  }, [isAuthenticated, canSelectMissions, user?.astronautId, user?.id]);

  return (
    <AppLayout>
      <div className="space-y-6 py-4 sm:py-6">
        <MissionTabs />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-line pb-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-berry">
              <Orbit className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Orbital Dynamics &amp; Solar Radiation Countermeasures</span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-blueberry">
              3D Orbit &amp; Radiation Telemetry
            </h1>
            <p className="mt-1.5 text-sm text-stem max-w-2xl">
              Track crewed mission trajectories alongside live NOAA SWPC solar radiation alerts,
              shielding dose rates, and molecular DNA-repair kinetics.
            </p>
          </div>
        </div>

        {/* Live Radiation Engine Telemetry & Countermeasure Matrix */}
        <ErrorBoundary
          fallbackTitle="Solar radiation status temporarily unavailable"
          fallbackDescription="NOAA SWPC space-weather telemetry could not be displayed."
        >
          <div className="overflow-hidden rounded-lg border border-line">
            <RadiationStatusBanner />
          </div>
        </ErrorBoundary>

        <div className="space-y-5">
          {missions.length > 0 && (canSelectMissions || missions.length > 1) ? (
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
              {selectedMissionId && (
                <Link
                  href={`/missions/${selectedMissionId}`}
                  className="text-xs font-semibold text-berry underline underline-offset-4 hover:text-blueberry"
                >
                  Open dedicated mission page
                </Link>
              )}
            </div>
          ) : (
            selectedMissionId && (
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
            )
          )}

          {selectedMissionId ? (
            <ErrorBoundary
              fallbackTitle="3D orbit viewer temporarily unavailable"
              fallbackDescription="An unexpected rendering error occurred in the 3D mission view. Solar telemetry and biophysics remain active."
            >
              <MissionHealthView key={selectedMissionId} missionId={selectedMissionId} />
            </ErrorBoundary>
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

        {/* Radioprotector Docking & DNA Damage/Repair Kinetics */}
        <ErrorBoundary
          fallbackTitle="Molecular radiobiology panel temporarily unavailable"
          fallbackDescription="The 3D molecular complex or DNA repair kinetics view could not be rendered."
        >
          <MolecularTwinSection />
        </ErrorBoundary>
      </div>
    </AppLayout>
  );
}
