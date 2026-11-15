'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, MapPin, RefreshCw, Search } from 'lucide-react';
import { AstronautFallbackAvatar } from '@/components/astronauts/AstronautFallbackAvatar';
import { SkeletonCard } from '@/components/common/Skeleton';
import { serverNow } from '@/services/serverClock';
import { FreshnessRing } from '@/components/health/FreshnessRing';
import { evaluateIndicator, worstStatus } from '@/domain/health/evaluate';
import { STATUS_THEME } from '@/domain/health/status-theme';
import type { IndicatorId } from '@/domain/health/types';
import { operatorService } from '../../services/operatorService';
import { REASON_TEXT, STATUS_META, VERDICT_META, timeAgo } from '../../domain/operator/presentation';
import {
  CREW_LOCATION_LABEL,
  DESTINATIONS,
  DESTINATION_LABEL,
  type CrewVitals,
  type Destination,
  type OperatorCrewMember,
  type OperatorCrewOverview,
} from '../../domain/operator/types';

const REFRESH_MS = 45_000;

const dateFmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
const timeFmt = new Intl.DateTimeFormat('en', { timeStyle: 'medium' });

export function OperatorConsole() {
  const [overview, setOverview] = useState<OperatorCrewOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [destination, setDestination] = useState<Destination>('EVA');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setOverview(await operatorService.getCrewOverview());
      setError(null);
    } catch (err) {
      // Si ya hay datos se conservan en pantalla; la hora de actualización indica su antigüedad.
      setError(err instanceof Error ? err.message : 'Unable to reach the crew link.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const visibleCrew = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!overview || !q) return overview?.crew ?? [];
    return overview.crew.filter((m) =>
      [m.name, m.crewRole, m.missionName].some((text) => text.toLowerCase().includes(q))
    );
  }, [overview, query]);

  if (!overview && !error) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!overview) {
    return (
      <div role="alert" className="twin-panel mx-auto max-w-lg p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-status-critical" aria-hidden="true" />
        <p className="mt-3 text-sm text-blueberry">{error}</p>
        <button type="button" onClick={() => void load()} className="twin-btn twin-btn-ghost mt-4">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  const nowMs = serverNow();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <span id="destination-label" className="twin-label block">
            Readiness for
          </span>
          <div role="radiogroup" aria-labelledby="destination-label" className="twin-segmented flex-wrap">
            {DESTINATIONS.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={destination === d}
                onClick={() => setDestination(d)}
                className="twin-segment whitespace-nowrap"
              >
                {DESTINATION_LABEL[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-stem">
          <div className="relative w-60">
            <Search
              className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-stem"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search crew, role or mission"
              aria-label="Search crew"
              className="ui-input pl-6 text-sm placeholder:text-stem/70"
            />
          </div>
          {error ? (
            <span role="status" className="flex items-center gap-1.5 text-status-caution">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Link lost · showing data from {timeFmt.format(new Date(overview.serverTime))}
            </span>
          ) : (
            <span className="tabular-nums">Updated {timeFmt.format(new Date(overview.serverTime))}</span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh crew status"
            className="twin-btn twin-btn-ghost h-8 w-8 p-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {overview.crew.length === 0 ? (
        <div className="surface-tinted p-12 text-center text-sm text-stem">
          No missions are assigned to your account yet. Ask the flight surgeon to assign one.
        </div>
      ) : visibleCrew.length === 0 ? (
        <div className="surface-tinted p-12 text-center text-sm text-stem">
          No crew member matches that search.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {visibleCrew.map((member, index) => (
            <li
              key={member.astronautId}
              className="crew-card-enter"
              style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
            >
              <CrewCard member={member} destination={destination} nowMs={nowMs} />
            </li>
          ))}
        </ul>
      )}

      <p className="max-w-prose text-xs text-stem">
        Status counts as current for {overview.freshnessWindowMin} minutes after a measurement. Readiness is
        guidance from deterministic rules; clearance for an activity stays with the flight surgeon. Open a
        crew member for their full record.
      </p>
    </div>
  );
}

/** Los cuatro signos vivos, coloreados con las mismas reglas del panel del astronauta. */
function liveVitals(v: CrewVitals) {
  const color = (indicator: IndicatorId, value: number) =>
    STATUS_THEME[evaluateIndicator(indicator, value).status].color;
  const bloodPressure = worstStatus([
    evaluateIndicator('systolic', v.systolicMmHg).status,
    evaluateIndicator('diastolic', v.diastolicMmHg).status,
  ]);
  return [
    { label: 'HR', value: `${v.heartRateBpm} bpm`, color: color('heartRate', v.heartRateBpm) },
    { label: 'BP', value: `${v.systolicMmHg}/${v.diastolicMmHg}`, color: STATUS_THEME[bloodPressure].color },
    { label: 'SpO₂', value: `${v.spo2Pct}%`, color: color('spo2', v.spo2Pct) },
    { label: 'Temp', value: `${v.temperatureC}°C`, color: color('temperature', v.temperatureC) },
  ];
}

function CrewCard({
  member,
  destination,
  nowMs,
}: {
  member: OperatorCrewMember;
  destination: Destination;
  nowMs: number;
}) {
  const status = STATUS_META[member.status];
  const readiness = member.readiness.find((r) => r.destination === destination);
  const verdict = VERDICT_META[readiness?.verdict ?? 'NO_DATA'];
  const VerdictIcon = verdict.Icon;

  return (
    <article className="twin-panel flex h-full flex-col gap-5 p-5" style={{ borderColor: status.border }}>
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          {member.photoUrl ? (
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line">
              <Image src={member.photoUrl} alt="" fill className="object-cover" />
            </div>
          ) : (
            <AstronautFallbackAvatar name={member.name} className="h-12 w-12 shrink-0" />
          )}
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-blueberry">{member.name}</h2>
            <p className="truncate text-xs text-stem">
              {member.crewRole} · {member.missionName}
            </p>
          </div>
        </div>
        <span className="ui-badge shrink-0" style={{ color: status.color }}>
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${member.status === 'NO_DATA' ? 'border border-current' : 'bg-current'}`}
          />
          <span>{status.label}</span>
        </span>
      </header>

      <div className="twin-well p-4">
        <span className="twin-label">Readiness · {DESTINATION_LABEL[destination]}</span>
        {/* key: el veredicto hace crossfade en el mismo lugar al cambiar de destino */}
        <div key={destination} className="animate-swap mt-1.5">
          <p className="flex items-center gap-2 text-lg font-semibold tracking-tight" style={{ color: verdict.color }}>
            <VerdictIcon className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden="true" />
            {verdict.label}
          </p>
          <p className="mt-0.5 text-xs text-stem">{REASON_TEXT[readiness?.reasonCode ?? 'NO_READINGS']}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <div className="min-w-0">
          <dt className="twin-label flex items-center gap-1.5">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            Location
          </dt>
          <dd className="mt-1 font-medium text-blueberry">
            {member.location ? CREW_LOCATION_LABEL[member.location] : 'Not reported'}
          </dd>
          {member.locationUpdatedAt && (
            <dd className="text-xs text-stem tabular-nums">Reported {timeAgo(member.locationUpdatedAt, nowMs)}</dd>
          )}
        </div>
        <div className="min-w-0">
          <dt className="twin-label">Last health reading</dt>
          <dd className="mt-1 font-medium text-blueberry tabular-nums">
            {member.lastReadingAt ? dateFmt.format(new Date(member.lastReadingAt)) : 'Never'}
          </dd>
          {member.lastReadingAt && (
            <dd className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stem tabular-nums">
              <span>{timeAgo(member.lastReadingAt, nowMs)}</span>
              <FreshnessRing takenAt={member.lastReadingAt} />
            </dd>
          )}
        </div>
      </dl>

      {member.vitals && (
        <div className="border-t border-line/60 pt-4">
          <dl className="grid grid-cols-4 gap-3">
            {liveVitals(member.vitals).map((v) => (
              <div key={v.label} className="min-w-0">
                <dt className="twin-label">{v.label}</dt>
                {/* Vencidos: se ven en gris, como dato histórico y no como estado actual */}
                <dd
                  className="twin-value mt-0.5 text-sm font-bold"
                  style={{ color: member.isFresh ? v.color : 'var(--color-stem)' }}
                >
                  {v.value}
                </dd>
              </div>
            ))}
          </dl>
          {!member.isFresh && <p className="mt-2 text-[11px] text-stem">From the last reading · not current</p>}
        </div>
      )}

      <Link
        href={`/operator/${member.astronautId}`}
        className="mt-auto inline-flex items-center gap-1 self-start text-[13px] font-semibold text-berry underline-offset-4 hover:text-blueberry hover:underline"
      >
        Full record
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </article>
  );
}
