'use client';

import { ChevronRight, Clock, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { BODY_ZONES, HAZARD_LABELS, INDICATOR_GUIDES } from '../../domain/education';
import { INDICATORS, INDICATORS_BY_ZONE } from '../../domain/indicators';
import { STATUS_THEME } from '../../domain/status-theme';
import type { ZoneSummary } from '../../domain/summary';
import type { BodyZoneId, IndicatorEvaluation, SpaceHazard } from '../../domain/types';
import type {
  TrendDirection,
  ZoneRiskLevel,
  ZoneTwinState,
} from '../../services/digitalTwinService';
import { StatusBadge } from '../StatusBadge';
import { RISK_FROM_STATUS, RISK_META, VIEW_DOMAIN, bandGradient, positionPct } from './twinMeta';

interface ZoneInspectorProps {
  zone: BodyZoneId;
  summary: ZoneSummary;
  twinZone: ZoneTwinState | null;
  isStale: boolean;
}

export function ZoneInspector({ zone, summary, twinZone, isStale }: ZoneInspectorProps) {
  const info = BODY_ZONES[zone];
  const evaluated = new Set(summary.evaluations.map((e) => e.indicator));
  const missing = INDICATORS_BY_ZONE[zone].filter((id) => !evaluated.has(id));

  const riskLevel: ZoneRiskLevel =
    twinZone && !isStale ? twinZone.riskLevel : RISK_FROM_STATUS[summary.status];

  return (
    <div key={zone} className="animate-swap space-y-5" aria-live="polite">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-blueberry">{info.label}</h2>
          <StatusBadge status={summary.status} />
        </div>
        <p className="text-[13px] leading-relaxed text-stem">{info.function}</p>
        {twinZone && (
          <div className="flex flex-wrap gap-1.5">
            <TrendChip trend={twinZone.trend} />
            {twinZone.isOverdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-status-caution/15 px-2 py-0.5 text-[11px] font-medium text-status-caution">
                <Clock className="h-3 w-3" aria-hidden="true" />
                Measurement overdue
              </span>
            )}
          </div>
        )}
      </header>

      <ZoneRiskCard riskLevel={riskLevel} />

      <section aria-label="Vitals in this zone" className="space-y-3">
        {summary.evaluations.length === 0 ? (
          <p className="twin-well px-3 py-3 text-[13px] text-stem">
            No readings yet for this zone. Log a reading to bring it to life on the twin.
          </p>
        ) : (
          summary.evaluations.map((e) => <VitalRow key={e.indicator} evaluation={e} />)
        )}
        {missing.length > 0 && summary.evaluations.length > 0 && (
          <p className="text-[11px] text-stem">
            Not measured recently: {missing.map((id) => INDICATORS[id].label).join(', ')}
          </p>
        )}
      </section>

      {twinZone && <HazardLoad twinZone={twinZone} isStale={isStale} />}
    </div>
  );
}

function TrendChip({ trend }: { trend: TrendDirection }) {
  const Icon = trend === 'improving' ? TrendingUp : trend === 'worsening' ? TrendingDown : Minus;
  const color =
    trend === 'improving'
      ? 'text-status-nominal'
      : trend === 'worsening'
        ? 'text-status-critical'
        : 'text-stem';
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-plate/5 px-2 py-0.5 text-[11px] font-medium text-blueberry">
      <Icon className={`h-3 w-3 ${color}`} aria-hidden="true" />
      <span className="capitalize">{trend}</span> trend
    </span>
  );
}

function ZoneRiskCard({ riskLevel }: { riskLevel: ZoneRiskLevel }) {
  const meta = RISK_META[riskLevel];
  return (
    <div className="twin-well flex items-center justify-between px-3 py-2.5">
      <span className="twin-label">Zone risk</span>
      <span className="text-[14px] font-semibold" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </div>
  );
}

function VitalRow({ evaluation: e }: { evaluation: IndicatorEvaluation }) {
  const def = INDICATORS[e.indicator];
  const guide = INDICATOR_GUIDES[e.indicator];
  const theme = STATUS_THEME[e.status];
  const domain = VIEW_DOMAIN[e.indicator];

  return (
    <div className="twin-well px-3 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-blueberry">{def.label}</span>
        <span className="flex items-baseline gap-1">
          <span className="twin-value text-lg font-bold" style={{ color: theme.color }}>
            {e.value}
          </span>
          <span className="text-[11px] text-stem">{def.unit}</span>
        </span>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full" style={{ background: bandGradient(e.indicator, domain) }}>
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-canvas"
          style={{ left: `${positionPct(e.value, domain)}%`, backgroundColor: theme.color }}
        />
      </div>
      {e.status !== 'unknown' && e.status !== 'green' && (
        <p className="mt-2.5 text-[12px] leading-relaxed text-blueberry">
          <span className="font-semibold" style={{ color: theme.color }}>
            Do now:{' '}
          </span>
          {guide.actions[e.status]}
        </p>
      )}
      <details className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-berry hover:text-blueberry">
          <ChevronRight className="h-3 w-3 transition-transform duration-ui group-open:rotate-90" aria-hidden="true" />
          Why spaceflight affects this
        </summary>
        <p className="mt-1.5 text-[12px] leading-relaxed text-stem">{guide.whyInSpace}</p>
      </details>
    </div>
  );
}

function HazardLoad({ twinZone, isStale }: { twinZone: ZoneTwinState; isStale: boolean }) {
  const hazards = Object.keys(twinZone.hazardLoad.breakdown) as SpaceHazard[];
  return (
    <section aria-label="NASA HRP hazard load" className={`space-y-2.5 ${isStale ? 'opacity-50' : ''}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold text-blueberry">HRP hazard load</h3>
        <span className="twin-value text-[13px] font-bold text-blueberry">
          {Math.round(twinZone.hazardLoad.total * 100)}%
        </span>
      </div>
      <ul className="space-y-1.5">
        {hazards.map((h) => {
          const pct = Math.round(twinZone.hazardLoad.breakdown[h] * 100);
          const top = h === twinZone.hazardLoad.topHazard;
          return (
            <li key={h} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2 text-[12px]">
              <span className={top ? 'font-semibold text-blueberry' : 'text-stem'}>{HAZARD_LABELS[h]}</span>
              <span className="h-1 overflow-hidden rounded-full bg-plate/10">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: top ? 'var(--status-caution)' : 'hsl(var(--hsl-ink-secondary) / 0.7)',
                  }}
                />
              </span>
              <span className="twin-value text-right text-stem">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

