'use client';

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, ArrowLeft, RefreshCw, Rotate3d } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { EmptyState } from '@/features/common/components/EmptyState';
import { Skeleton } from '@/features/common/components/Skeleton';
import { INDICATOR_IDS, INDICATORS } from '../domain/indicators';
import { API_STATUS } from '../domain/api-adapter';
import { worstStatus } from '../domain/evaluate';
import { BODY_ZONES } from '../domain/education';
import type { BodyZoneId, IndicatorEvaluation, IndicatorId } from '../domain/types';
import { useHealthReadings } from '../hooks/useHealthReadings';
import { IndicatorCard } from './IndicatorCard';
import { StatusBadge } from './StatusBadge';
import { ZoneDetailPanel } from './ZoneDetailPanel';
import { SignalNoisePanel } from './SignalNoisePanel';

const DEMO_ASTRONAUT_ID = 'astro-01';

const Body3D = dynamic(() => import('./Body3D'), {
  ssr: false,
  loading: () => <Skeleton className="h-[500px] w-full rounded-lg sm:h-[580px]" />,
});

const dateFmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export function HealthDashboard() {
  const { user } = useAuth();
  const astronautId = user?.astronautId ?? DEMO_ASTRONAUT_ID;
  const { zones, latest, isLoading, error, refetch } = useHealthReadings(astronautId);
  const [selected, setSelected] = useState<BodyZoneId | null>(null);
  const [hovered, setHovered] = useState<BodyZoneId | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

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

  if (isLoading) {
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

  if (!latest) {
    return (
      <EmptyState
        title="No readings recorded yet"
        description="Log your first vital signs reading and the anatomical model will display your physiological status."
        actionHref="/readings/new"
        actionLabel="Log Reading"
      />
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
            Last reading · {dateFmt.format(new Date(latest.takenAt))}
          </p>
        </div>
        <StatusBadge status={overall} />
      </header>

      {latest.recommendation && overall !== 'green' && (
        <div
          role="status"
          className="ui-callout-caution text-sm leading-relaxed text-blueberry"
        >
          {latest.recommendation}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
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

        <div className="surface-card">
          <ZoneDetailPanel zone={selected} summary={selected ? zones[selected] : null} />
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

      <SignalNoisePanel astronautId={latest.astronautId} latestReading={latest} />
    </div>
  );
}
