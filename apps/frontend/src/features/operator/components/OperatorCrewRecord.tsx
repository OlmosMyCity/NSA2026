'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, MapPin, RefreshCw, TimerOff, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { AstronautFallbackAvatar } from '@/features/astronauts/components/AstronautFallbackAvatar';
import { Skeleton } from '@/features/common/components/Skeleton';
import { serverNow } from '@/features/common/services/serverClock';
import { FreshnessRing } from '@/features/health/components/FreshnessRing';
import { TrendChart } from '@/features/health/components/TrendChart';
import { BODY_ZONES } from '@/features/health/domain/education';
import { evaluateIndicator } from '@/features/health/domain/evaluate';
import { INDICATORS } from '@/features/health/domain/indicators';
import { STATUS_THEME } from '@/features/health/domain/status-theme';
import type { TrendPoint } from '@/features/health/domain/trends';
import { operatorService } from '../services/operatorService';
import { REASON_TEXT, STATUS_META, VERDICT_META, VITAL_FIELDS, timeAgo } from '../domain/presentation';
import { CREW_LOCATION_LABEL, DESTINATION_LABEL, type OperatorCrewDetail } from '../domain/types';

const REFRESH_MS = 45_000;

const dateFmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

const TREND_META = {
  improving: { label: 'Improving', Icon: TrendingUp },
  stable: { label: 'Stable', Icon: Minus },
  worsening: { label: 'Worsening', Icon: TrendingDown },
} as const;

const READING_STATUS = {
  OK: STATUS_META.OK,
  WARNING: STATUS_META.WARNING,
  CRITICAL: STATUS_META.CRITICAL,
} as const;

