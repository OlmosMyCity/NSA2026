'use client';

import { PhoneCall, ShieldCheck } from 'lucide-react';
import { STATUS_THEME } from '../../../domain/health/status-theme';
import type { ZoneSummary } from '../../../domain/health/summary';
import type { BodyZoneId } from '../../../domain/health/types';
import { BODY_ZONES } from '../../../domain/health/education';
import type { DecisionResult, DigitalTwinState } from '../../../services/digitalTwinService';
import { ZONE_ORDER } from './ZoneSelector';
import { ACTION_LABELS, RISK_FROM_STATUS, RISK_META } from './twinMeta';

interface TwinOverviewProps {
  zones: Record<BodyZoneId, ZoneSummary>;
  twin: DigitalTwinState | null;
  decision: DecisionResult | null;
  isLoading: boolean;
  isStale: boolean;
  onSelectZone: (zone: BodyZoneId) => void;
}

/** Overview panel summarizing overall triage status and per-zone deterministic vs. model risk. */
export function TwinOverview({ zones, twin, decision, isLoading, isStale, onSelectZone }: TwinOverviewProps) {
  return (
    <div className="animate-swap space-y-5">
      {decision ? (
        <Verdict decision={decision} isStale={isStale} isLoading={isLoading} />
      ) : (
        <div className="space-y-2" aria-busy={isLoading}>
          <div className="h-16 animate-pulse rounded-lg bg-plate/5" />
          <div className="h-24 animate-pulse rounded-lg bg-plate/5" />
        </div>
      )}

      <section aria-label="Zones" className="space-y-1">
        <div className="grid grid-cols-[1fr_6rem] px-2 pb-1 text-[11px] font-medium text-stem">
          <span>Zone</span>
          <span className="text-right">Status</span>
        </div>
        <ul className="divide-y divide-line/50">
          {ZONE_ORDER.map((zone) => {
            const s = zones[zone];
            const riskLevel = twin && !isStale ? twin.zones[zone].riskLevel : RISK_FROM_STATUS[s.status];
            return (
              <li key={zone}>
                <button
                  type="button"
                  onClick={() => onSelectZone(zone)}
                  className="grid w-full grid-cols-[1fr_6rem] items-center rounded-md px-2 py-2.5 text-left text-[13px] transition-colors duration-ui hover:bg-plate/5"
                >
                  <span className="flex items-center gap-2 font-medium text-blueberry">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: STATUS_THEME[s.status].color }}
                    />
                    {BODY_ZONES[zone].label}
                  </span>
                  <span className="text-right font-semibold" style={{ color: RISK_META[riskLevel].color }}>
                    {RISK_META[riskLevel].label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Verdict({ decision, isStale, isLoading }: { decision: DecisionResult; isStale: boolean; isLoading: boolean }) {
  const { escalar, accion, confianza, freeTextMoodEstimate } = decision;
  const conf = Math.round(confianza * 100);
  const tone = escalar ? 'var(--status-critical)' : 'var(--status-nominal)';
  const Icon = escalar ? PhoneCall : ShieldCheck;

  return (
    <div className={`space-y-3 transition-opacity duration-ui ${isStale || isLoading ? 'opacity-60' : ''}`}>
      <div className="twin-well flex items-start gap-3 px-3.5 py-3.5">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: escalar ? 'var(--status-critical-bg)' : 'var(--status-nominal-bg)' }}
        >
          <Icon className="h-4 w-4" style={{ color: tone }} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[15px] font-semibold leading-snug" style={{ color: tone }}>
            {escalar ? 'Escalate to flight surgeon' : 'Monitor on board'}
          </p>
          <p className="text-[13px] text-blueberry">{ACTION_LABELS[accion]}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-[11px] text-stem">
            <span>
              Confidence <strong className="twin-value text-blueberry">{conf}%</strong>
            </span>
            {freeTextMoodEstimate && (
              <span>
                Crew note mood{' '}
                <strong className="twin-value text-blueberry">{freeTextMoodEstimate.moodScore}/5</strong>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
