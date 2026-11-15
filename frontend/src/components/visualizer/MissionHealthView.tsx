'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, Maximize2, Pause, Play } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Skeleton } from '@/components/common/Skeleton';
import { astronautService } from '@/services/astronautService';
import type { Astronaut } from '@/domain/astronauts/types';
import { missionService } from '@/services/missionService';
import type { Mission } from '@/domain/missions/types';
import { useHealthReadings } from '@/hooks/useHealthReadings';
import { metOf, phaseAt, readingAt, readingsOnTimeline } from '../../domain/visualizer/missionClock';
import { trajectoryUrl } from '../../domain/visualizer/trajectories';
import {
  TRAJECTORY_PRESETS,
  VEHICLE_OPTIONS,
  getMissionSimConfig,
  saveMissionSimConfig,
} from '../../domain/visualizer/missionSimulationConfig';
import { useViewerBridge } from '../../hooks/useViewerBridge';
import { MissionMomentPanel } from './MissionMomentPanel';
import { MissionTimeline } from './MissionTimeline';

const STATUS_LABEL: Record<Mission['status'], string> = {
  PLANNING: 'Planned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

/**
 * Integrated mission trajectory and crew physiological timeline view.
 * Couples the embedded 3D flight-dynamics iframe (`useViewerBridge`) with historical
 * astronaut health readings on a logarithmic MET timeline (`MissionTimeline`) and
 * phase-aware physiological hazard inspection (`MissionMomentPanel`).
 */
export function MissionHealthView({ missionId }: { missionId: string }) {
  const { user, isAdmin } = useAuth();
  const [mission, setMission] = useState<Mission | null>(null);
  const [crew, setCrew] = useState<Astronaut[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [astronautId, setAstronautId] = useState<string | undefined>();
  const [trajectoryPreset, setTrajectoryPreset] = useState<string>('auto');
  const [vehicleId, setVehicleId] = useState<string>('auto');

  useEffect(() => {
    let alive = true;
    setCrew([]);
    setAstronautId(undefined);
    setLoadError(null);

    const saved = getMissionSimConfig(missionId);
    setTrajectoryPreset(saved?.trajectoryPreset || 'auto');
    setVehicleId(saved?.vehicleId || 'auto');

    Promise.all([missionService.getById(missionId), astronautService.list({ missionId, limit: 50 })])
      .then(([m, c]) => {
        if (!alive) return;
        setMission(m);
        setCrew(Array.isArray(c.data) ? c.data : []);
      })
      .catch(
        (err: unknown) =>
          alive && setLoadError(err instanceof Error ? err.message : 'Unable to load mission.')
      );
    return () => {
      alive = false;
    };
  }, [missionId]);

  const ownCrewMember = useMemo(
    () => crew.find((a) => (user?.astronautId && a.id === user.astronautId) || (user?.id && a.userId === user.id)),
    [crew, user?.astronautId, user?.id],
  );
  const canReadHealth = isAdmin || !!ownCrewMember;
  useEffect(() => {
    if (!crew.length) return;
    setAstronautId((cur) => cur ?? (isAdmin ? crew[0].id : ownCrewMember?.id));
  }, [crew, isAdmin, ownCrewMember?.id]);

  const { rows, isLoading: readingsLoading } = useHealthReadings(canReadHealth ? astronautId : undefined);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const viewerSrc = mission
    ? trajectoryUrl(mission, {
        dataFile: trajectoryPreset !== 'auto' ? trajectoryPreset : undefined,
        vehicleId: vehicleId !== 'auto' ? vehicleId : undefined,
      })
    : null;
  const { ready, time, seek, play, pause } = useViewerBridge(frameRef, viewerSrc);

  const now = Date.now();
  const nowMetRaw = mission ? metOf(new Date(now).toISOString(), mission.startDate) : 0;
  const tEnd = typeof ready?.tEnd === 'number' && Number.isFinite(ready.tEnd) ? ready.tEnd : Infinity;
  const nowMet = Math.min(Math.max(nowMetRaw, 0), tEnd);

  const phases = useMemo(() => ready?.phases ?? [], [ready?.phases]);
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
    setAstronautId(undefined);
  }, [missionId]);

  useEffect(() => {
    startedRef.current = false;
    setPinnedMet(null);
  }, [viewerSrc]);

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

  const handleTrajectoryChange = (nextPreset: string) => {
    setTrajectoryPreset(nextPreset);
    const existing = getMissionSimConfig(mission.id);
    saveMissionSimConfig(mission.id, {
      vehicleId,
      trajectoryPreset: nextPreset,
      customTrajectoryJson: nextPreset === 'auto' ? existing?.customTrajectoryJson ?? null : null,
      customFileName: nextPreset === 'auto' ? existing?.customFileName ?? null : null,
    });
  };

  const handleVehicleChange = (nextVehicle: string) => {
    setVehicleId(nextVehicle);
    const existing = getMissionSimConfig(mission.id);
    saveMissionSimConfig(mission.id, {
      vehicleId: nextVehicle,
      trajectoryPreset,
      customTrajectoryJson: existing?.customTrajectoryJson ?? null,
      customFileName: existing?.customFileName ?? null,
    });
  };

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
            {STATUS_LABEL[mission.status] ?? mission.status}
            {mission.status === 'IN_PROGRESS' && nowMetRaw >= 0 && ` · mission day ${day + 1}`}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-blueberry sm:text-3xl">
            {mission.name}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
          ) : ownCrewMember ? (
            <p className="text-sm font-medium text-berry">{ownCrewMember.name}</p>
          ) : null}
        </div>
      </header>

      {/* Trajectory & Vehicle Simulation Controls */}
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-stem">
            <span>Trajectory:</span>
            <select
              aria-label="Trajectory preset"
              value={trajectoryPreset}
              onChange={(e) => handleTrajectoryChange(e.target.value)}
              className="rounded-pill border border-line bg-surface-tinted px-3 py-1 text-xs font-semibold text-blueberry"
            >
              {TRAJECTORY_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-stem">
            <span>Spacecraft:</span>
            <select
              aria-label="Spacecraft vehicle"
              value={vehicleId}
              onChange={(e) => handleVehicleChange(e.target.value)}
              className="rounded-pill border border-line bg-surface-tinted px-3 py-1 text-xs font-semibold text-blueberry"
            >
              {VEHICLE_OPTIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {viewerSrc && (
          <a
            href={viewerSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-berry hover:text-blueberry"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Open 3D in new tab</span>
          </a>
        )}
      </div>

      {viewerSrc ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <ErrorBoundary
              fallbackTitle="3D orbital canvas interrupted"
              fallbackDescription="Unable to render the 3D iframe inside this pane. Try opening it in a new tab or retrying."
            >
              <div className="relative overflow-hidden rounded-lg border border-line bg-[#060911] shadow-sm">
                {!ready && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-plate/70">
                    Loading simulation…
                  </div>
                )}
                <iframe
                  key={viewerSrc}
                  ref={frameRef}
                  src={viewerSrc}
                  title={`3D Trajectory of ${mission.name}`}
                  allow="fullscreen"
                  className={`block h-[60vh] min-h-[420px] w-full transition-opacity duration-500 ${
                    ready ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </div>
            </ErrorBoundary>

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
              <p className="mt-2 text-sm text-stem">
                {canReadHealth
                  ? 'This crew member has no readings yet.'
                  : 'Timeline synchronized with flight phase. Individual crew biometrics are restricted to the assigned astronaut and Flight Surgeon.'}
              </p>
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
