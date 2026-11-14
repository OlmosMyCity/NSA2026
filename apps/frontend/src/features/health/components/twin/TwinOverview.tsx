'use client';

import { AlertTriangle, Cpu, PhoneCall, ShieldCheck } from 'lucide-react';
import { STATUS_THEME } from '../../domain/status-theme';
import type { ZoneSummary } from '../../domain/summary';
import type { BodyZoneId } from '../../domain/types';
import { BODY_ZONES } from '../../domain/education';
import type { DecisionResult, DigitalTwinState } from '../../services/digitalTwinService';
import { ZONE_ORDER } from './ZoneSelector';
import { ACTION_LABELS, RISK_FROM_STATUS, RISK_META } from './twinMeta';

const SOURCE_LABEL: Record<DecisionResult['source'], string> = {
  'gemini-decision-1': 'Gemini Decision 1',
  cache: 'Gemini Decision 1 · cached',
  'rules-fallback': 'Rules only (model offline)',
};

interface TwinOverviewProps {
  zones: Record<BodyZoneId, ZoneSummary>;
  twin: DigitalTwinState | null;
  decision: DecisionResult | null;
  isLoading: boolean;
  isStale: boolean;
  onSelectZone: (zone: BodyZoneId) => void;
}

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
        <div className="grid grid-cols-[1fr_5.5rem_5.5rem] px-2 pb-1 text-[11px] font-medium text-stem">
          <span>Zone</span>
          <span>Rules</span>
          <span>Model</span>
        </div>
        <ul className="divide-y divide-line/50">
          {ZONE_ORDER.map((zone) => {
            const s = zones[zone];
            const ruleLevel = twin && !isStale ? twin.zones[zone].riskLevel : RISK_FROM_STATUS[s.status];
            const model = decision?.modelEstimate.score[zone];
            const disagrees = !!model && !isStale && model.riskLevel !== ruleLevel;
            return (
              <li key={zone}>
                <button
                  type="button"
                  onClick={() => onSelectZone(zone)}
                  className="grid w-full grid-cols-[1fr_5.5rem_5.5rem] items-center rounded-md px-2 py-2.5 text-left text-[13px] transition-colors duration-ui hover:bg-plate/5"
                >
                  <span className="flex items-center gap-2 font-medium text-blueberry">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: STATUS_THEME[s.status].color }}
                    />
                    {BODY_ZONES[zone].label}
                  </span>
                  <span className="font-semibold" style={{ color: RISK_META[ruleLevel].color }}>
                    {RISK_META[ruleLevel].label}
                  </span>
                  <span
                    className={`flex items-center gap-1 ${isStale ? 'opacity-50' : ''}`}
                    style={{ color: model ? RISK_META[model.riskLevel].color : undefined }}
                  >
                    {model ? RISK_META[model.riskLevel].label : <span className="text-stem">—</span>}
                    {disagrees && (
                      <AlertTriangle className="h-3 w-3 text-status-caution" aria-label="Disagrees with rule" />
                    )}
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
  const { escalar, accion, modelEstimate, discrepancy, source, freeTextMoodEstimate } = decision;
  const conf = Math.round(decision.confianza * 100);
  const pEsc = Math.round(modelEstimate.escalarProbabilidad * 100);
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
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug" style={{ color: tone }}>
            {escalar ? 'Escalate to flight surgeon' : 'Monitor on board'}
          </p>
          <p className="mt-0.5 text-[13px] text-blueberry">{ACTION_LABELS[accion]}</p>
          <p className="mt-1 text-[11px] text-stem">Official decision from the deterministic rules</p>
        </div>
      </div>

      <div className="twin-well space-y-2.5 px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-blueberry">
            <Cpu className="h-3.5 w-3.5 text-berry" aria-hidden="true" />
            Second opinion
          </span>
          <span className="text-[11px] text-stem">{SOURCE_LABEL[source]}</span>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-[12px]">
          <div>
            <dt className="twin-label">Escalate</dt>
            <dd className="twin-value mt-0.5 font-bold text-blueberry">{pEsc}%</dd>
          </div>
          <div>
            <dt className="twin-label">Confidence</dt>
            <dd className="twin-value mt-0.5 font-bold text-blueberry">{conf}%</dd>
          </div>
          <div>
            <dt className="twin-label">Action</dt>
            <dd className="mt-0.5 truncate font-semibold text-blueberry" title={ACTION_LABELS[modelEstimate.accion]}>
              {ACTION_LABELS[modelEstimate.accion].split(/[,(]/)[0]}
            </dd>
          </div>
        </dl>
        {freeTextMoodEstimate && (
          <p className="text-[12px] text-stem">
            Crew note read as mood{' '}
            <span className="twin-value font-bold text-blueberry">{freeTextMoodEstimate.moodScore}/5</span> (
            {Math.round(freeTextMoodEstimate.confidence * 100)}% confidence)
          </p>
        )}
        <p className="text-[11px] text-stem">Estimación del modelo, no diagnóstico.</p>
      </div>

      {discrepancy.hasDiscrepancy && !isStale && (
        <div
          role="status"
          className="rounded-lg px-3.5 py-3 text-[12px] text-blueberry"
          style={{
            backgroundColor: 'var(--status-caution-bg)',
            boxShadow: 'inset 0 0 0 1px var(--status-caution-border)',
          }}
        >
          <p className="flex items-center gap-1.5 font-semibold text-status-caution">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Model and rules disagree. The rule prevails.
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-stem">
            {discrepancy.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

