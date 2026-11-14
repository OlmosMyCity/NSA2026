import { MousePointerClick, PhoneCall } from 'lucide-react';
import { BODY_ZONES, HAZARD_LABELS, INDICATOR_GUIDES } from '../domain/education';
import { INDICATORS, INDICATORS_BY_ZONE } from '../domain/indicators';
import { STATUS_THEME } from '../domain/status-theme';
import type { ZoneSummary } from '../domain/summary';
import type { BodyZoneId } from '../domain/types';
import { StatusBadge } from './StatusBadge';

interface ZoneDetailPanelProps {
  zone: BodyZoneId | null;
  summary: ZoneSummary | null;
}

export function ZoneDetailPanel({ zone, summary }: ZoneDetailPanelProps) {
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
          <StatusBadge status={summary.status} />
        </div>
        <p className="text-sm leading-relaxed text-stem">{info.function}</p>
      </header>

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