/** Ficha individual de un tripulante para el operador en Tierra. */
export function OperatorCrewRecord({ astronautId }: { astronautId: string }) {
  const [detail, setDetail] = useState<OperatorCrewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await operatorService.getCrewMember(astronautId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this crew member.');
    }
  }, [astronautId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  /** Serie por indicador para las mini gráficas, de la más antigua a la más reciente. */
  const series = useMemo(() => {
    const chronological = [...(detail?.history ?? [])].reverse();
    return Object.fromEntries(
      VITAL_FIELDS.map(({ field, indicator }) => [
        field,
        chronological.map<TrendPoint>((r) => ({
          t: Date.parse(r.takenAt),
          value: r[field],
          status: evaluateIndicator(indicator, r[field]).status,
        })),
      ])
    ) as Record<(typeof VITAL_FIELDS)[number]['field'], TrendPoint[]>;
  }, [detail]);

  const backLink = (
    <Link
      href="/operator"
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-berry underline-offset-4 hover:text-blueberry hover:underline"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      Crew oversight
    </Link>
  );

  if (!detail && !error) {
    return (
      <div className="space-y-5" aria-busy="true">
        {backLink}
        <Skeleton className="h-28 w-full rounded-[10px]" />
        <Skeleton className="h-64 w-full rounded-[10px]" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-5">
        {backLink}
        <div role="alert" className="twin-panel mx-auto max-w-lg p-6 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-status-critical" aria-hidden="true" />
          <p className="mt-3 text-sm text-blueberry">{error}</p>
          <button type="button" onClick={() => void load()} className="twin-btn twin-btn-ghost mt-4">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const nowMs = serverNow();
  const status = STATUS_META[detail.status];
  const isHistorical = !!detail.vitals && !detail.isFresh;

  return (
    <div className="animate-materialize space-y-6">
      {backLink}

      <header className="twin-panel flex flex-wrap items-center justify-between gap-5 p-5" style={{ borderColor: status.border }}>
        <div className="flex min-w-0 items-center gap-4">
          {detail.photoUrl ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
              <Image src={detail.photoUrl} alt="" fill className="object-cover" />
            </div>
          ) : (
            <AstronautFallbackAvatar name={detail.name} className="h-16 w-16 shrink-0" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-blueberry">{detail.name}</h1>
            <p className="truncate text-sm text-stem">
              {detail.crewRole} · {detail.missionName}
            </p>
          </div>
        </div>

        <dl className="flex flex-wrap items-start gap-x-8 gap-y-3 text-[13px]">
          <div>
            <dt className="twin-label">Status</dt>
            <dd className="ui-badge mt-1" style={{ color: status.color }}>
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${detail.status === 'NO_DATA' ? 'border border-current' : 'bg-current'}`}
              />
              <span>{status.label}</span>
            </dd>
          </div>
          <div>
            <dt className="twin-label flex items-center gap-1.5">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              Location
            </dt>
            <dd className="mt-1 font-medium text-blueberry">
              {detail.location ? CREW_LOCATION_LABEL[detail.location] : 'Not reported'}
            </dd>
            {detail.locationUpdatedAt && (
              <dd className="text-xs text-stem tabular-nums">Reported {timeAgo(detail.locationUpdatedAt, nowMs)}</dd>
            )}
          </div>
          <div>
            <dt className="twin-label">Last health reading</dt>
            <dd className="mt-1 font-medium text-blueberry tabular-nums">
              {detail.lastReadingAt ? dateFmt.format(new Date(detail.lastReadingAt)) : 'Never'}
            </dd>
            {detail.lastReadingAt && (
              <dd className="mt-0.5">
                <FreshnessRing takenAt={detail.lastReadingAt} />
              </dd>
            )}
          </div>
        </dl>
      </header>

      {isHistorical && detail.lastReadingAt && (
        <div role="status" className="twin-panel flex items-start gap-3 p-4">
          <TimerOff className="mt-0.5 h-5 w-5 shrink-0 text-stem" aria-hidden="true" />
          <p className="max-w-prose text-[13px] text-stem">
            <span className="font-semibold text-blueberry">Live vitals expired.</span> The values below are from{' '}
            {timeAgo(detail.lastReadingAt, nowMs)} and are shown as history. Current status and readiness stay
            unknown until {detail.name.split(' ')[0]} takes a new measurement.
          </p>
        </div>
      )}

      <section aria-labelledby="readiness-title" className="space-y-3">
        <h2 id="readiness-title" className="text-sm font-semibold text-blueberry">
          Readiness by destination
        </h2>
        <ul className="grid gap-px overflow-hidden rounded-[10px] border border-line/70 bg-line/50 sm:grid-cols-2 lg:grid-cols-5">
          {detail.readiness.map((r) => {
            const verdict = VERDICT_META[r.verdict];
            const VerdictIcon = verdict.Icon;
            return (
              <li key={r.destination} className="bg-[hsl(var(--hsl-surface-elevated)/0.92)] p-4">
                <span className="twin-label">{DESTINATION_LABEL[r.destination]}</span>
                <p className="mt-1.5 flex items-center gap-1.5 text-[15px] font-semibold" style={{ color: verdict.color }}>
                  <VerdictIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {verdict.label}
                </p>
                <p className="mt-1 text-xs leading-snug text-stem">{REASON_TEXT[r.reasonCode]}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="vitals-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="vitals-title" className="text-sm font-semibold text-blueberry">
            Clinical values
          </h2>
          {detail.lastReadingStatus && (
            <span className="text-xs text-stem">
              Triage at reading:{' '}
              <span className="font-semibold" style={{ color: READING_STATUS[detail.lastReadingStatus].color }}>
                {READING_STATUS[detail.lastReadingStatus].label}
              </span>
            </span>
          )}
        </div>

        {detail.vitals ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VITAL_FIELDS.map(({ field, indicator }) => {
              const def = INDICATORS[indicator];
              const value = detail.vitals![field];
              const theme = STATUS_THEME[evaluateIndicator(indicator, value).status];
              const points = series[field];
              return (
                <li key={field} className="twin-panel p-4">
                  <span className="twin-label">{def.label}</span>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    {/* Vencido: gris, es un dato histórico */}
                    <span className="twin-value text-xl font-bold" style={{ color: isHistorical ? 'var(--color-stem)' : theme.color }}>
                      {value}
                    </span>
                    <span className="text-xs text-stem">{def.unit}</span>
                    {!isHistorical && <span className="sr-only">{theme.label}</span>}
                  </p>
                  {points.length > 1 && (
                    <div className="mt-2 h-12">
                      <TrendChart indicator={indicator} points={points} height={48} compact />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="surface-tinted p-8 text-center text-sm text-stem">No health readings on record.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="zones-title" className="twin-panel space-y-3 p-5">
          <h2 id="zones-title" className="text-sm font-semibold text-blueberry">
            Body zones{isHistorical ? ' · at last reading' : ''}
          </h2>
          <ul className="divide-y divide-line/50">
            {detail.zones.map((z) => {
              const theme = STATUS_THEME[z.status];
              const trend = TREND_META[z.trend];
              return (
                <li key={z.zone} className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
                  <span className="flex items-center gap-2 font-medium text-blueberry">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.color }} />
                    {BODY_ZONES[z.zone].label}
                  </span>
                  <span className="flex items-center gap-4 text-xs">
                    <span style={{ color: theme.color }}>{z.status === 'red' ? 'Critical' : theme.label}</span>
                    <span className="flex w-24 items-center gap-1 text-stem">
                      <trend.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {trend.label}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="notes-title" className="twin-panel space-y-4 p-5">
          <h2 id="notes-title" className="text-sm font-semibold text-blueberry">
            Alerts and guidance
          </h2>
          {detail.alerts.length > 0 ? (
            <ul className="space-y-2">
              {detail.alerts.map((alert, i) => (
                <li key={i} className="ui-callout-critical flex items-start gap-2 text-xs text-status-critical">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{alert}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stem">No alerts on the last reading.</p>
          )}
          {detail.recommendation && (
            <div className="ui-callout text-xs text-blueberry">
              <span className="mb-0.5 block font-semibold text-berry">Triage recommendation</span>
              {detail.recommendation}
            </div>
          )}
          {detail.latestDirective && (
            <div className="ui-callout text-xs text-blueberry">
              <span className="mb-0.5 block font-semibold text-berry">
                Flight surgeon directive · {dateFmt.format(new Date(detail.latestDirective.createdAt))}
              </span>
              {detail.latestDirective.content}
              <span className="mt-1 block text-stem">
                {detail.latestDirective.acknowledgedAt ? 'Acknowledged by crew' : 'Not yet acknowledged'}
              </span>
            </div>
          )}
        </section>
      </div>

      {detail.history.length > 0 && (
        <section aria-labelledby="history-title" className="space-y-3">
          <h2 id="history-title" className="text-sm font-semibold text-blueberry">
            Recent readings
          </h2>
          <div className="twin-panel overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line/60 text-xs text-stem">
                  <th scope="col" className="px-4 py-2.5 font-medium">Taken</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Triage</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">HR</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">BP</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">SpO₂</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Temp</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Glucose</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Sleep</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Mood</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {detail.history.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-stem tabular-nums">{dateFmt.format(new Date(r.takenAt))}</td>
                    <td className="px-3 py-2 text-xs font-semibold" style={{ color: READING_STATUS[r.status].color }}>
                      {READING_STATUS[r.status].label}
                    </td>
                    <td className="twin-value px-3 py-2 text-right text-blueberry">{r.heartRateBpm}</td>
                    <td className="twin-value px-3 py-2 text-right text-blueberry">
                      {r.systolicMmHg}/{r.diastolicMmHg}
                    </td>
                    <td className="twin-value px-3 py-2 text-right text-blueberry">{r.spo2Pct}</td>
                    <td className="twin-value px-3 py-2 text-right text-blueberry">{r.temperatureC}</td>
                    <td className="twin-value px-3 py-2 text-right text-blueberry">{r.glucoseMgDl}</td>
                    <td className="twin-value px-3 py-2 text-right text-blueberry">{r.sleepHours}</td>
                    <td className="twin-value px-4 py-2 text-right text-blueberry">{r.mood}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
