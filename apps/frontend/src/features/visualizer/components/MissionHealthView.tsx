'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Maximize2, Pause, Play } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { AccessDenied } from '@/features/auth/components/AccessDenied';
import { Skeleton } from '@/features/common/components/Skeleton';
import { astronautService } from '@/features/astronauts/services/astronautService';
import type { Astronaut } from '@/features/astronauts/domain/types';
import { missionService } from '@/features/missions/services/missionService';
import type { Mission } from '@/features/missions/domain/types';
import { useHealthReadings } from '@/features/health/hooks/useHealthReadings';
import { metOf, phaseAt, readingAt, readingsOnTimeline } from '../domain/missionClock';
import { trajectoryUrl } from '../domain/trajectories';
import { useViewerBridge } from '../hooks/useViewerBridge';
import { MissionMomentPanel } from './MissionMomentPanel';
import { MissionTimeline } from './MissionTimeline';

const STATUS_LABEL: Record<Mission['status'], string> = {
  PLANNING: 'Planned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export function MissionHealthView({ missionId }: { missionId: string }) {
  const { user, isAdmin } = useAuth();
  const [mission, setMission] = useState<Mission | null>(null);
  const [crew, setCrew] = useState<Astronaut[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [astronautId, setAstronautId] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    Promise.all([missionService.getById(missionId), astronautService.list({ missionId, limit: 50 })])
      .then(([m, c]) => {
        if (!alive) return;
        setMission(m);
        setCrew(c.data);
      })
      .catch(
        (err: unknown) =>
          alive && setLoadError(err instanceof Error ? err.message : 'Unable to load mission.')
      );
    return () => {
      alive = false;
    };
  }, [missionId]);

  const isCrewMember = !!user?.astronautId && crew.some((a) => a.id === user.astronautId);
  const canView = isAdmin || isCrewMember;
  useEffect(() => {
    if (!crew.length) return;
    setAstronautId((cur) => cur ?? (isAdmin ? crew[0].id : user?.astronautId));
  }, [crew, isAdmin, user?.astronautId]);

  const { rows, isLoading: readingsLoading } = useHealthReadings(canView ? astronautId : undefined);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const viewerSrc = trajectoryUrl(missionId);
  const { ready, time, seek, play, pause } = useViewerBridge(frameRef);

  const now = Date.now();
  const nowMetRaw = mission ? metOf(new Date(now).toISOString(), mission.startDate) : 0;
  const tEnd = ready?.tEnd ?? Infinity;
  const nowMet = Math.min(Math.max(nowMetRaw, 0), tEnd);

  const phases = ready?.phases ?? [];
  const items = useMemo(
    () => (mission ? readingsOnTimeline(rows, mission.startDate, phases) : []),
    [rows, mission, phases]
  );

  const [pinnedMet, setPinnedMet] = useState<number | null>(null);
  useEffect(() => {
    if (time && time.t > 1) setPinnedMet(null);
  }, [time]);

  const startedRef = useRef(false);
  useEffect(() => {
    if (ready && mission && !startedRef.current) {
      startedRef.current = true;
      seek(nowMet);
    }
  }, [ready, mission, nowMet, seek]);

  if (loadError) {
    return (
      <div
        role="alert"
        className="surface-card mx-auto max-w-lg border-[var(--status-critical-border)] p-8 text-center"
      >
        <AlertTriangle className="mx-auto h-6 w-6 text-status-critical" aria-hidden="true" />
        <p className="mt-3 text-sm text-blueberry">{loadError}</p>
        <Link
          href="/missions"
          className="mt-4 inline-block text-sm font-medium text-berry underline underline-offset-4 hover:text-blueberry"
        >
          Back to missions
        </Link>
      </div>
    );
  }

  if (!mission) return <Skeleton className="h-[600px] w-full rounded-lg" />;
  if (!canView) return <AccessDenied />;

  const cursorMet = time?.t ?? nowMet;
  const momentMet = pinnedMet ?? cursorMet;
  const selected = readingAt(items, Math.min(momentMet, nowMet));
  const phase = phaseAt(phases, momentMet);
  const day = Math.floor(nowMetRaw / 86400);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-sm text-stem tabular-nums">
            {STATUS_LABEL[mission.status]}
            {mission.status === 'IN_PROGRESS' && nowMetRaw >= 0 && ` · mission day ${day + 1}`}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-blueberry sm:text-3xl">
            {mission.name}
          </h1>
        </div>

        {isAdmin ? (
          <div role="radiogroup" aria-label="Crew member" className="ui-tabs">
            {crew.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={a.id === astronautId}
                onClick={() => setAstronautId(a.id)}
                className={`ui-tab text-xs font-semibold ${
                  a.id === astronautId ? 'ui-tab-active' : ''
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm font-medium text-berry">
            {crew.find((a) => a.id === astronautId)?.name}
          </p>
        )}
      </header>

      {viewerSrc ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="relative overflow-hidden rounded-lg border border-line bg-[#060911] shadow-sm">
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-plate/70">
                  Loading simulation…
                </div>
              )}
              <iframe
                ref={frameRef}
                src={viewerSrc}
                title={`3D Trajectory of ${mission.name}`}
                allow="fullscreen"
                className={`block h-[60vh] min-h-[420px] w-full transition-opacity duration-500 ${
                  ready ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>

            <aside className="surface-card">
              <MissionMomentPanel met={momentMet} nowMet={nowMet} phase={phase} reading={selected} />
            </aside>
          </div>

          <section aria-labelledby="timeline-title" className="surface-card p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="timeline-title" className="text-base font-bold text-blueberry">
                  Mission &amp; Health
                </h2>
                <p className="text-xs text-stem">
                  Each point marks a reading. Select one to inspect spacecraft position and crew
                  status at that time.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPinnedMet(null);
                    seek(nowMet);
                  }}
                  className="tactile-press rounded-pill border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-blueberry hover:border-blueberry"
                >
                  Jump to now
                </button>
                <button
                  type="button"
                  onClick={() => (time?.playing ? pause() : play())}
                  aria-label={time?.playing ? 'Pause simulation' : 'Play simulation'}
                  className="tactile-press inline-flex items-center rounded-pill border border-line bg-surface px-3 py-1.5 text-blueberry hover:border-blueberry"
                >
                  {time?.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => frameRef.current?.requestFullscreen?.()}
                  aria-label="View simulation in fullscreen"
                  className="tactile-press inline-flex items-center rounded-pill border border-line bg-surface px-3 py-1.5 text-blueberry hover:border-blueberry"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {ready ? (
              <MissionTimeline
                phases={phases}
                items={items}
                nowMet={nowMet}
                cursorMet={cursorMet}
                selected={selected}
                onPick={(it) => {
                  setPinnedMet(it.met < 0 ? it.met : null);
                  seek(Math.max(0, it.met));
                }}
              />
            ) : (
              <Skeleton className="h-[112px] w-full rounded-md" />
            )}
            {!readingsLoading && !items.length && (
              <p className="mt-2 text-sm text-stem">This crew member has no readings yet.</p>
            )}
          </section>
        </>
      ) : (
        <div className="surface-tinted p-6 text-sm text-blueberry">
          Trajectory data for this mission is not available yet.{' '}
          <Link href="/trends" className="font-semibold underline underline-offset-4 hover:text-berry">
            View your health trends
          </Link>
        </div>
      )}
    </div>
  );
}
