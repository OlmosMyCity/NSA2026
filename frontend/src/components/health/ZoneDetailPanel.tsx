import { MousePointerClick, PhoneCall, Clock, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { BODY_ZONES, HAZARD_LABELS, INDICATOR_GUIDES } from '../../domain/health/education';
import { INDICATORS, INDICATORS_BY_ZONE } from '../../domain/health/indicators';
import { STATUS_THEME } from '../../domain/health/status-theme';
import type { ZoneSummary } from '../../domain/health/summary';
import type { BodyZoneId, SpaceHazard } from '../../domain/health/types';
import type { ZoneTwinState } from '../../services/digitalTwinService';
import { StatusBadge } from './StatusBadge';

interface ZoneDetailPanelProps {
  zone: BodyZoneId | null;
  summary: ZoneSummary | null;
  twinZone?: ZoneTwinState | null;
}

export function ZoneDetailPanel({ zone, summary, twinZone }: ZoneDetailPanelProps) {
  if (!zone || !summary) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-start justify-center gap-3 p-6 sm:p-8 text-stem">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-tinted text-blueberry">
          <MousePointerClick className="h-5 w-5 text-berry" aria-hidden="true" />
        </div>
        <h3 className="text-base font-bold text-blueberry">Explore your physiology</h3>
        <p className="text-sm leading-relaxed max-w-md">
          Tap an organ on the anatomical model or select any indicator below. This panel shows
          what happens in that region, why spaceflight affects it, and what protocol to follow.
        </p>
      </div>
    );
  }

  const info = BODY_ZONES[zone];
  const evaluated = new Set(summary.evaluations.map((e) => e.indicator));
  const missing = INDICATORS_BY_ZONE[zone].filter((id) => !evaluated.has(id));

  return (
    <div key={zone} className="space-y-8 p-6 sm:p-8 animate-materialize" aria-live="polite">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-blueberry">{info.label}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {twinZone && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-surface-tinted px-2.5 py-0.5 text-[11px] font-medium text-blueberry">
                {twinZone.trend === 'improving' && <TrendingUp className="h-3 w-3 text-telemetry-green" aria-hidden="true" />}
                {twinZone.trend === 'worsening' && <TrendingDown className="h-3 w-3 text-telemetry-red" aria-hidden="true" />}
                {twinZone.trend === 'stable' && <Minus className="h-3 w-3 text-stem" aria-hidden="true" />}
                <span className="capitalize">{twinZone.trend}</span>
              </span>
            )}
            {twinZone?.isOverdue && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                <Clock className="h-3 w-3" aria-hidden="true" />
                Overdue
              </span>
            )}
            <StatusBadge status={summary.status} />
          </div>
        </div>
        <p className="text-sm leading-relaxed text-stem">{info.function}</p>
      </header>

      {twinZone && (
        <div className="rounded-lg bg-surface-tinted p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-blueberry">
              HRP Hazard Load: {Math.round(twinZone.hazardLoad.total * 100)}%
            </span>
            <span className="text-stem">
              Risk level: <strong className="uppercase text-blueberry">{twinZone.riskLevel}</strong>
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {(Object.keys(twinZone.hazardLoad.breakdown) as SpaceHazard[]).map((h) => {
              const pct = Math.round(twinZone.hazardLoad.breakdown[h] * 100);
              return (
                <div key={h} className="text-[10px]">
                  <div className="truncate text-stem" title={HAZARD_LABELS[h]}>
                    {HAZARD_LABELS[h].split(' ')[0]}
                  </div>
                  <div className="mt-0.5 h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-berry"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ul className="space-y-6">
        {summary.evaluations.map((e) => {
          const def = INDICATORS[e.indicator];
          const guide = INDICATOR_GUIDES[e.indicator];
          const t = STATUS_THEME[e.status];
          return (
            <li key={e.indicator}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-blueberry">{def.label}</span>
                <span className="text-xl font-bold font-mono tabular-nums" style={{ color: t.color }}>
                  {e.value}
                  <span className="ml-1 text-xs font-normal text-stem">{def.unit}</span>
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stem">{guide.whyInSpace}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {def.hazards.map((h) => (
                  <span
                    key={h}
                    className="font-mono text-[11px] text-berry"
                  >
                    [{HAZARD_LABELS[h]}]
                  </span>
                ))}
              </div>
              {e.status !== 'unknown' && (
                <div
                  className="mt-3 flex items-start gap-2 border-l-2 pl-3 py-0.5 text-xs leading-relaxed text-blueberry"
                  style={{ borderColor: t.color }}
                >
                  {e.status === 'red' && (
                    <PhoneCall
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: t.color }}
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    <strong className="font-semibold" style={{ color: t.color }}>
                      Recommended action:{' '}
                    </strong>
                    {guide.actions[e.status]}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {missing.length > 0 && (
        <p className="text-xs text-stem pt-2">
          No recent reading for: {missing.map((id) => INDICATORS[id].label).join(', ')}.
        </p>
      )}
    </div>
  );
}

