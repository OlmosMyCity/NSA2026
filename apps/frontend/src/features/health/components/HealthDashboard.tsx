'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Activity, AlertTriangle, ArrowLeft, FlaskConical, RefreshCw, Rotate3d, TimerOff } from 'lucide-react';
import { EmptyState } from '@/features/common/components/EmptyState';
import { Skeleton } from '@/features/common/components/Skeleton';
import { serverNow } from '@/features/common/services/serverClock';
import { INDICATOR_IDS, INDICATORS } from '../domain/indicators';
import { API_STATUS, toIndicatorReadings, type ApiHealthReading } from '../domain/api-adapter';
import { summarizeZones } from '../domain/summary';
import { worstStatus } from '../domain/evaluate';
import { BODY_ZONES } from '../domain/education';
import { STATUS_THEME } from '../domain/status-theme';
import type { BodyZoneId, IndicatorEvaluation, IndicatorId } from '../domain/types';
import { useActiveAstronaut } from '../hooks/useActiveAstronaut';
import { useHealthReadings } from '../hooks/useHealthReadings';
import { useFreshnessPhase } from '../hooks/useFreshnessPhase';
import { FreshnessRing } from './FreshnessRing';
import {
  evaluateDigitalTwinRemote,
  type DecisionResult,
  type DigitalTwinState,
} from '../services/digitalTwinService';
import { StatusBadge } from './StatusBadge';
import { SignalNoisePanel } from './SignalNoisePanel';
import { INITIAL_WHAT_IF, ScenarioDock, type WhatIfState } from './twin/ScenarioDock';
import { ZoneSelector } from './twin/ZoneSelector';
import { ZoneInspector } from './twin/ZoneInspector';
import { TwinOverview } from './twin/TwinOverview';

const Body3D = dynamic(() => import('./Body3D'), {
  ssr: false,
  loading: () => <Skeleton className="h-[520px] w-full rounded-[10px] sm:h-[600px]" />,
});

const dateFmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

type TwinResult = { twin: DigitalTwinState; decision: DecisionResult };

/** Applies What-If overrides on top of the latest reading (pure; no network). */
function applyScenario(rows: ApiHealthReading[], s: WhatIfState, astronautId?: string): ApiHealthReading[] {
  if (!s.active) return rows;
  if (rows.length === 0) {
    const now = new Date().toISOString();
    return [
      {
        id: 'whatif-baseline',
        astronautId: astronautId ?? 'astro-01',
        heartRateBpm: s.heartRateBpm ?? 72,
        systolicMmHg: 118,
        diastolicMmHg: 76,
        glucoseMgDl: 95,
        temperatureC: 36.6,
        spo2Pct: s.spo2Pct ?? 98,
        sleepHours: s.sleepHours ?? 7.5,
        mood: 4,
        resistanceExerciseMin: 60,
        status: 'OK',
        alerts: [],
        takenAt: now,
      },
    ];
  }
  const next = [...rows];
  const i = next.length - 1;
  next[i] = {
    ...next[i],
    heartRateBpm: s.heartRateBpm ?? next[i].heartRateBpm,
    spo2Pct: s.spo2Pct ?? next[i].spo2Pct,
    sleepHours: s.sleepHours ?? next[i].sleepHours,
  };
  return next;
}

function scenarioKey(s: WhatIfState): string {
  return JSON.stringify([
    s.active,
    s.environment,
    s.stormScale,
    s.shielding,
    s.heartRateBpm ?? null,
    s.spo2Pct ?? null,
    s.sleepHours ?? null,
    s.freeTextMood.trim(),
  ]);
}

