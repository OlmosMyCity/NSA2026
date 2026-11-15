'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/features/common/components/EmptyState';
import { Skeleton } from '@/features/common/components/Skeleton';
import { INDICATOR_GUIDES } from '../domain/education';
import { INDICATOR_IDS, INDICATORS } from '../domain/indicators';
import { STATUS_THEME } from '../domain/status-theme';
import { buildTrend, RANGE_PRESETS, summarizeTrend, type RangeDays } from '../domain/trends';
import type { IndicatorId } from '../domain/types';
import { useActiveAstronaut } from '../hooks/useActiveAstronaut';
import { useHealthReadings } from '../hooks/useHealthReadings';
import { StatusBadge } from './StatusBadge';
import { TrendChart } from './TrendChart';

const dateFmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export function TrendsView() {
  const { astronautId, setAstronautId, crew, isResolving } = useActiveAstronaut();
  const { readings, isLoading, error, refetch, latest } = useHealthReadings(astronautId);
  const [days, setDays] = useState<RangeDays>(14);
  const [indicator, setIndicator] = useState<IndicatorId>('heartRate');

  const now = latest ? Date.parse(latest.takenAt) + 3_600_000 : Date.now();
  const xDomain: [number, number] = [now - days * 86_400_000, now];

  const series = useMemo(
    () => Object.fromEntries(INDICATOR_IDS.map((id) => [id, buildTrend(readings, id, days, now)])),
    [readings, days, now],
  ) as Record<IndicatorId, ReturnType<typeof buildTrend>>;

  if (isResolving || isLoading) return <Skeleton className="h-[480px] w-full rounded-lg" />;

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

  if (!readings.length) {
    return (
      <div className="space-y-4">
        {crewSelector && <div className="flex justify-end">{crewSelector}</div>}
        <EmptyState
          title="No history yet"
          description="Once you log readings, you will see how each physiological indicator evolves over time."
          actionHref="/readings/new"
          actionLabel="Log Reading"
        />
      </div>
    );
  }

  const def = INDICATORS[indicator];
  const points = series[indicator];
  const summary = summarizeTrend(points);
  const fmt = (v: number) => (Number.isInteger(def.input.step) ? Math.round(v) : v.toFixed(1));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-blueberry sm:text-3xl">
            Trends
          </h1>
          <p className="mt-1 text-sm text-stem max-w-2xl">
            How your indicators change over time. Subtle background bands mark nominal, watch, and
            critical thresholds.
          </p>
        </div>
        {crewSelector}
      </header>

      {/* Filters — underline tabs + underline select */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div
          role="radiogroup"
          aria-label="Date range"
          className="ui-tabs"
        >
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              role="radio"
              aria-checked={days === p.days}
              onClick={() => setDays(p.days)}
              className={`ui-tab text-xs font-semibold ${days === p.days ? 'ui-tab-active' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-3 text-xs font-semibold text-stem">
          <span>Indicator</span>
          <select
            value={indicator}
            onChange={(e) => setIndicator(e.target.value as IndicatorId)}
            className="ui-select w-auto pr-4 text-sm font-medium"
          >
            {INDICATOR_IDS.map((id) => (
              <option key={id} value={id}>
                {INDICATORS[id].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Gráfica principal */}
      <section aria-labelledby="trend-title" className="surface-card p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="trend-title" className="text-lg font-bold text-blueberry">
              {def.label}{' '}
              <span className="text-sm font-normal text-stem">({def.unit})</span>
            </h2>
            <p className="mt-1 max-w-xl text-sm text-stem">{INDICATOR_GUIDES[indicator].whyInSpace}</p>
          </div>
          {summary.last && <StatusBadge status={summary.last.status} />}
        </div>

        {points.length ? (
          <TrendChart indicator={indicator} points={points} xDomain={xDomain} />
        ) : (
          <p className="py-16 text-center text-sm text-stem">
            No readings for this indicator in the selected range.
          </p>
        )}

        {summary.last && (
          <dl className="mt-8 grid grid-cols-3 gap-6 text-sm">
            <div>
              <dt className="text-xs font-medium text-stem">Latest</dt>
              <dd className="mt-0.5 text-lg font-bold text-blueberry tabular-nums">
                {fmt(summary.last.value)}{' '}
                <span className="text-xs font-normal text-stem">{def.unit}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-stem">Average</dt>
              <dd className="mt-0.5 text-lg font-bold text-blueberry tabular-nums">
                {fmt(summary.average ?? 0)}{' '}
                <span className="text-xs font-normal text-stem">{def.unit}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-stem">Out of range</dt>
              <dd className="mt-0.5 text-lg font-bold text-blueberry tabular-nums">
                {summary.outOfRange}{' '}
                <span className="text-xs font-normal text-stem">of {points.length}</span>
              </dd>
            </div>
          </dl>
        )}

        {points.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium text-berry hover:text-blueberry">
              View data table
            </summary>
            <div className="mt-3 max-h-72 overflow-auto rounded-md border border-line">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-surface-tinted text-xs font-semibold text-blueberry">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Value</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {[...points].reverse().map((p) => (
                    <tr key={p.t}>
                      <td className="px-3 py-2 text-xs text-stem tabular-nums">
                        {dateFmt.format(p.t)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-blueberry tabular-nums">
                        {fmt(p.value)} {def.unit}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={p.status} compact />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      {/* Múltiplos pequeños */}
      <section aria-labelledby="overview-title">
        <h2 id="overview-title" className="mb-3 text-sm font-semibold text-blueberry">
          All Indicators
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INDICATOR_IDS.map((id) => {
            const s = series[id];
            const lastP = s.at(-1);
            const d = INDICATORS[id];
            const active = id === indicator;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setIndicator(id);
                  document
                    .getElementById('trend-title')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className={`tactile-press rounded-lg p-4 text-left transition-colors ${
                  active
                    ? 'surface-card ring-2 ring-blueberry'
                    : 'surface-card hover:bg-surface-tinted/40'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-stem">{d.label}</span>
                  <span className="text-sm font-bold text-blueberry tabular-nums">
                    {lastP
                      ? `${Number.isInteger(d.input.step) ? Math.round(lastP.value) : lastP.value.toFixed(1)} ${d.unit}`
                      : '—'}
                  </span>
                </div>
                <div className="mt-2">
                  {s.length ? (
                    <TrendChart indicator={id} points={s} xDomain={xDomain} height={64} compact />
                  ) : (
                    <div className="flex h-16 items-center text-xs text-stem">No data</div>
                  )}
                </div>
                {lastP && (
                  <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-stem">
                    <span aria-hidden="true" style={{ color: STATUS_THEME[lastP.status].color }}>
                      {STATUS_THEME[lastP.status].icon}
                    </span>
                    {lastP.status === 'red' ? 'Critical' : STATUS_THEME[lastP.status].label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

