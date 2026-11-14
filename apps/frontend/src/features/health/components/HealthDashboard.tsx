'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, ArrowLeft, RefreshCw, Rotate3d } from 'lucide-react';
import { EmptyState } from '@/features/common/components/EmptyState';
import { Skeleton } from '@/features/common/components/Skeleton';
import { INDICATOR_IDS, INDICATORS } from '../domain/indicators';
import { API_STATUS, toIndicatorReadings } from '../domain/api-adapter';
import { summarizeZones } from '../domain/summary';
import { worstStatus } from '../domain/evaluate';
import { BODY_ZONES } from '../domain/education';
import type { BodyZoneId, IndicatorEvaluation, IndicatorId } from '../domain/types';
import { useActiveAstronaut } from '../hooks/useActiveAstronaut';
import { useHealthReadings } from '../hooks/useHealthReadings';
import {
  evaluateDigitalTwinRemote,
  type DecisionResult,
  type DigitalTwinState,
} from '../services/digitalTwinService';
import { IndicatorCard } from './IndicatorCard';
import { StatusBadge } from './StatusBadge';
import { ZoneDetailPanel } from './ZoneDetailPanel';
import { SignalNoisePanel } from './SignalNoisePanel';
import { TriageDecisionCard } from './TriageDecisionCard';
import { WhatIfPanel, type WhatIfState } from './WhatIfPanel';

const Body3D = dynamic(() => import('./Body3D'), {
  ssr: false,
  loading: () => <Skeleton className="h-[500px] w-full rounded-lg sm:h-[580px]" />,
});

const dateFmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

const INITIAL_WHAT_IF: WhatIfState = {
  active: false,
  environment: 'LUNAR_BASE',
  stormScale: 'S0_NOMINAL',
  shielding: 'CREW_CABIN_NOMINAL',
  freeTextMood: '',
};