export function HealthDashboard() {
  const { astronautId, setAstronautId, crew, isResolving } = useActiveAstronaut();
  const { rows, latest, isLoading, error, refetch } = useHealthReadings(astronautId);
  const [selected, setSelected] = useState<BodyZoneId | null>(null);
  const [hovered, setHovered] = useState<BodyZoneId | null>(null);
  const [whatIf, setWhatIf] = useState<WhatIfState>(INITIAL_WHAT_IF);
  const [result, setResult] = useState<TwinResult | null>(null);
  const [evaluatedKey, setEvaluatedKey] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const cache = useRef(new Map<string, TwinResult>());
  const requestId = useRef(0);
  const viewerRef = useRef<HTMLDivElement>(null);

  const effectiveRows = useMemo(() => applyScenario(rows, whatIf, astronautId), [rows, whatIf, astronautId]);

  // Live vitals expire 15 min after the reading. A What-If scenario is a simulation, so it never locks.
  const freshnessPhase = useFreshnessPhase(latest?.takenAt);
  const isLocked = !whatIf.active && freshnessPhase === 'expired';

  // Local rules: instant, zero tokens. Drives the 3D colors and the official status.
  const zones = useMemo(
    () => summarizeZones(effectiveRows.flatMap(toIndicatorReadings), whatIf.active ? undefined : serverNow()),
    // freshnessPhase re-evaluates expiry when the window closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [whatIf.active, effectiveRows, freshnessPhase]
  );

  const dataKey = `${astronautId ?? ''}:${rows.length}:${latest?.id ?? ''}`;
  const currentKey = `${dataKey}|${scenarioKey(whatIf)}`;
  const isStale = evaluatedKey !== null && evaluatedKey !== currentKey;

  /** Rules + Gemini triage. Only runs on load or explicit "Run triage"; results are cached per scenario. */
  const runTriage = useCallback(
    async (scenario: WhatIfState) => {
      const key = `${dataKey}|${scenarioKey(scenario)}`;
      const hit = cache.current.get(key);
      if (hit) {
        setResult(hit);
        setEvaluatedKey(key);
        return;
      }
      const scenarioRows = applyScenario(rows, scenario, astronautId);
      if (scenarioRows.length === 0) return;
      const id = ++requestId.current;
      setIsEvaluating(true);
      try {
        const res = await evaluateDigitalTwinRemote({
          readings: scenarioRows,
          environment: scenario.environment,
          radiation: { stormScale: scenario.stormScale, shielding: scenario.shielding },
          freeTextMood: scenario.freeTextMood.trim() || undefined,
        });
        cache.current.set(key, res);
        if (id !== requestId.current) return;
        setResult(res);
        setEvaluatedKey(key);
      } finally {
        if (id === requestId.current) setIsEvaluating(false);
      }
    },
    [dataKey, rows, astronautId]
  );

  // Initial triage whenever the underlying readings change (new astronaut / new reading).
  useEffect(() => {
    // Expired vitals are not triaged: the model must not rule on a stale reading.
    if (rows.length === 0 || freshnessPhase === 'expired') return;
    setWhatIf(INITIAL_WHAT_IF);
    void runTriage(INITIAL_WHAT_IF);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  const resetScenario = () => {
    setWhatIf(INITIAL_WHAT_IF);
    void runTriage(INITIAL_WHAT_IF); // served from cache: no API call
  };

  const focusZone = (zone: BodyZoneId) => {
    setSelected(zone);
    const el = viewerRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const evaluations = useMemo(() => {
    const map: Partial<Record<IndicatorId, IndicatorEvaluation>> = {};
    for (const z of Object.values(zones)) for (const e of z.evaluations) map[e.indicator] = e;
    return map;
  }, [zones]);

  const overall = isLocked
    ? 'unknown'
    : latest && !whatIf.active
    ? API_STATUS[latest.status]
    : worstStatus(Object.values(zones).map((z) => z.status));

  // Triage computed on a reading that has since expired is not shown as current.
  const shownResult = isLocked ? null : result;

  const baseline = latest
    ? { heartRateBpm: latest.heartRateBpm, spo2Pct: latest.spo2Pct, sleepHours: latest.sleepHours }
    : null;

  if (isResolving || isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]" aria-busy="true">
        <div className="space-y-4">
          <Skeleton className="h-[560px] w-full rounded-[10px]" />
          <Skeleton className="h-56 w-full rounded-[10px]" />
        </div>
        <Skeleton className="h-[640px] w-full rounded-[10px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="twin-panel mx-auto max-w-lg p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-status-critical" aria-hidden="true" />
        <p className="mt-3 text-sm text-blueberry">{error}</p>
        <button type="button" onClick={refetch} className="twin-btn twin-btn-ghost mt-4">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  const crewSelector =
    crew.length > 1 ? (
      <label className="flex items-center gap-2">
        <span className="twin-label">Crew member</span>
        <select
          value={astronautId || ''}
          onChange={(e) => setAstronautId(e.target.value)}
          className="twin-select w-auto min-w-[10rem]"
        >
          {crew.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  if (!latest && !whatIf.active) {
    return (
      <div className="space-y-4">
        {crewSelector && <div className="flex justify-end">{crewSelector}</div>}
        <EmptyState
          title="No readings recorded yet"
          description="Log a first vital-signs reading and the twin will light up zone by zone. You can also explore it with a simulated baseline."
          actionHref="/readings/new"
          actionLabel="Log reading"
        />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setWhatIf({ ...INITIAL_WHAT_IF, active: true })}
            className="twin-btn twin-btn-ghost"
          >
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            Explore with a simulated baseline
          </button>
        </div>
      </div>
    );
  }

  const activeCrewName = crew.find((m) => m.id === astronautId)?.name;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-blueberry sm:text-[1.75rem]">
            Digital twin
          </h1>
          <p className="mt-1 text-[13px] text-stem tabular-nums">
            {latest
              ? `${activeCrewName ? `${activeCrewName} · ` : ''}Last reading ${dateFmt.format(new Date(latest.takenAt))}`
              : 'Simulated baseline, no real readings yet'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {crewSelector}
          <span className="twin-panel inline-flex items-center gap-3 px-3 py-1.5">
            <span className="inline-flex items-center gap-2">
              <span className="twin-label">{whatIf.active ? 'Simulated status' : 'Status'}</span>
              <StatusBadge status={overall} compact />
            </span>
            {!whatIf.active && latest && <FreshnessRing takenAt={latest.takenAt} />}
          </span>
        </div>
      </header>

      {isLocked && (
        <div
          role="status"
          className="twin-panel animate-swap flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5"
        >
          <div className="flex min-w-0 items-start gap-3">
            <TimerOff className="mt-0.5 h-5 w-5 shrink-0 text-stem" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blueberry">Live vitals expired</p>
              <p className="mt-0.5 max-w-prose text-[13px] text-stem">
                Heart rate, blood pressure, SpO₂ and temperature are older than 15 minutes, so your current
                status is unknown. Past readings stay available in Trends as history.
              </p>
            </div>
          </div>
          <Link href="/readings/new" className="twin-btn twin-btn-primary">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            Measure now
          </Link>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        <div className="min-w-0 space-y-4">
          <div ref={viewerRef} className="twin-panel relative scroll-mt-24 overflow-hidden">
            <Body3D
              zones={zones}
              selected={selected}
              onSelect={setSelected}
              onHover={setHovered}
              heartRate={evaluations.heartRate?.value}
            />
            <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
              {selected ? (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="twin-btn twin-btn-ghost pointer-events-auto h-8 bg-canvas/60 px-2.5 text-xs backdrop-blur-md"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Full body
                </button>
              ) : (
                <span />
              )}
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-canvas/60 px-2.5 text-xs text-stem backdrop-blur-md">
                {hovered ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: STATUS_THEME[zones[hovered].status].color }}
                    />
                    <span className="font-semibold text-blueberry">{BODY_ZONES[hovered].label}</span>
                  </>
                ) : (
                  <>
                    <Rotate3d className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
                    Drag to rotate · click an organ
                  </>
                )}
              </span>
            </div>
          </div>

          <ScenarioDock
            value={whatIf}
            baseline={baseline}
            isEvaluating={isEvaluating}
            isDirty={isStale || evaluatedKey === null}
            onChange={setWhatIf}
            onRun={() => void runTriage(whatIf)}
            onReset={resetScenario}
          />
        </div>

        <aside
          aria-label="Twin inspector"
          className="twin-panel space-y-5 p-4 sm:p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
        >
          <ZoneSelector zones={zones} selected={selected} onSelect={setSelected} />
          {selected ? (
            <ZoneInspector
              zone={selected}
              summary={zones[selected]}
              twinZone={shownResult ? shownResult.twin.zones[selected] : null}
              modelScore={shownResult ? shownResult.decision.modelEstimate.score[selected] : null}
              isStale={isStale}
            />
          ) : isLocked ? (
            <p className="animate-swap ui-callout text-[13px] text-stem">
              Triage is paused. It runs again on your next measurement.
            </p>
          ) : (
            <TwinOverview
              zones={zones}
              twin={result?.twin ?? null}
              decision={result?.decision ?? null}
              isLoading={isEvaluating}
              isStale={isStale}
              onSelectZone={focusZone}
            />
          )}
          {isStale && !isLocked && (
            <p className="flex items-center gap-1.5 text-[11px] text-status-caution" role="status">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Model results are from the previous scenario. Run triage to update.
            </p>
          )}
        </aside>
      </div>

      <section aria-labelledby="vitals-title" className="space-y-2.5">
        <h2 id="vitals-title" className="text-sm font-semibold text-blueberry">
          All vitals
        </h2>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line/70 bg-line/50 sm:grid-cols-3 lg:grid-cols-9">
          {INDICATOR_IDS.map((id) => {
            const def = INDICATORS[id];
            const ev = evaluations[id];
            const status = ev?.status ?? 'unknown';
            const active = selected === def.zone;
            return (
              <button
                key={id}
                type="button"
                onClick={() => focusZone(def.zone)}
                aria-pressed={active}
                className={`flex min-h-[5.5rem] flex-col justify-between gap-2 p-3 text-left transition-colors duration-ui ${
                  active ? 'bg-[hsl(var(--hsl-surface-hover))]' : 'bg-[hsl(var(--hsl-surface-elevated)/0.92)] hover:bg-[hsl(var(--hsl-surface-subtle))]'
                }`}
              >
                <span className="flex items-start gap-1.5 text-[11px] leading-tight text-stem">
                  <span
                    aria-hidden="true"
                    className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_THEME[status].color }}
                  />
                  {def.label}
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="twin-value text-lg font-bold" style={{ color: ev ? STATUS_THEME[status].color : undefined }}>
                    {ev ? ev.value : '—'}
                  </span>
                  <span className="text-[11px] text-stem">{def.unit}</span>
                  <span className="sr-only">{STATUS_THEME[status].label}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-right text-[11px] text-stem">
          Anatomy model:{' '}
          <a
            href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-blueberry"
          >
            BodyParts3D © DBCLS, CC BY 4.0
          </a>
        </p>
      </section>

      {latest && !isLocked && <SignalNoisePanel astronautId={latest.astronautId} latestReading={latest} />}
    </div>
  );
}