export function HealthDashboard() {
  const { astronautId, setAstronautId, crew, isResolving } = useActiveAstronaut();
  const { rows, zones: baseZones, latest, isLoading, error, refetch } = useHealthReadings(astronautId);
  const [selected, setSelected] = useState<BodyZoneId | null>(null);
  const [hovered, setHovered] = useState<BodyZoneId | null>(null);
  const [whatIf, setWhatIf] = useState<WhatIfState>(INITIAL_WHAT_IF);
  const [twin, setTwin] = useState<DigitalTwinState | null>(null);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  const effectiveRows = useMemo(() => {
    if (!whatIf.active) return rows;
    if (rows.length === 0) {
      const nowIso = new Date().toISOString();
      return [
        {
          id: 'whatif-baseline',
          astronautId: astronautId ?? 'astro-01',
          heartRateBpm: whatIf.heartRateBpm ?? 72,
          systolicMmHg: 118,
          diastolicMmHg: 76,
          glucoseMgDl: 95,
          temperatureC: 36.6,
          spo2Pct: whatIf.spo2Pct ?? 98,
          sleepHours: whatIf.sleepHours ?? 7.5,
          mood: 4,
          status: 'OK' as const,
          alerts: [],
          takenAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ];
    }
    const updated = [...rows];
    const lastIdx = updated.length - 1;
    updated[lastIdx] = {
      ...updated[lastIdx],
      heartRateBpm: whatIf.heartRateBpm ?? updated[lastIdx].heartRateBpm,
      spo2Pct: whatIf.spo2Pct ?? updated[lastIdx].spo2Pct,
      sleepHours: whatIf.sleepHours ?? updated[lastIdx].sleepHours,
    };
    return updated;
  }, [rows, whatIf, astronautId]);

  const zones = useMemo(
    () => (whatIf.active ? summarizeZones(effectiveRows.flatMap(toIndicatorReadings)) : baseZones),
    [whatIf.active, effectiveRows, baseZones]
  );

  const [evalNonce, setEvalNonce] = useState(0);

  useEffect(() => {
    if (effectiveRows.length === 0) return;
    let alive = true;
    setDecisionLoading(true);
    evaluateDigitalTwinRemote({
      readings: effectiveRows,
      environment: whatIf.environment,
      radiation: {
        stormScale: whatIf.stormScale,
        shielding: whatIf.shielding,
      },
      freeTextMood: whatIf.freeTextMood || undefined,
    })
      .then((res) => {
        if (!alive) return;
        setTwin(res.twin);
        setDecision(res.decision);
      })
      .finally(() => {
        if (alive) setDecisionLoading(false);
      });
    return () => {
      alive = false;
    };
    // Solo dispara al cargar lecturas reales o al pulsar "Evaluate Triage" / "Reset"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, evalNonce]);

  const focusZone = (zone: BodyZoneId) => {
    setSelected(zone);
    const el = viewerRef.current;
    if (el && el.getBoundingClientRect().top < 0) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const evaluations = useMemo(() => {
    const map: Partial<Record<IndicatorId, IndicatorEvaluation>> = {};
    for (const z of Object.values(zones)) {
      for (const e of z.evaluations) map[e.indicator] = e;
    }
    return map;
  }, [zones]);

  const overall = latest
    ? API_STATUS[latest.status]
    : worstStatus(Object.values(zones).map((z) => z.status));

  if (isResolving || isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-busy="true">
        <Skeleton className="h-[480px] w-full rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="mx-auto max-w-lg surface-card p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-status-critical" aria-hidden="true" />
        <p className="mt-3 text-sm text-blueberry">{error}</p>
        <button
          type="button"
          onClick={refetch}
          className="tactile-press mt-4 inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-4 py-2 text-xs font-semibold text-blueberry hover:bg-surface-tinted"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const crewSelector =
    crew.length > 1 ? (
      <label className="inline-flex items-center gap-2 text-xs font-medium text-stem">
        <span>Crew Member:</span>
        <select
          aria-label="Crew Member"
          value={astronautId || ''}
          onChange={(e) => setAstronautId(e.target.value)}
          className="rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-blueberry"
        >
          {crew.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  if (!latest && !whatIf.active) {
    return (
      <div className="space-y-6">
        {crewSelector && <div className="flex justify-end">{crewSelector}</div>}
        <WhatIfPanel
          value={whatIf}
          baseline={latest}
          isEvaluating={decisionLoading}
          onChange={setWhatIf}
          onApply={() => setEvalNonce((n) => n + 1)}
          onReset={() => {
            setWhatIf(INITIAL_WHAT_IF);
            setEvalNonce((n) => n + 1);
          }}
        />
        <EmptyState
          title="No readings recorded yet"
          description="Log your first vital signs reading and the anatomical model will display your physiological status."
          actionHref="/readings/new"
          actionLabel="Log Reading"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-blueberry sm:text-3xl">
            Your Health Status
          </h1>
          <p className="mt-1 text-sm text-stem tabular-nums">
            {latest ? `Last reading · ${dateFmt.format(new Date(latest.takenAt))}` : 'Simulated baseline'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {crewSelector}
          <StatusBadge status={overall} />
        </div>
      </header>

      {latest?.recommendation && overall !== 'green' && (
        <div
          role="status"
          className="ui-callout-caution text-sm leading-relaxed text-blueberry"
        >
          {latest.recommendation}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start">
        <div
          ref={viewerRef}
          className="relative scroll-mt-24 overflow-hidden surface-tinted rounded-lg"
        >
          <Body3D
            zones={zones}
            selected={selected}
            onSelect={setSelected}
            onHover={setHovered}
            heartRate={evaluations.heartRate?.value}
          />
          <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between sm:inset-x-5 sm:top-5">
            {selected ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="tactile-press pointer-events-auto inline-flex items-center gap-1.5 rounded-pill bg-surface/90 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-blueberry shadow-sm hover:bg-surface"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Full body</span>
              </button>
            ) : (
              <span />
            )}
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface/85 backdrop-blur-md px-3 py-1 text-xs font-medium text-stem shadow-sm">
              {hovered ? (
                <span className="font-semibold text-blueberry">{BODY_ZONES[hovered].label}</span>
              ) : (
                <>
                  <Rotate3d className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
                  <span>Drag to rotate</span>
                </>
              )}
            </span>
          </div>

          <p className="absolute bottom-2.5 right-3.5 text-[11px] text-stem">
            Model:{' '}
            <a
              href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-blueberry"
            >
              BodyParts3D © DBCLS, CC BY 4.0
            </a>
          </p>
        </div>

        <div className="space-y-4">
          <div className="surface-card">
            <ZoneDetailPanel
              zone={selected}
              summary={selected ? zones[selected] : null}
              twinZone={selected && twin ? twin.zones[selected] : null}
              modelScore={selected && decision ? decision.modelEstimate.score[selected] : null}
            />
          </div>

          <WhatIfPanel
            value={whatIf}
            baseline={latest}
            isEvaluating={decisionLoading}
            onChange={setWhatIf}
            onApply={() => setEvalNonce((n) => n + 1)}
            onReset={() => {
              setWhatIf(INITIAL_WHAT_IF);
              setEvalNonce((n) => n + 1);
            }}
          />

          <TriageDecisionCard decision={decision} isLoading={decisionLoading} />
        </div>
      </section>

      <section aria-labelledby="indicators-title">
        <h2 id="indicators-title" className="mb-3 text-sm font-semibold text-blueberry">
          All Indicators
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {INDICATOR_IDS.map((id) => (
            <IndicatorCard
              key={id}
              indicator={id}
              evaluation={evaluations[id]}
              selected={selected === INDICATORS[id].zone}
              onClick={() => focusZone(INDICATORS[id].zone)}
            />
          ))}
        </div>
      </section>

      {latest && <SignalNoisePanel astronautId={latest.astronautId} latestReading={latest} />}
    </div>
  );
}
